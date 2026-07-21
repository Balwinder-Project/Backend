import mongoose, { Document, Schema } from 'mongoose';
import { INDIAN_STATES } from '../constants/indian-states';

/** A quantity slab that grants a percentage discount for a retailer. */
export interface IRetailerCategorySlab {
  minQuantity: number;
  discountPercentage: number;
}

/** Per-category quantity-slab discounts negotiated for a specific retailer. */
export interface IRetailerCategoryDiscount {
  category: mongoose.Types.ObjectId;
  slabs: IRetailerCategorySlab[];
}

export interface IRetailer extends Document {
  name: string;
  city: string;
  state: string;
  pincode: string;
  email: string;
  phone: string;
  firebaseUid: string;
  categoryDiscounts: IRetailerCategoryDiscount[];
  createdAt: Date;
  updatedAt: Date;
}

const retailerSchema = new Schema<IRetailer>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      minlength: [2, 'City must be at least 2 characters long'],
      maxlength: [100, 'City cannot exceed 100 characters']
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      enum: {
        values: INDIAN_STATES,
        message: '{VALUE} is not a valid Indian state'
      }
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      match: [/^[1-9][0-9]{5}$/, 'Pincode must be a valid 6-digit number']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[6-9][0-9]{9}$/, 'Phone must be a valid 10-digit Indian mobile number']
    },
    firebaseUid: {
      type: String,
      required: [true, 'Firebase UID is required'],
      unique: true,
      index: true
    },
    // Per-category quantity-slab percentage discounts for this retailer.
    categoryDiscounts: {
      type: [
        {
          category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
          slabs: {
            type: [
              {
                minQuantity: { type: Number, required: true, min: [1, 'Minimum quantity must be at least 1'] },
                discountPercentage: {
                  type: Number,
                  required: true,
                  min: [0, 'Percentage cannot be negative'],
                  max: [100, 'Percentage cannot exceed 100'],
                },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id, ...rest };
      }
    }
  }
);

// Indexes for efficient queries
retailerSchema.index({ email: 1 });
retailerSchema.index({ phone: 1 });
retailerSchema.index({ state: 1 });
retailerSchema.index({ city: 1 });

const Retailer = mongoose.model<IRetailer>('Retailer', retailerSchema);

export default Retailer;

