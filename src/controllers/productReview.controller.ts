import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ProductReview from '../models/productReview.model';
import Product from '../models/product.model';
import Order, { OrderStatus } from '../models/order.model';
import User from '../models/user.model';

const summaries = async (productIds: mongoose.Types.ObjectId[]) => {
  const rows = await ProductReview.aggregate([
    { $match: { productId: { $in: productIds }, status: 'approved' } },
    { $group: { _id: '$productId', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);
  return rows;
};

export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const sort = req.query.sort === 'highest' ? { rating: -1, createdAt: -1 } : req.query.sort === 'lowest' ? { rating: 1, createdAt: -1 } : { createdAt: -1 };
    const [reviews, total, summary] = await Promise.all([
      ProductReview.find({ productId, status: 'approved' }).populate('userId', 'name profilePicture').sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      ProductReview.countDocuments({ productId, status: 'approved' }),
      summaries([new mongoose.Types.ObjectId(productId)]),
    ]);
    const ratingBreakdown = await ProductReview.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    res.json({ success: true, data: reviews, summary: summary[0] || { averageRating: 0, reviewCount: 0 }, ratingBreakdown, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message || 'Failed to fetch reviews' }); }
};

export const createProductReview = async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { productId, orderId, rating, title, comment } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ success: false, message: 'Valid product and order IDs are required' });
    const stars = Number(rating);
    const body = typeof comment === 'string' ? comment.trim() : '';
    if (!Number.isInteger(stars) || stars < 1 || stars > 5 || body.length < 5 || body.length > 3000) return res.status(400).json({ success: false, message: 'Rating must be 1–5 and review text must be 5–3000 characters' });
    const user = await User.findOne({ firebaseUid: uid });
    if (!user) return res.status(404).json({ success: false, message: 'Customer account not found' });
    const order = await Order.findOne({ _id: orderId, userId: user._id, paymentStatus: 'paid', status: OrderStatus.DELIVERED });
    if (!order || !order.items.some((item: any) => String(item.productId) === String(productId))) return res.status(403).json({ success: false, message: 'Only customers with a paid, delivered order containing this product can review it' });
    const review = await ProductReview.create({ productId, userId: user._id, orderId, rating: stars, title: typeof title === 'string' ? title.trim().slice(0,120) : '', comment: body, verifiedPurchase: true, status: 'pending' });
    res.status(201).json({ success: true, message: 'Review submitted for moderation', data: review });
  } catch (error: any) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'A review for this product and order already exists' });
    res.status(500).json({ success: false, message: error.message || 'Failed to submit review' });
  }
};

export const listAdminReviews = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter: any = {};
    if (req.query.status && ['pending','approved','hidden'].includes(String(req.query.status))) filter.status = req.query.status;
    if (req.query.productId && mongoose.Types.ObjectId.isValid(String(req.query.productId))) filter.productId = req.query.productId;
    const [reviews,total] = await Promise.all([
      ProductReview.find(filter).populate('productId','name sku').populate('userId','name email').populate('orderId','orderNumber status paymentStatus').sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),
      ProductReview.countDocuments(filter),
    ]);
    res.json({ success:true, data:reviews, page, total, totalPages:Math.ceil(total/limit) });
  } catch (error:any) { res.status(500).json({success:false,message:error.message||'Failed to list reviews'}); }
};

export const moderateReview = async (req: Request, res: Response) => {
  try {
    const status = req.body?.status;
    if (!['approved','hidden'].includes(status)) return res.status(400).json({success:false,message:'Status must be approved or hidden'});
    const review = await ProductReview.findByIdAndUpdate(req.params.id, { status }, { new:true }).populate('productId','name sku').populate('userId','name email');
    if (!review) return res.status(404).json({success:false,message:'Review not found'});
    res.json({success:true,data:review});
  } catch (error:any) { res.status(500).json({success:false,message:error.message||'Failed to moderate review'}); }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const review = await ProductReview.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({success:false,message:'Review not found'});
    res.json({success:true,message:'Review deleted'});
  } catch (error:any) { res.status(500).json({success:false,message:error.message||'Failed to delete review'}); }
};

export const getProductReviewSummaries = async (req: Request, res: Response) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter(mongoose.Types.ObjectId.isValid);
    if (!ids.length) return res.json({success:true,data:[]});
    const rows = await summaries(ids.map(id=>new mongoose.Types.ObjectId(id)));
    res.json({success:true,data:rows});
  } catch (error:any) { res.status(500).json({success:false,message:error.message||'Failed to fetch rating summaries'}); }
};
