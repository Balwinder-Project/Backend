import mongoose, { Document, Schema } from 'mongoose';

export type WholesaleEnquiryStatus = 'pending' | 'contacted' | 'closed' | 'approved' | 'rejected';

export interface IWholesaleEnquiry extends Document {
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstNumber?: string;
  state: string;
  district: string;
  pincode: string;
  sheetQuantity: number;
  address: string;
  requirement: string;
  visitingCardUrl?: string;
  visitingCardName?: string;
  status: WholesaleEnquiryStatus;
  internalNotes: string;
  retailerId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const wholesaleEnquirySchema = new Schema<IWholesaleEnquiry>({
  businessName: { type: String, required: true, trim: true, maxlength: 120 },
  contactPerson: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  gstNumber: { type: String, trim: true, uppercase: true, maxlength: 15, match: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ },
  state: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true, match: /^[1-9][0-9]{5}$/ },
  sheetQuantity: { type: Number, required: true, min: 25, validate: { validator: Number.isInteger, message: 'Sheet quantity must be a whole number' } },
  address: { type: String, required: true, trim: true, maxlength: 1000 },
  requirement: { type: String, default: '', trim: true, maxlength: 3000 },
  visitingCardUrl: { type: String },
  visitingCardName: { type: String },
  status: { type: String, enum: ['pending', 'contacted', 'closed', 'approved', 'rejected'], default: 'pending', index: true },
  retailerId: { type: Schema.Types.ObjectId, ref: 'Retailer', index: true },
  internalNotes: { type: String, default: '', maxlength: 5000 },
}, { timestamps: true });

wholesaleEnquirySchema.index({ businessName: 'text', contactPerson: 'text', email: 'text', phone: 'text' });

export default mongoose.model<IWholesaleEnquiry>('WholesaleEnquiry', wholesaleEnquirySchema);
