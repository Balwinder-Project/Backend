import mongoose, { Document, Schema } from 'mongoose';

/**
 * A category-wide percentage discount campaign (e.g. festive sale). While active,
 * every product in `categories` is discounted by `percentage`% for normal
 * customers. Retailers keep their own (wholesale / special) pricing.
 */
export interface IDiscountCampaign extends Document {
  name: string;
  categories: mongoose.Types.ObjectId[];
  percentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const discountCampaignSchema = new Schema<IDiscountCampaign>(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      minlength: [2, 'Campaign name must be at least 2 characters long'],
      maxlength: [120, 'Campaign name cannot exceed 120 characters'],
    },
    categories: {
      type: [Schema.Types.ObjectId],
      ref: 'Category',
      default: [],
    },
    percentage: {
      type: Number,
      required: [true, 'Discount percentage is required'],
      min: [0, 'Percentage cannot be negative'],
      max: [100, 'Percentage cannot exceed 100'],
    },
    isActive: { type: Boolean, default: true },
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

discountCampaignSchema.index({ isActive: 1 });

const DiscountCampaign = mongoose.model<IDiscountCampaign>('DiscountCampaign', discountCampaignSchema);

export default DiscountCampaign;
