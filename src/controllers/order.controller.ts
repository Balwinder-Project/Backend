import { Request, Response } from 'express';
import mongoose from 'mongoose';
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
import { IEmbeddedAddress, IOrder, IOrderItem } from '../models/order.model';

interface BuyerPricing {
  role: PricingRole;
  retailerId: string | null;
  retailerCategoryDiscounts: RetailerCategoryDiscount[];
}

/** Resolve the buyer's pricing role, retailer id, and negotiated category discounts. */
const resolvePricingContext = async (firebaseUid: string): Promise<BuyerPricing> => {
  try {
    const retailer = await RetailerService.getRetailerByFirebaseUid(firebaseUid);
    if (retailer) {
      const retailerCategoryDiscounts: RetailerCategoryDiscount[] = (retailer.categoryDiscounts || []).map(
        (d: any) => ({
          category: String(d.category),
          slabs: (d.slabs || []).map((s: any) => ({
            minQuantity: s.minQuantity,
            discountPercentage: s.discountPercentage,
          })),
        })
      );
      return { role: 'retailer', retailerId: String(retailer._id), retailerCategoryDiscounts };
    }
  } catch {
    /* fall through to normal pricing */
  }
  return { role: 'normal', retailerId: null, retailerCategoryDiscounts: [] };
};

const PICKUP_POSTCODE = process.env.SHIPROCKET_PICKUP_POSTCODE || '';
const PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION_NAME || 'Primary';

/**
 * Push a persisted order to Shiprocket and record the outcome on the order so
 * failures are visible (order.shiprocketSyncStatus / shiprocketError) and can
 * be retried, instead of being silently swallowed. Never throws.
 */
export async function pushOrderToShiprocket(order: IOrder): Promise<void> {
  const orderId = (order._id as any).toString();
  try {
    const productIds = order.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const orderDate = new Date(order.createdAt || Date.now()).toISOString().split('T')[0];
    const bill = order.billingAddress;
    const ship = order.shippingAddress;

    const sr = await ShiprocketService.createOrder({
      order_id: order.orderNumber,
      order_date: orderDate,
      pickup_location: PICKUP_LOCATION,
      billing_customer_name: bill.name,
      billing_address: bill.addressLine1,
      billing_address_2: bill.addressLine2,
      billing_city: bill.city,
      billing_pincode: bill.pincode,
      billing_state: bill.state,
      billing_country: bill.country || 'India',
      billing_phone: bill.phone,
      shipping_is_billing: false,
      shipping_customer_name: ship.name,
      shipping_address: ship.addressLine1,
      shipping_address_2: ship.addressLine2,
      shipping_city: ship.city,
      shipping_pincode: ship.pincode,
      shipping_country: ship.country || 'India',
      shipping_state: ship.state,
      shipping_phone: ship.phone,
      order_items: order.items.map((i) => ({
        name: i.name,
        sku: i.sku,
        units: i.quantity,
        selling_price: i.price,
        weight: (i.weight || 0.5) / (i.quantity || 1),
      })),
      payment_method: 'Prepaid',
      sub_total: order.subtotal,
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

    // Calculate total weight from products
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    let totalWeight = 0;
    for (const item of items) {
      const product = products.find((p) => (p._id as any).toString() === item.productId);
      const weight = product?.weight ?? 0.5;
      totalWeight += weight * item.quantity;
    }

    const rates = await ShiprocketService.getShippingRates(PICKUP_POSTCODE, deliveryPincode, totalWeight);

    res.status(200).json({
      success: true,
      message: 'Shipping rates fetched successfully',
      data: { rates, totalWeight },
    });
  } catch (error: any) {
    console.error('Get shipping rates error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch shipping rates' });
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
      shippingCharge,
      notes,
      paymentMethod = 'wallet',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body as {
      items: Array<{ productId: string; quantity: number; price: number; variant?: Record<string, any> }>;
      shippingAddress: IEmbeddedAddress;
      billingAddress: IEmbeddedAddress;
      shippingCharge: number;
      notes?: string;
      paymentMethod?: 'wallet' | 'razorpay';
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    // Enrich items with product name, sku, weight — and compute the price
    // server-side (never trust the client-sent price).
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const buyer = await resolvePricingContext(req.user!.uid);
    const campaignPercents = await DiscountCampaignService.getActiveCategoryPercents();

    // Total quantity per category across the order — retailer category-discount
    // slabs are matched against this (whole-cart), not the per-line quantity.
    const categoryTotals = new Map<string, number>();
    for (const item of items) {
      const product = products.find((p) => (p._id as any).toString() === item.productId);
      if (!product) continue;
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
      const key = String(product.category);
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + qty);
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
        categoryCampaignPercent: campaignPercents.get(String(product.category)) || 0,
        categoryQuantity: categoryTotals.get(String(product.category)) || quantity,
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
    const safeShipping = Math.max(0, Number(shippingCharge) || 0);
    const total = subtotal + safeShipping;

    // For Razorpay: verify the payment signature AND that the amount actually
    // paid matches this order's total (prevents paying for a cheaper order then
    // submitting expensive items with a valid signature).
    if (paymentMethod === 'razorpay') {
      const validSignature = RazorpayService.verifyPaymentSignature(
        razorpayOrderId || '',
        razorpayPaymentId || '',
        razorpaySignature || ''
      );
      if (!validSignature) {
        if (useTxn) await session.abortTransaction();
        res.status(400).json({ success: false, message: 'Payment verification failed' });
        return;
      }
      const rzpOrder = await RazorpayService.getOrder(razorpayOrderId || '');
      const paidPaise = Number(rzpOrder?.amount || 0);
      if (paidPaise !== Math.round(total * 100)) {
        if (useTxn) await session.abortTransaction();
        res.status(400).json({ success: false, message: 'Paid amount does not match the order total' });
        return;
      }
    }

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

    res.status(500).json({ success: false, message: error.message || 'Failed to place order' });
  } finally {
    session.endSession();
  }
};

/**
 * Create a Razorpay order for the current cart so the client can open Razorpay
 * checkout. The order is only persisted after payment is verified in createOrder.
 * POST /api/v1/orders/razorpay/create-order
 */
export const createRazorpayCheckoutOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req.user!.uid);
    const { items, shippingCharge = 0 } = req.body as {
      items: Array<{ productId: string; quantity: number }>;
      shippingCharge?: number;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'No items to pay for' });
      return;
    }

    // Compute the amount server-side (same effective pricing as createOrder), so
    // the Razorpay order amount can't be tampered with by the client.
    const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } });
    const buyer = await resolvePricingContext(req.user!.uid);
    const campaignPercents = await DiscountCampaignService.getActiveCategoryPercents();

    const categoryTotals = new Map<string, number>();
    for (const item of items) {
      const product = products.find((p) => (p._id as any).toString() === item.productId);
      if (!product) continue;
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
      const key = String(product.category);
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + qty);
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
        categoryCampaignPercent: campaignPercents.get(String(product.category)) || 0,
        categoryQuantity: categoryTotals.get(String(product.category)) || quantity,
      }) * quantity;
    }

    const total = subtotal + Math.max(0, Number(shippingCharge) || 0);
    if (total <= 0) {
      res.status(400).json({ success: false, message: 'Invalid order total' });
      return;
    }

    const amountInPaise = Math.round(total * 100);
    const receipt = `ord_${userId.slice(-8)}_${Math.floor(Date.now() / 1000)}`;
    const order = await RazorpayService.createOrder(amountInPaise, 'INR', receipt, { userId });

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error: any) {
    console.error('Error creating Razorpay checkout order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
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
    const order = await OrderService.updateOrderStatusById(req.params.id, status);

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

    await OrderService.updateOrderStatus(awb, {
      status: mappedStatus as any,
      courierName,
      estimatedDeliveryDate: estimatedDate,
    });

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

    await pushOrderToShiprocket(order);
    const updated = await OrderService.getOrderById(id);

    if (updated?.shiprocketSyncStatus === 'success') {
      res.status(200).json({ success: true, message: 'Order synced to Shiprocket', data: updated });
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
