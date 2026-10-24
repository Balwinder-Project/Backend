import mongoose, { Document, Schema } from 'mongoose';

export interface ICart extends Document {
  firebaseUid: string;
  items: Record<string, any>[];
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<ICart>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    items: {
      type: Array,
      default: [],
      validate: {
        validator: (items: unknown[]) => items.length <= 500,
        message: 'Cart cannot contain more than 500 line items',
      },
    },
  },
  { timestamps: true }
);

const Cart = mongoose.model<ICart>('Cart', cartSchema);
export default Cart;
