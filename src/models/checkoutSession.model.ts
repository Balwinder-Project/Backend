import mongoose, { Document, Schema } from 'mongoose';
import { IEmbeddedAddress, IOrderItem } from './order.model';

export interface ICheckoutSession extends Document {
  userId: mongoose.Types.ObjectId;
  checkoutSessionId: string;
  checkoutFingerprint: string;
  items: IOrderItem[];
  shippingAddress: IEmbeddedAddress;
  billingAddress: IEmbeddedAddress;
  subtotal: number;
  shippingCharge: number;
  total: number;
  notes?: string;
  razorpayOrderId: string;
  status: 'pending' | 'paid' | 'failed' | 'processing';
  razorpayPaymentId?: string;
  finalOrderId?: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const checkoutItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  variant: { type: Schema.Types.Mixed },
  weight: { type: Number, required: true, default: 0.5 },
}, { _id: false });

const checkoutSessionSchema = new Schema<ICheckoutSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  checkoutSessionId: { type: String, required: true, unique: true },
  checkoutFingerprint: { type: String, required: true },
  items: { type: [checkoutItemSchema], required: true },
  shippingAddress: { type: Schema.Types.Mixed, required: true },
  billingAddress: { type: Schema.Types.Mixed, required: true },
  subtotal: { type: Number, required: true },
  shippingCharge: { type: Number, required: true },
  total: { type: Number, required: true },
  notes: { type: String },
  razorpayOrderId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'processing'], default: 'pending', index: true },
  razorpayPaymentId: { type: String },
  finalOrderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

checkoutSessionSchema.index({ userId: 1, checkoutSessionId: 1 }, { unique: true });
export default mongoose.models.CheckoutSession ||
  mongoose.model<ICheckoutSession>('CheckoutSession', checkoutSessionSchema);
