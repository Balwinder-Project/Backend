import { Request, Response } from 'express';
import Cart from '../models/cart.model';
import User from '../models/user.model';

const escapeRegex = (value: string) => value.replace(/[.*+?^$()|{}[\]\\]/g, '\\$&');

export const listCustomerCarts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const userFilter: any = {};
    if (search) userFilter.$or = [
      { name: { $regex: escapeRegex(search), $options: 'i' } },
      { email: { $regex: escapeRegex(search), $options: 'i' } },
    ];
    const [users, total] = await Promise.all([
      User.find(userFilter).select('name email profilePicture firebaseUid createdAt').sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(userFilter),
    ]);
    const carts = await Cart.find({ firebaseUid: { $in: users.map((u) => u.firebaseUid) } }).lean();
    const byUid = new Map(carts.map((cart) => [cart.firebaseUid, cart]));
    res.status(200).json({ success: true, data: users.map((user) => {
      const cart = byUid.get(user.firebaseUid);
      const items = Array.isArray(cart?.items) ? cart.items : [];
      return { id: String(user._id), firebaseUid: user.firebaseUid, name: user.name, email: user.email, profilePicture: user.profilePicture, createdAt: user.createdAt, cartUpdatedAt: cart?.updatedAt, itemCount: items.length, totalQuantity: items.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0), items };
    }), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Admin customer carts error:', error);
    res.status(500).json({ success: false, message: 'Failed to load customer carts' });
  }
};

export const getCustomerCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('name email profilePicture firebaseUid createdAt').lean();
    if (!user) { res.status(404).json({ success: false, message: 'Customer not found' }); return; }
    const cart = await Cart.findOne({ firebaseUid: user.firebaseUid }).lean();
    res.status(200).json({ success: true, data: { customer: { id: String(user._id), firebaseUid: user.firebaseUid, name: user.name, email: user.email, profilePicture: user.profilePicture, createdAt: user.createdAt }, items: Array.isArray(cart?.items) ? cart.items : [], updatedAt: cart?.updatedAt || null } });
  } catch (error) {
    console.error('Admin customer cart detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to load customer cart' });
  }
};