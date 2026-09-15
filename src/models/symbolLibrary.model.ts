import mongoose, { Document, Schema } from 'mongoose';

export const SYMBOL_LIBRARY_CATEGORIES = [
  'All Symbols',
  'Hindu Symbols',
  'God & Goddess',
  'Religious',
  'Spiritual',
  'Nature & Floral',
  'Animals & Birds',
  'Modern / Minimal',
  'Family & Home',
  'Royal & Decorative',
  'Abstract',
] as const;

export type SymbolLibraryCategory = (typeof SYMBOL_LIBRARY_CATEGORIES)[number];

export interface ISymbolLibraryItem extends Document {
  name: string;
  category: Exclude<SymbolLibraryCategory, 'All Symbols'> | string;
  imageUrl?: string;
  value?: string;
  iconKey?: string;
  keywords: string[];
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const symbolLibrarySchema = new Schema<ISymbolLibraryItem>(
  {
    name: {
      type: String,
      required: [true, 'Symbol name is required'],
      trim: true,
      minlength: [2, 'Symbol name must be at least 2 characters long'],
      maxlength: [80, 'Symbol name cannot exceed 80 characters'],
    },
    category: {
      type: String,
      required: [true, 'Symbol category is required'],
      trim: true,
      maxlength: [60, 'Symbol category cannot exceed 60 characters'],
    },
    imageUrl: { type: String, trim: true, default: '' },
    value: { type: String, trim: true, maxlength: [20, 'Symbol value cannot exceed 20 characters'], default: '' },
    iconKey: { type: String, trim: true, maxlength: [80, 'Icon key cannot exceed 80 characters'], default: '' },
    keywords: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
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

symbolLibrarySchema.index({ category: 1, active: 1, sortOrder: 1, name: 1 });
symbolLibrarySchema.index({ name: 'text', keywords: 'text' });

const SymbolLibraryItem = mongoose.model<ISymbolLibraryItem>('SymbolLibraryItem', symbolLibrarySchema);

export default SymbolLibraryItem;
