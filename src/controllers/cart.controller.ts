import { Request, Response } from 'express';
import Cart from '../models/cart.model';

const MAX_LINE_ITEMS = 500;

export const getMyCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const firebaseUid = req.user?.uid;
    if (!firebaseUid) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const cart = await Cart.findOne({ firebaseUid }).lean();
    res.status(200).json({
      success: true,
      data: { items: Array.isArray(cart?.items) ? cart.items : [] },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to load cart' });
  }
};

export const saveMyCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const firebaseUid = req.user?.uid;
    if (!firebaseUid) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const items = req.body?.items;
    if (!Array.isArray(items) || items.length > MAX_LINE_ITEMS) {
      res.status(400).json({
        success: false,
        message: `Cart items must be an array with at most ${MAX_LINE_ITEMS} line items`,
      });
      return;
    }

    // Keep cart data scoped to the verified Firebase UID; never accept a UID from the body.
    const safeItems = items.filter((item: any) =>
      item && typeof item === 'object' && !Array.isArray(item) &&
      typeof item.id === 'string' && Number.isFinite(Number(item.quantity)) &&
      Number(item.quantity) >= 1 && Number(item.quantity) <= 10000
    );

    if (safeItems.length !== items.length) {
      res.status(400).json({ success: false, message: 'One or more cart items are invalid' });
      return;
    }

    const cart = await Cart.findOneAndUpdate(
      { firebaseUid },
      { $set: { items: safeItems } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    res.status(200).json({
      success: true,
      data: { items: Array.isArray(cart?.items) ? cart.items : [] },
    });
  } catch (error) {
    console.error('Save cart error:', error);
    res.status(500).json({ success: false, message: 'Failed to save cart' });
  }
};
