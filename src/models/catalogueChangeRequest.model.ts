import mongoose, { Document, Schema } from 'mongoose';

export type CatalogueEntityType = 'product' | 'category' | 'tag' | 'heroSlide';
export type CatalogueAction = 'create' | 'update' | 'delete';
export type CatalogueChangeStatus =
  | 'pending_qc1'
  | 'rejected_qc1'
  | 'pending_qc2'
  | 'rejected_qc2'
  | 'approved'
  | 'applied';

export interface ICatalogueChangeRequest extends Document {
  entityType: CatalogueEntityType;
  action: CatalogueAction;
  targetId?: mongoose.Types.ObjectId;
  payload?: Record<string, any>;
  originalSnapshot?: Record<string, any>;
  status: CatalogueChangeStatus;
  submittedBy: string;
  submittedByEmail?: string;
  qc1ReviewedBy?: string;
  qc1ReviewedByEmail?: string;
  qc1Feedback?: string;
  qc1ReviewedAt?: Date;
  qc2ReviewedBy?: string;
  qc2ReviewedByEmail?: string;
  qc2Feedback?: string;
  qc2ReviewedAt?: Date;
  appliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const catalogueChangeRequestSchema = new Schema<ICatalogueChangeRequest>(
  {
    entityType: {
      type: String,
      enum: ['product', 'category', 'tag', 'heroSlide'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: function (this: ICatalogueChangeRequest) {
        return this.action === 'update' || this.action === 'delete';
      },
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    originalSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending_qc1', 'rejected_qc1', 'pending_qc2', 'rejected_qc2', 'approved', 'applied'],
      default: 'pending_qc1',
      index: true,
    },
    submittedBy: {
      type: String,
      required: true,
      index: true,
    },
    submittedByEmail: {
      type: String,
      trim: true,
    },
    qc1ReviewedBy: String,
    qc1ReviewedByEmail: String,
    qc1Feedback: String,
    qc1ReviewedAt: Date,
    qc2ReviewedBy: String,
    qc2ReviewedByEmail: String,
    qc2Feedback: String,
    qc2ReviewedAt: Date,
    appliedAt: Date,
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

catalogueChangeRequestSchema.index({ status: 1, createdAt: -1 });
catalogueChangeRequestSchema.index({ entityType: 1, action: 1, status: 1 });

const CatalogueChangeRequest = mongoose.model<ICatalogueChangeRequest>(
  'CatalogueChangeRequest',
  catalogueChangeRequestSchema
);

export default CatalogueChangeRequest;
