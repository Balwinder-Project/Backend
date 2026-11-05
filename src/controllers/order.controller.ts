import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../models/user.model';
import Product from '../models/product.model';
import { OrderService } from '../services/order.service';
import { WalletService } from '../services/wallet.service';
import { ShiprocketService } from '../services/shiprocket.service';
import { RazorpayService } from '../services/razorpay.service';
import { RetailerService } from '../services/retailer.service';
import { DiscountCampaignService } from '../services/discountCampaign.service';
import { getEffectiveUnitPrice, PricingRole, RetailerCategoryDiscount } from '../utils/pricing';
import { supportsTransactions } from '../utils/mongoTransactions';
import Order, { IEmbeddedAddress, IOrder, IOrderItem, OrderStatus } from '../models/order.model';
import Salesman from '../models/salesman.model';
import IncentiveLedgerEntry from '../models/incentiveLedger.model';

interface BuyerPricing {
  role: PricingRole;
  retailerId: string | null;
  retailerCategoryDiscounts: RetailerCategoryDiscount[];
  retailerProductPrices: Array<{ productId: string; slabs: Array<{ minQuantity: number; price: number }> }>;
}

/** Resolve the buyer's pricing role, retailer id, and negotiated category discounts. */
const resolvePricingContext = async (firebaseUid: string): Promise<BuyerPricing> => {
  try {
    const retailer = await RetailerService.getRetailerByFirebaseUid(firebaseUid);
    if (retailer) {
      const retailerCategoryDiscounts: RetailerCategoryDiscount[] = (retailer.categoryDiscounts || []).map(
        (d: any) => ({
          category: String(d.category),
          ...(d.subCategory && { subCategory: String(d.subCategory) }),
          ...(!d.subCategory && d.combinedMinQuantity != null ? { combinedMinQuantity: Number(d.combinedMinQuantity) } : {}),
          slabs: (d.slabs || []).map((s: any) => ({
            minQuantity: s.minQuantity,
            discountPercentage: s.discountPercentage,
            referencePrice: s.referencePrice,
            wholesalerPrice: s.wholesalerPrice,
          })),
        })
      );
      const retailerProductPrices = (retailer.productPrices || []).map((entry: any) => ({
        productId: String(entry.productId),
        slabs: (entry.slabs || []).map((s: any) => ({ minQuantity: s.minQuantity, price: s.price })),
      }));
      return { role: 'retailer', retailerId: String(retailer._id), retailerCategoryDiscounts, retailerProductPrices };
    }
  } catch {
    /* fall through to normal pricing */
  }
  return { role: 'normal', retailerId: null, retailerCategoryDiscounts: [], retailerProductPrices: [] };
};

const PICKUP_POSTCODE = process.env.SHIPROCKET_PICKUP_POSTCODE || '';
const PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION_NAME || 'Primary';

type ShippingItemInput = { productId: string; quantity: number };

async function getCheapestShippingQuote(
  items: ShippingItemInput[],
  products: any[],
  deliveryPincode: string
): Promise<{ shippingCharge: number; totalWeight: number; selectedRate: any; rates: any[] }> {
  if (!PICKUP_POSTCODE) throw new Error('Shiprocket pickup postcode is not configured on the server');
  const pincode = String(deliveryPincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pincode)) {
    throw new Error('A valid 6-digit delivery pincode is required to calculate shipping');
  }

  let totalWeight = 0;
  for (const item of items) {
    const product = products.find((p) => (p._id as any).toString() === item.productId);
    if (!product) throw new Error('PRODUCT_NOT_FOUND');
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
    totalWeight += Math.max(0.01, Number(product.weight) || 0.5) * quantity;
  }

  // Shiprocket's serviceability API expects chargeable shipment weight in kg.
  const chargeableWeight = Math.max(0.5, totalWeight);
  const rates = await ShiprocketService.getShippingRates(PICKUP_POSTCODE, pincode, chargeableWeight, 0);
  const availableRates = rates
    .filter((rate) => Number.isFinite(Number(rate.rate)) && Number(rate.rate) >= 0)
    .sort((a, b) => Number(a.rate) - Number(b.rate));

  if (!availableRates.length) {
    throw new Error(`No Shiprocket courier is currently available for delivery pincode ${pincode}`);
  }

  const selectedRate = availableRates[0];
  return {
    shippingCharge: Math.round(Number(selectedRate.rate) * 100) / 100,
    totalWeight: chargeableWeight,
    selectedRate,
    rates: availableRates,
  };
}

/**
 * Push a persisted order to Shiprocket and record the outcome on the order so
 * failures are visible (order.shiprocketSyncStatus / shiprocketError) and can
 * be retried, instead of being silently swallowed. Never throws.
 */
export async function pushOrderToShiprocket(order: IOrder, forceRetry = false): Promise<void> {
  const orderId = (order._id as any).toString();
  if (order.paymentMethod === 'razorpay' && ((Boolean(order.paymentStatus) && order.paymentStatus !== 'paid') || order.status === OrderStatus.PENDING)) {
    console.warn(`[shiprocket] refusing to sync unpaid Razorpay order ${order.orderNumber}`);
    return;
  }
  try {
    const productIds = order.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const orderDate = new Date(order.createdAt || Date.now()).toISOString().split('T')[0];
    const bill = order.billingAddress;
    const ship = order.shippingAddress;

    // Shiprocket requires a billing email and a clean 10-digit phone. The
    // embedded address stores no email, so fall back to the customer's account
    // email (then the Shiprocket account email as a last resort).
    const customer = await User.findById(order.userId).select('email').lean();
    const billingEmail =
      customer?.email || process.env.SHIPROCKET_EMAIL || 'orders@bndcreation.com';
    const to10Digits = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
    // Shiprocket requires billing_last_name to be present. Split the stored
    // full name into first + last (last stays '' for single-word names, which
    // satisfies the "present" rule).
    const splitName = (full?: string) => {
      const parts = (full || '').trim().split(/\s+/).filter(Boolean);
      return { first: parts[0] || 'Customer', last: parts.slice(1).join(' ') };
    };
    const billName = splitName(bill.name);
    const shipName = splitName(ship.name);

    const claimed = await OrderService.claimShiprocketSync(orderId, forceRetry);
    if (!claimed) return;

    const sr = await ShiprocketService.createOrder({
      order_id: order.orderNumber,
      order_date: orderDate,
      pickup_location: PICKUP_LOCATION,
      billing_customer_name: billName.first,
      billing_last_name: billName.last,
      billing_address: bill.addressLine1,
      billing_address_2: bill.addressLine2,
      billing_city: bill.city,
      billing_pincode: bill.pincode,
      billing_state: bill.state,
      billing_country: bill.country || 'India',
      billing_email: billingEmail,
      billing_phone: to10Digits(bill.phone),
      shipping_is_billing: false,
      shipping_customer_name: shipName.first,
      shipping_last_name: shipName.last,
      shipping_address: ship.addressLine1,
      shipping_address_2: ship.addressLine2,
      shipping_city: ship.city,
      shipping_pincode: ship.pincode,
      shipping_country: ship.country || 'India',
      shipping_state: ship.state,
      shipping_phone: to10Digits(ship.phone),
      order_items: order.items.map((i) => ({
        name: i.name,
        sku: i.sku,
        units: i.quantity,
        selling_price: i.price,
        weight: (i.weight || 0.5) / (i.quantity || 1),
      })),
      payment_method: 'Prepaid',
      sub_total: order.subtotal,
      shipping_charges: order.shippingCharge,
      length: products[0]?.length ?? 10,
      breadth: products[0]?.breadth ?? 10,
      height: products[0]?.height ?? 5,
      weight: order.items.reduce((sum, i) => sum + (i.weight || 0.5), 0),
    });

    await OrderService.setShiprocketResult(orderId, {
      status: 'success',
      shiprocketOrderId: String(sr.order_id),
      shiprocketShipmentId: String(sr.shipment_id),
    });
    console.log(`[shiprocket] order ${order.orderNumber} synced (sr_order=${sr.order_id})`);
  } catch (err: any) {
    console.error(`[shiprocket] order ${order.orderNumber} sync FAILED:`, err?.message);
    await OrderService.setShiprocketResult(orderId, {
      status: 'failed',
      error: err?.message || 'Unknown Shiprocket error',
    }).catch(() => {});
  }
}

// Helper: resolve internal MongoDB user _id from Firebase UID
async function resolveUserId(firebaseUid: string): Promise<string> {
  const user = await User.findOne({ firebaseUid });
  if (!user) throw new Error('User not found');
  return (user._id as any).toString();
}

export const getShippingRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deliveryPincode, items } = req.body as {
      deliveryPincode: string;
      items: Array<{ productId: string; quantity: number }>;
    };

    if (!PICKUP_POSTCODE) {
      res.status(500).json({ success: false, message: 'Pickup postcode not configured on server' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'At least one order item is required' });
      return;
    }
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const quote = await getCheapestShippingQuote(items, products, deliveryPincode);

    res.status(200).json({
      success: true,
      message: 'Shipping rates fetched successfully',
      data: {
        rates: quote.rates,
        totalWeight: quote.totalWeight,
        selectedRate: quote.selectedRate,
        shippingCharge: quote.shippingCharge,
      },
    });
  } catch (error: any) {
    console.error('Get shipping rates error:', error);
    const unavailable = String(error.message || '').includes('No Shiprocket courier');
    res.status(unavailable ? 422 : 500).json({ success: false, message: error.message || 'Failed to fetch shipping rates' });
  }
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  // Multi-document transactions need a replica set / mongos. On a standalone
  // MongoDB they throw "Transaction numbers are only allowed on a replica set
  // member or mongos", so fall back to non-transactional writes there. We still
  // create a session and pass it through, so wallet/order writes share it and
  // the wallet service doesn't spin up its own (failing) internal transaction.
  const useTxn = await supportsTransactions();
  const session = await mongoose.startSession();
  if (useTxn) session.startTransaction();

  try {
    const userId = await resolveUserId(req.user!.uid);

    const {
      items,
      shippingAddress,
      billingAddress,
      notes,
      paymentMethod = 'wallet',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body as {
      items: Array<{ productId: string; quantity: number; price: number; variant?: Record<string, any> }>;
      shippingAddress: IEmbeddedAddress;
      billingAddress: IEmbeddedAddress;
      shippingCharge?: number;
      notes?: string;
      paymentMethod?: 'wallet' | 'razorpay';
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    // Razorpay checkout is persisted before payment. Finalize that exact order.
    if (paymentMethod === 'razorpay') {
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        if (useTxn) await session.abortTransaction();
        res.status(400).json({ success: false, message: 'Razorpay payment details are incomplete.' });
        return;
      }
      const pending = await Order.findOne({ razorpayOrderId, userId });
      if (!pending) {
        if (useTxn) await session.abortTransaction();
        res.status(404).json({ success: false, message: 'Pending checkout not found. Please contact support with your payment ID.' });
        return;
      }
      if (pending.status === OrderStatus.CONFIRMED && pending.razorpayPaymentId === razorpayPaymentId) {
        if (useTxn) await session.abortTransaction();
        res.status(200).json({ success: true, message: 'Order already confirmed', data: pending });
        return;
      }
      const paymentAlreadyLinked = await Order.findOne({ razorpayPaymentId, _id: { $ne: pending._id } });
      if (paymentAlreadyLinked) {
        if (useTxn) await session.abortTransaction();
        res.status(409).json({ success: false, message: 'This Razorpay payment is already linked to another order.' });
        return;
      }
      const validSignature = RazorpayService.verifyPaymentSignature(razorpayOrderId || '', razorpayPaymentId || '', razorpaySignature || '');
      const payment = validSignature ? await RazorpayService.getPayment(razorpayPaymentId || '') : null;
      if (!validSignature || payment?.status !== 'captured' || payment?.order_id !== razorpayOrderId ||
          Number(payment?.amount || 0) !== Math.round(pending.total * 100)) {
        if (useTxn) await session.abortTransaction();
        res.status(400).json({ success: false, message: 'Payment verification failed or amount mismatch' });
        return;
      }
      const confirmed = await Order.findOneAndUpdate(
        { _id: pending._id, status: OrderStatus.PENDING, razorpayOrderId },
        { $set: { status: OrderStatus.CONFIRMED, paymentStatus: 'paid', razorpayPaymentId } },
        { new: true }
      );
      const finalOrder = confirmed || await Order.findOne({ razorpayOrderId, razorpayPaymentId });
      if (!finalOrder) {
        res.status(409).json({ success: false, message: 'Payment received; order confirmation is processing. Please refresh your orders.' });
        return;
      }
      if (confirmed) pushOrderToShiprocket(confirmed).catch(() => {});
      if (useTxn && session.inTransaction()) await session.abortTransaction();
      res.status(200).json({ success: true, message: 'Order placed successfully', data: finalOrder });
      return;
    }

    // Enrich items with product name, sku, weight — and compute the price
    // server-side (never trust the client-sent price).
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const buyer = await resolvePricingContext(req.user!.uid);
    const campaignPercents = await DiscountCampaignService.getActiveCategoryPercents();

    // Total quantity per category across the order — retailer category-discount
    // slabs are matched against this (whole-cart), not the per-line quantity.
    const categoryTotals = new Map<string, number>();
    const subCategoryTotals = new Map<string, number>();
    for (const item of items) {
      const product = products.find((p) => (p._id as any).toString() === item.productId);
      if (!product) continue;
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
      const key = String(product.category);
      // Combined quantity includes every product in this parent category,
      // including products covered by dedicated subcategory prices. The parent
      // "remaining subcategories" slab supplies the shared activation threshold.
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + qty);

      for (const subCategoryId of (product.subCategories || []).map((id: any) => String(id))) {
        subCategoryTotals.set(subCategoryId, (subCategoryTotals.get(subCategoryId) || 0) + qty);
      }
    }

    const orderItems: IOrderItem[] = items.map((item) => {
      const product = products.find((p) => (p._id as any).toString() === item.productId);
      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
      const price = getEffectiveUnitPrice(product, quantity, {
        role: buyer.role,
        retailerId: buyer.retailerId,
        retailerCategoryDiscounts: buyer.retailerCategoryDiscounts,
        retailerProductPrices: buyer.retailerProductPrices,
        categoryCampaignPercent: campaignPercents.get(String(product.category)) || 0,
        categoryQuantity: categoryTotals.get(String(product.category)) || quantity,
        subCategoryQuantities: Object.fromEntries((product.subCategories || []).map((id: any) => [String(id), subCategoryTotals.get(String(id)) || 0])),
      });
      return {
        productId: new mongoose.Types.ObjectId(item.productId),
        name: product.name,
        sku: product.sku,
        quantity,
        price,
        variant: item.variant,
        weight: (product.weight ?? 0.5) * quantity,
      };
    });

    const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    // Always calculate shipping on the server; never trust a browser-supplied fee.
    const shippingQuote = await getCheapestShippingQuote(items, products, shippingAddress.pincode);
    const safeShipping = shippingQuote.shippingCharge;
    const total = subtotal + safeShipping;

    // 1. Insufficient-balance pre-check (read-only) for wallet payments, so we
    //    never create an order the customer can't pay for. Reports the actual
    //    figures the order sees for an unambiguous error.
    if (paymentMethod === 'wallet') {
      const availableBalance = await WalletService.getWalletBalance(userId, 'user');
      console.log(
        `[createOrder] wallet check — user=${userId} available=${availableBalance} required=${total}`
      );
      if (availableBalance === null || availableBalance < total) {
        if (useTxn) await session.abortTransaction();
        res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance',
          insufficientBalance: true,
          available: availableBalance ?? 0,
          required: total,
        });
        return;
      }
    }

    // 2. Create the order first, so a failure here never debits the wallet.
    const order = await OrderService.createOrder(
      userId,
      {
        items: orderItems,
        shippingAddress,
        billingAddress,
        subtotal,
        shippingCharge: safeShipping,
        total,
        notes,
        paymentMethod,
        razorpayOrderId,
        razorpayPaymentId,
      },
      session
    );

    // 3. Take payment: debit the wallet (razorpay already paid + verified above).
    //    Without a transaction (standalone Mongo) we can't roll back, so if the
    //    debit fails we compensate by deleting the order we just created.
    let walletTransactionId: mongoose.Types.ObjectId | undefined;
    if (paymentMethod === 'wallet') {
      try {
        const { transaction } = await WalletService.recordPurchase(
          userId,
          'user',
          total,
          `Payment for order`,
          {},
          session
        );
        walletTransactionId = transaction._id as mongoose.Types.ObjectId;
      } catch (debitErr) {
        if (!useTxn) {
          await OrderService.deleteOrderById((order._id as any).toString()).catch(() => {});
        }
        throw debitErr; // the outer catch aborts the transaction when useTxn
      }
      await order.updateOne({ walletTransactionId }, { session });
    }

    if (useTxn) await session.commitTransaction();

    // Create an idempotent pending order-incentive entry for an attributed wholesaler.
    // The entry becomes payable only after delivery; cancellation/return reverses it.
    try {
      const retailer = await RetailerService.getRetailerByFirebaseUid(req.user!.uid);
      if (retailer?.referredBySalesmanId) {
        const salesman = await Salesman.findOne({ _id: retailer.referredBySalesmanId, status: 'active' });
        if (salesman) {
          const incentiveAmount = salesman.orderIncentiveMode === 'percentage'
            ? Math.round((subtotal * salesman.orderIncentiveValue / 100) * 100) / 100
            : salesman.orderIncentiveValue;
          await IncentiveLedgerEntry.updateOne(
            { idempotencyKey: `order:${String(order._id)}` },
            { $setOnInsert: {
              salesmanId: salesman._id,
              type: 'order',
              status: 'pending',
              retailerId: retailer._id,
              orderId: order._id,
              orderNumber: order.orderNumber,
              eligibleOrderValue: subtotal,
              amount: incentiveAmount,
              idempotencyKey: `order:${String(order._id)}`,
              description: 'Order incentive pending delivery',
            } },
            { upsert: true },
          );
          await order.updateOne({ incentiveSalesmanId: salesman._id });
        }
      }
    } catch (incentiveError) {
      // Do not fail a paid order because the incentive ledger had a temporary error.
      console.error('Order incentive ledger creation failed:', incentiveError);
    }

    // Push to Shiprocket AFTER commit — fire-and-forget, but the outcome is now
    // recorded on the order (shiprocketSyncStatus / shiprocketError) so a
    // failure is visible in admin and retryable, not silently lost.
    pushOrderToShiprocket(order).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order,
    });
  } catch (error: any) {
    if (useTxn && session.inTransaction()) await session.abortTransaction();
    console.error('Create order error:', error);

    if (error.message === 'Insufficient wallet balance') {
      res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        insufficientBalance: true,
      });
      return;
    }

    if (error.message === 'PRODUCT_NOT_FOUND') {
      res.status(400).json({ success: false, message: 'One or more products no longer exist' });
      return;
    }

    if (error.message === 'User not found') {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (String(error.message || '').includes('Shiprocket courier') || String(error.message || '').includes('pickup postcode')) {
      res.status(422).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to place order' });
  } finally {
    session.endSession();
  }
};

/**
 * Create a Razorpay order for the current cart so the client can open Razorpay
 * checkout. A single pending order is persisted before payment and reused on retries.
 * POST /api/v1/orders/razorpay/create-order
 */
export const createRazorpayCheckoutOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    const { items, shippingAddress, billingAddress, notes, checkoutSessionId } = req.body as {
      items: Array<{ productId: string; quantity: number; variant?: Record<string, any> }>;
      shippingAddress: IEmbeddedAddress;
      billingAddress: IEmbeddedAddress;
      notes?: string;
      checkoutSessionId: string;
    };

    if (!Array.isArray(items) || items.length === 0 || !shippingAddress || !billingAddress ||
        typeof checkoutSessionId !== 'string' || checkoutSessionId.trim().length < 16 || checkoutSessionId.length > 128) {
      res.status(400).json({ success: false, message: 'No items to pay for' });
      return;
    }

    // Compute the amount server-side (same effective pricing as createOrder), so
    // the Razorpay order amount can't be tampered with by the client.
    const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } });
    const buyer = await resolvePricingContext(req.user!.uid);
    const campaignPercents = await DiscountCampaignService.getActiveCategoryPercents();

    const categoryTotals = new Map<string, number>();
    const subCategoryTotals = new Map<string, number>();
    for (const item of items) {
      const product = products.find((p) => (p._id as any).toString() === item.productId);
      if (!product) continue;
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
      const key = String(product.category);
      // Match createOrder: all products in the same parent category count
      // toward the shared quantity threshold, including selected subcategories.
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + qty);
      for (const subCategoryId of (product.subCategories || []).map((id: any) => String(id))) {
        subCategoryTotals.set(subCategoryId, (subCategoryTotals.get(subCategoryId) || 0) + qty);
      }
    }

    let subtotal = 0;
    for (const item of items) {
      const product = products.find((p) => (p._id as any).toString() === item.productId);
      if (!product) {
        res.status(400).json({ success: false, message: 'One or more products no longer exist' });
        return;
      }
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
      subtotal += getEffectiveUnitPrice(product, quantity, {
        role: buyer.role,
        retailerId: buyer.retailerId,
        retailerCategoryDiscounts: buyer.retailerCategoryDiscounts,
        retailerProductPrices: buyer.retailerProductPrices,
        categoryCampaignPercent: campaignPercents.get(String(product.category)) || 0,
        categoryQuantity: categoryTotals.get(String(product.category)) || quantity,
        subCategoryQuantities: Object.fromEntries((product.subCategories || []).map((id: any) => [String(id), subCategoryTotals.get(String(id)) || 0])),
      }) * quantity;
    }

    // Calculate the same authoritative Shiprocket charge before creating the Razorpay amount.
    const shippingQuote = await getCheapestShippingQuote(items, products, shippingAddress.pincode);
    const shippingCharge = shippingQuote.shippingCharge;
    const total = subtotal + shippingCharge;
    if (total <= 0) {
      res.status(400).json({ success: false, message: 'Invalid order total' });
      return;
    }

    const orderItems: IOrderItem[] = items.map((item) => {
      const product = products.find((p) => (p._id as any).toString() === item.productId)!;
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
      const price = getEffectiveUnitPrice(product, quantity, {
        role: buyer.role,
        retailerId: buyer.retailerId,
        retailerCategoryDiscounts: buyer.retailerCategoryDiscounts,
        retailerProductPrices: buyer.retailerProductPrices,
        categoryCampaignPercent: campaignPercents.get(String(product.category)) || 0,
        categoryQuantity: categoryTotals.get(String(product.category)) || quantity,
        subCategoryQuantities: Object.fromEntries((product.subCategories || []).map((id: any) => [String(id), subCategoryTotals.get(String(id)) || 0])),
      });
      return { productId: new mongoose.Types.ObjectId(item.productId), name: product.name, sku: product.sku, quantity, price, variant: item.variant, weight: (product.weight ?? 0.5) * quantity };
    });

    // The same browser checkout session must always resolve to one Mongo order
    // and one Razorpay order, even when the customer double-clicks or retries.
    const checkoutFingerprint = crypto.createHash('sha256').update(JSON.stringify({
      items: orderItems.map((item) => ({
        productId: String(item.productId), quantity: item.quantity, variant: item.variant || null,
      })),
      shippingAddress, billingAddress, subtotal, shippingCharge, total, notes: notes || '',
    })).digest('hex');

    const respondWithExistingCheckout = async (existing: IOrder): Promise<void> => {
      if (existing.checkoutFingerprint !== checkoutFingerprint) {
        res.status(409).json({ success: false, message: 'Checkout details changed. Please restart checkout.' });
        return;
      }
      if (existing.paymentStatus === 'paid' || existing.status === OrderStatus.CONFIRMED) {
        res.status(200).json({
          success: true,
          data: { alreadyPaid: true, orderId: String(existing._id), orderNumber: existing.orderNumber },
        });
        return;
      }
      if (existing.status === OrderStatus.CANCELLED || !existing.razorpayOrderId) {
        res.status(409).json({ success: false, message: 'This checkout is no longer active. Please restart checkout.' });
        return;
      }
      const existingGatewayOrder = await RazorpayService.getOrder(existing.razorpayOrderId);
      res.status(200).json({
        success: true,
        data: {
          orderId: existingGatewayOrder.id,
          amount: existingGatewayOrder.amount,
          currency: existingGatewayOrder.currency,
          keyId: process.env.RAZORPAY_KEY_ID,
        },
      });
    };

    const existingCheckout = await Order.findOne({ userId, checkoutSessionId: checkoutSessionId.trim() });
    if (existingCheckout) {
      await respondWithExistingCheckout(existingCheckout);
      return;
    }

    const amountInPaise = Math.round(total * 100);
    const receipt = `ord_${userId.slice(-8)}_${Date.now()}`.slice(0, 40);
    const gatewayOrder = await RazorpayService.createOrder(amountInPaise, 'INR', receipt, { userId, checkoutSessionId: checkoutSessionId.trim() });
    try {
      await Order.create({
        userId: new mongoose.Types.ObjectId(userId), items: orderItems, shippingAddress, billingAddress,
        subtotal, shippingCharge, total, notes, paymentMethod: 'razorpay',
        razorpayOrderId: gatewayOrder.id, checkoutSessionId: checkoutSessionId.trim(),
        checkoutFingerprint, paymentStatus: 'pending', status: OrderStatus.PENDING,
      });
    } catch (createError: any) {
      // Concurrent duplicate requests can both reach Razorpay. The unique
      // checkoutSessionId index ensures only one pending Mongo order survives.
      if (createError?.code !== 11000) throw createError;
      const racedCheckout = await Order.findOne({ userId, checkoutSessionId: checkoutSessionId.trim() });
      if (!racedCheckout) throw createError;
      await respondWithExistingCheckout(racedCheckout);
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: gatewayOrder.id,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error: any) {
    console.error('Error creating Razorpay checkout order:', error);
    const unavailable = String(error.message || '').includes('No Shiprocket courier') ||
      String(error.message || '').includes('pickup postcode');
    res.status(unavailable ? 422 : 500).json({
      success: false,
      message: unavailable ? error.message : 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** Recover captured payments even if the customer closes the browser. */
export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const signature = req.header('x-razorpay-signature') || '';
  if (!rawBody || !RazorpayService.verifyWebhookSignature(rawBody, signature)) {
    res.status(400).json({ success: false, message: 'Invalid Razorpay webhook signature' });
    return;
  }
  res.status(200).json({ success: true });
  try {
    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    const orderId = payment?.order_id || req.body?.payload?.order?.entity?.id;
    const paymentId = payment?.id;
    if (!orderId || !paymentId) return;
    if (event === 'payment.failed') {
      await Order.updateOne(
        { razorpayOrderId: orderId, status: OrderStatus.PENDING, paymentStatus: { $ne: 'paid' } },
        { $set: { paymentStatus: 'failed' } },
      );
      return;
    }
    if (event !== 'payment.captured' && event !== 'order.paid') return;
    if (payment?.status && payment.status !== 'captured') return;
    const pending = await Order.findOne({ razorpayOrderId: orderId });
    if (!pending) {
      console.error(`[razorpay webhook] captured payment ${paymentId} has no matching pending order ${orderId}`);
      return;
    }
    if (Number(payment?.amount || 0) !== Math.round(pending.total * 100) || (payment?.currency && payment.currency !== 'INR')) {
      console.error(`[razorpay webhook] amount/currency mismatch for order ${orderId}`);
      return;
    }
    const paymentAlreadyLinked = await Order.findOne({ razorpayPaymentId: paymentId, _id: { $ne: pending._id } });
    if (paymentAlreadyLinked) {
      console.error(`[razorpay webhook] payment ${paymentId} is already linked to order ${paymentAlreadyLinked.orderNumber}`);
      return;
    }
    const confirmed = await Order.findOneAndUpdate(
      { _id: pending._id, status: OrderStatus.PENDING },
      { $set: { status: OrderStatus.CONFIRMED, paymentStatus: 'paid', razorpayPaymentId: paymentId } },
      { new: true }
    );
    if (confirmed) pushOrderToShiprocket(confirmed).catch(() => {});
  } catch (error: any) {
    console.error('[razorpay webhook] processing failed:', error?.message || error);
  }
};

export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await OrderService.getUserOrders(userId, page, limit);

    res.status(200).json({
      success: true,
      message: 'Orders fetched successfully',
      data: result.orders,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch orders' });
  }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    const order = await OrderService.getOrderById(req.params.id, userId);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Order fetched successfully',
      data: order,
    });
  } catch (error: any) {
    if (error.message === 'User not found') {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(500).json({ success: false, message: error.message || 'Failed to fetch order' });
  }
};

export const getAdminOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await OrderService.getOrderById(req.params.id, undefined, true);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Order fetched successfully',
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch order' });
  }
};

export const getAllOrdersAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;

    const result = await OrderService.getAllOrders(page, limit, status);

    res.status(200).json({
      success: true,
      message: 'Orders fetched successfully',
      data: result.orders,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch orders' });
  }
};

export const updateAdminOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body as { status: Parameters<typeof OrderService.updateOrderStatusById>[1] };
    const currentOrder = await Order.findById(req.params.id);
    if (!currentOrder) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    const isUnpaidRazorpay = currentOrder.paymentMethod === 'razorpay' &&
      (currentOrder.paymentStatus ? currentOrder.paymentStatus !== 'paid' : currentOrder.status === OrderStatus.PENDING);
    if (isUnpaidRazorpay && status !== OrderStatus.CANCELLED) {
      res.status(409).json({ success: false, message: 'Cannot process an unpaid Razorpay order. Verify payment first or cancel the order.' });
      return;
    }
    const order = await OrderService.updateOrderStatusById(req.params.id, status);

    if (order) {
      try {
        const ledger = await IncentiveLedgerEntry.findOne({ idempotencyKey: `order:${String(order._id)}` });
        if (ledger && ledger.status !== 'paid' && ledger.status !== 'reversed') {
          if (status === 'delivered') ledger.status = 'payable';
          else if (status === 'cancelled' || status === 'returned') {
            ledger.status = 'reversed';
            ledger.description = [ledger.description, `Automatically reversed: order ${status}`].filter(Boolean).join(' | ').slice(0, 500);
          }
          await ledger.save();
        }
      } catch (incentiveError) {
        console.error('Order incentive status update failed:', incentiveError);
      }
    }

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update order status' });
  }
};

// Shiprocket webhook status mapping
const SHIPROCKET_STATUS_MAP: Record<string, string> = {
  'Pickup Pending': 'processing',
  'Pickup Scheduled': 'processing',
  'Pickup Generated': 'processing',
  'In Transit': 'shipped',
  'Shipped': 'shipped',
  'Out For Delivery': 'out_for_delivery',
  'Delivered': 'delivered',
  'Cancelled': 'cancelled',
  'RTO': 'returned',
  'RTO Delivered': 'returned',
  'Return': 'returned',
};

export const shiprocketWebhook = async (req: Request, res: Response): Promise<void> => {
  // Always acknowledge immediately to prevent Shiprocket retries
  res.status(200).json({ success: true });

  try {
    const payload = req.body;
    const awb: string | undefined = payload?.awb || payload?.shipment_track?.[0]?.awb_code;
    const currentStatus: string | undefined = payload?.current_status || payload?.shipment_track?.[0]?.current_status;

    if (!awb || !currentStatus) {
      console.log('Shiprocket webhook: missing awb or current_status', payload);
      return;
    }

    const mappedStatus = SHIPROCKET_STATUS_MAP[currentStatus];
    if (!mappedStatus) {
      console.log(`Shiprocket webhook: unknown status "${currentStatus}", skipping`);
      return;
    }

    const estimatedDate = payload?.etd ? new Date(payload.etd) : undefined;
    const courierName = payload?.courier_name || payload?.shipment_track?.[0]?.courier_name;

    const updatedOrder = await OrderService.updateOrderStatus(awb, {
      status: mappedStatus as any,
      courierName,
      estimatedDeliveryDate: estimatedDate,
    });

    // Keep the incentive ledger in sync when delivery/return arrives from Shiprocket.
    // The admin status endpoint has the same rules; paid/reversed entries stay immutable.
    if (updatedOrder && ['delivered', 'cancelled', 'returned'].includes(mappedStatus)) {
      try {
        const ledger = await IncentiveLedgerEntry.findOne({
          idempotencyKey: `order:${String(updatedOrder._id)}`,
        });
        if (ledger && ledger.status !== 'paid' && ledger.status !== 'reversed') {
          if (mappedStatus === 'delivered') {
            ledger.status = 'payable';
          } else {
            ledger.status = 'reversed';
            ledger.description = [
              ledger.description,
              `Automatically reversed: Shiprocket order ${mappedStatus}`,
            ].filter(Boolean).join(' | ').slice(0, 500);
          }
          await ledger.save();
        }
      } catch (incentiveError) {
        console.error('Shiprocket incentive ledger status update failed:', incentiveError);
      }
    }

    console.log(`Shiprocket webhook: updated order with AWB ${awb} to status ${mappedStatus}`);
  } catch (error: any) {
    console.error('Shiprocket webhook processing error (non-fatal):', error.message);
  }
};

/**
 * Admin: retry pushing an order to Shiprocket after a failed sync.
 * POST /api/v1/orders/admin/:id/shiprocket-retry
 */
export const retryShiprocketSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await OrderService.getOrderById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    if (order.shiprocketOrderId) {
      res.status(400).json({ success: false, message: 'Order is already synced to Shiprocket', data: order });
      return;
    }
    if (order.status === OrderStatus.PENDING || order.status === OrderStatus.CANCELLED || order.status === OrderStatus.RETURNED ||
        (order.paymentMethod === 'razorpay' && Boolean(order.paymentStatus) && order.paymentStatus !== 'paid')) {
      res.status(400).json({ success: false, message: 'Only confirmed, paid orders can be synced to Shiprocket', data: order });
      return;
    }

    await pushOrderToShiprocket(order, true);
    const updated = await OrderService.getOrderById(id);

    if (updated?.shiprocketSyncStatus === 'success') {
      res.status(200).json({ success: true, message: 'Order synced to Shiprocket', data: updated });
    } else if (updated?.shiprocketSyncStatus === 'processing') {
      res.status(202).json({ success: true, message: 'Shiprocket sync is already in progress', data: updated });
    } else {
      res.status(502).json({
        success: false,
        message: updated?.shiprocketError || 'Shiprocket sync failed',
        data: updated,
      });
    }
  } catch (error: any) {
    console.error('Retry Shiprocket sync error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to retry Shiprocket sync' });
  }
};
