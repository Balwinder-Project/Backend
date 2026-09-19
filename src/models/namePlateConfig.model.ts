import mongoose, { Document, Schema } from 'mongoose';

export interface INamePlateReferenceFont { id: string; element: string; fontName: string; }
export interface INamePlateDesign { id: string; name: string; previewImage?: string; templateImage?: string; referenceFont?: string; referenceFonts?: INamePlateReferenceFont[]; baseWidth?: number; baseHeight?: number; accent?: string; active: boolean; }
export interface INamePlateFinish { id: string; name: string; price: number; imageUrl?: string; active: boolean; }
export interface INamePlateSize { id: string; label: string; width: number; height: number; price: number; active: boolean; }
export interface INamePlateSymbol { id: string; name: string; category: string; value: string; imageUrl?: string; active: boolean; }
export interface INamePlatePreviewSettings {
  title?: string; stockLabel?: string; subtitle?: string; oldPrice?: number; rating?: number;
  reviewCount?: number; soldCount?: string; description?: string; heroImage?: string;
  features?: Array<[string,string,string]>;
}

export interface INamePlateConfig extends Document {
  productId?: mongoose.Types.ObjectId;
  subCategoryId?: mongoose.Types.ObjectId;
  designs: INamePlateDesign[];
  finishes: INamePlateFinish[];
  sizes: INamePlateSize[];
  layouts: string[];
  symbols: INamePlateSymbol[];
  basePrice: number;
  customLayoutSurcharge: number;
  isActive: boolean;
  previewSettings?: INamePlatePreviewSettings;
  createdAt: Date;
  updatedAt: Date;
}

const configSchema = new Schema<INamePlateConfig>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', unique: true, sparse: true, index: true },
  subCategoryId: { type: Schema.Types.ObjectId, ref: 'SubCategory', unique: true, sparse: true, index: true },
  designs: [{
    id: String,
    name: String,
    previewImage: String,
    templateImage: String,
    referenceFont: String,
    referenceFonts: [{ id: String, element: String, fontName: String }],
    baseWidth: { type: Number, min: 0.1 },
    baseHeight: { type: Number, min: 0.1 },
    accent: String,
    active: { type: Boolean, default: true },
  }],
  finishes: [{ id: String, name: String, price: { type: Number, min: 0, default: 0 }, imageUrl: String, active: { type: Boolean, default: true } }],
  sizes: [{ id: String, label: String, width: Number, height: Number, price: { type: Number, min: 0, default: 0 }, active: { type: Boolean, default: true } }],
  layouts: { type: [String], default: ['house-symbol', 'house-name-symbol', 'name-symbol', 'house-only', 'custom'] },
  symbols: [{ id: String, name: String, category: String, value: String, imageUrl: String, active: { type: Boolean, default: true } }],
  basePrice: { type: Number, min: 0, default: 0 },
  customLayoutSurcharge: { type: Number, min: 0, default: 0 },
  isActive: { type: Boolean, default: true },
  previewSettings: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

configSchema.pre('validate', function (next) {
  if (!this.productId && !this.subCategoryId) return next(new Error('Either productId or subCategoryId is required'));
  next();
});

export default mongoose.model<INamePlateConfig>('NamePlateConfig', configSchema);
