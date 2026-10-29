import mongoose, { Document, Schema } from 'mongoose';

export type SalesmanStatus = 'active' | 'inactive';
export type IncentiveMode = 'fixed' | 'percentage';

export interface ISalesman extends Document {
  name: string;
  email: string;
  phone: string;
  firebaseUid?: string;
  status: SalesmanStatus;
  registrationIncentiveMode: IncentiveMode;
  registrationIncentiveValue: number;
  orderIncentiveMode: IncentiveMode;
  orderIncentiveValue: number;
  createdAt: Date;
  updatedAt: Date;
}

const salesmanSchema = new Schema<ISalesman>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true, match: /^[6-9][0-9]{9}$/ },
  firebaseUid: { type: String, trim: true, sparse: true, unique: true, index: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  registrationIncentiveMode: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  registrationIncentiveValue: { type: Number, min: 0, default: 0 },
  orderIncentiveMode: { type: String, enum: ['fixed', 'percentage'], default: 'percentage' },
  orderIncentiveValue: { type: Number, min: 0, default: 0 },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      const id = ret._id;
      delete ret._id;
      delete ret.__v;
      return { id, ...ret };
    },
  },
});

salesmanSchema.index({ email: 1 }, { unique: true });
salesmanSchema.index({ phone: 1 }, { unique: true });

const Salesman = mongoose.models.Salesman || mongoose.model<ISalesman>('Salesman', salesmanSchema);
export default Salesman;
