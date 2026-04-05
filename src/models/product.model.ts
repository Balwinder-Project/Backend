import mongoose, { Document, Schema } from 'mongoose';

export interface IPricingSlab {
  minQuantity: number;
  price: number;
}

export interface IRetailerPricing {
  minimumOrderQuantity: number;
  slabs: IPricingSlab[];
}

export interface IProduct extends Document {
  name: string;
  description?: string;
  price: number;
  sku: string;
  images: string[];
  category: mongoose.Types.ObjectId;
  tags: mongoose.Types.ObjectId[];
  stock: number;
  isActive: boolean;
  isFeatured: boolean;
  customFields?: any;
  normalUserPricing: IPricingSlab[];
  retailerPricing: IRetailerPricing;
  weight: number;
  length: number;
  breadth: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters long'],
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    images: {
      type: [String],
      default: [],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    tags: {
      type: [Schema.Types.ObjectId],
      ref: 'Tag',
      default: [],
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: null,
    },
    normalUserPricing: {
      type: [
        {
          minQuantity: { type: Number, required: true, min: [1, 'Minimum quantity must be at least 1'] },
          price: { type: Number, required: true, min: [0, 'Price cannot be negative'] },
        },
      ],
      default: [],
    },
    retailerPricing: {
      minimumOrderQuantity: { type: Number, default: 1, min: [1, 'Minimum order quantity must be at least 1'] },
      slabs: {
        type: [
          {
            minQuantity: { type: Number, required: true, min: [1, 'Minimum quantity must be at least 1'] },
            price: { type: Number, required: true, min: [0, 'Price cannot be negative'] },
          },
        ],
        default: [],
      },
    },
    weight: {
      type: Number,
      default: 0.5,
      min: [0.01, 'Weight must be greater than 0'],
    },
    length: {
      type: Number,
      default: 10,
      min: [0, 'Length cannot be negative'],
    },
    breadth: {
      type: Number,
      default: 10,
      min: [0, 'Breadth cannot be negative'],
    },
    height: {
      type: Number,
      default: 5,
      min: [0, 'Height cannot be negative'],
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

// Indexes
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ sku: 1 });

const Product = mongoose.model<IProduct>('Product', productSchema);

export default Product;

