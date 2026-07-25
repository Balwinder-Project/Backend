import mongoose, { Document, Schema } from 'mongoose';

export interface ISubCategory extends Document {
  name: string;
  description?: string;
  slug: string;
  category: mongoose.Types.ObjectId;
  parent?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  isHolographic: boolean;
  image?: string;
  showOnHomepage: boolean;
  fieldTemplate?: any;
  createdAt: Date;
  updatedAt: Date;
}

const subCategorySchema = new Schema<ISubCategory>(
  {
    name: {
      type: String,
      required: [true, 'Subcategory name is required'],
      trim: true,
      minlength: [2, 'Subcategory name must be at least 2 characters long'],
      maxlength: [100, 'Subcategory name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Parent category is required'],
      index: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'SubCategory',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isHolographic: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
      trim: true,
    },
    showOnHomepage: {
      type: Boolean,
      default: false,
      index: true,
    },
    fieldTemplate: {
      type: Schema.Types.Mixed,
      default: null,
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

subCategorySchema.index({ category: 1, parent: 1, name: 1 }, { unique: true });
subCategorySchema.index({ category: 1, slug: 1 }, { unique: true });
subCategorySchema.index({ isActive: 1 });

const SubCategory = mongoose.model<ISubCategory>('SubCategory', subCategorySchema);

export default SubCategory;
