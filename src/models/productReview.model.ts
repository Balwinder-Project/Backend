import mongoose, { Document, Schema } from 'mongoose';

export interface IProductReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  comment: string;
  status: 'pending' | 'approved' | 'hidden';
  verifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productReviewSchema = new Schema<IProductReview>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true, maxlength: 120 },
  comment: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['pending', 'approved', 'hidden'], default: 'pending', index: true },
  verifiedPurchase: { type: Boolean, default: true },
}, { timestamps: true });

productReviewSchema.index({ orderId: 1, productId: 1, userId: 1 }, { unique: true });
productReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });

const ProductReview = mongoose.model<IProductReview>('ProductReview', productReviewSchema);
export default ProductReview;
