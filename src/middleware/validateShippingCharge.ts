import { NextFunction, Request, Response } from 'express';
import Product from '../models/product.model';
import { ShiprocketService } from '../services/shiprocket.service';

const PICKUP_POSTCODE = process.env.SHIPROCKET_PICKUP_POSTCODE || '';

/**
 * Re-check the selected Shiprocket courier and price on the server.
 * The browser may display/send a rate, but it is never trusted as the source
 * of truth for the amount charged to the customer.
 */
export const validateShippingCharge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!PICKUP_POSTCODE) {
      res.status(500).json({ success: false, message: 'Pickup postcode not configured on server' });
      return;
    }

    const items = req.body?.items;
    const deliveryPincode = String(req.body?.deliveryPincode || req.body?.shippingAddress?.pincode || '').replace(/\D/g, '');
    const requestedCharge = Number(req.body?.shippingCharge);
    const courierCompanyId = req.body?.courierCompanyId;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Items are required for shipping validation' });
      return;
    }
    if (!/^\d{6}$/.test(deliveryPincode)) {
      res.status(400).json({ success: false, message: 'Invalid delivery pincode' });
      return;
    }
    if (!Number.isFinite(requestedCharge) || requestedCharge < 0) {
      res.status(400).json({ success: false, message: 'Invalid shipping charge' });
      return;
    }

    const productIds = items.map((item: any) => String(item.productId || item.id || ''));
    const products = await Product.find({ _id: { $in: productIds } });
    let totalWeight = 0;

    for (const item of items) {
      const productId = String(item.productId || item.id || '');
      const product = products.find((p) => String(p._id) === productId);
      if (!product) {
        res.status(400).json({ success: false, message: 'One or more products no longer exist' });
        return;
      }
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
      totalWeight += (product.weight ?? 0.5) * quantity;
    }

    const rates = await ShiprocketService.getShippingRates(PICKUP_POSTCODE, deliveryPincode, totalWeight);
    if (!rates.length) {
      res.status(400).json({ success: false, message: 'No courier rates found for this location' });
      return;
    }

    const selected = courierCompanyId
      ? rates.find((rate) => String(rate.courier_company_id) === String(courierCompanyId))
      : rates[0];

    if (!selected) {
      res.status(400).json({ success: false, message: 'Selected courier is no longer available. Please recalculate shipping.' });
      return;
    }

    if (Math.abs(Number(selected.rate) - requestedCharge) > 0.01) {
      res.status(409).json({ success: false, message: 'Shipping rate changed. Please recalculate shipping.' });
      return;
    }

    // Replace the client value with the current server value before the order
    // controller calculates the final subtotal + shipping total.
    req.body.shippingCharge = Number(selected.rate);
    req.body.deliveryPincode = deliveryPincode;
    req.body.courierCompanyId = Number(selected.courier_company_id);
    req.body.shippingCourierName = selected.courier_name;
    req.body.shippingEstimatedDeliveryDays = Number(selected.estimated_delivery_days);

    next();
  } catch (error: any) {
    console.error('Shipping validation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to validate shipping charge' });
  }
};
