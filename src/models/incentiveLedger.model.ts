import mongoose, { Document, Schema } from 'mongoose';

export type IncentiveType = 'wholesaler_registration' | 'order';
export type IncentiveStatus = 'pending' | 'approved' | 'payable' | 'paid' | 'reversed';

export interface IIncentiveLedgerEntry extends Document {
  salesmanId: mongoose.Types.ObjectId;
  type: IncentiveType;
  status: IncentiveStatus;
  retailerId?: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  eligibleOrderValue?: number;
  amount: number;
  currency: 'INR';
  idempotencyKey: string;
  description?: string;
  reversedEntryId?: mongoose.Types.ObjectId;
  payoutReference?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const incentiveLedgerSchema = new Schema<IIncentiveLedgerEntry>({
  salesmanId: { type: Schema.Types.ObjectId, ref: 'Salesman', required: true, index: true },
  type: { type: String, enum: ['wholesaler_registration', 'order'], required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'payable', 'paid', 'reversed'], default: 'pending', index: true },
  retailerId: { type: Schema.Types.ObjectId, ref: 'Retailer', index: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
  orderNumber: { type: String, trim: true },
  eligibleOrderValue: { type: Number, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  description: { type: String, maxlength: 500 },
  reversedEntryId: { type: Schema.Types.ObjectId, ref: 'IncentiveLedgerEntry' },
  payoutReference: { type: String, trim: true },
  paidAt: { type: Date },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      const result = { ...ret, id: ret._id };
      Reflect.deleteProperty(result, '_id');
      Reflect.deleteProperty(result, '__v');
      return result;
    },
  },
});

incentiveLedgerSchema.index({ salesmanId: 1, createdAt: -1 });
incentiveLedgerSchema.index({ retailerId: 1, type: 1 });
incentiveLedgerSchema.index({ orderId: 1, type: 1 });

const IncentiveLedgerEntry = mongoose.models.IncentiveLedgerEntry ||
  mongoose.model<IIncentiveLedgerEntry>('IncentiveLedgerEntry', incentiveLedgerSchema);
export default IncentiveLedgerEntry;
