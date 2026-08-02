import mongoose, { Document, Schema } from 'mongoose';

export interface IWishlistItem extends Document {
  firebaseUid: string;
  productId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const wishlistSchema = new Schema<IWishlistItem>(
  {
    firebaseUid: {
      type: String,
      required: [true, 'Firebase UID is required'],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id, ...rest };
      },
    },
  }
);

// One wishlist entry per user+product
wishlistSchema.index({ firebaseUid: 1, productId: 1 }, { unique: true });

const WishlistItem = mongoose.model<IWishlistItem>('WishlistItem', wishlistSchema);

export default WishlistItem;
