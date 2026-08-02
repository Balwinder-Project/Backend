import mongoose, { Document, Schema } from 'mongoose';

export type DesignRequestStatus =
  | 'new'
  | 'in_review'
  | 'contacted'
  | 'completed'
  | 'cancelled';

export interface IDesignRequest extends Document {
  name: string;
  subject: string;
  email: string;
  phone: string;
  requirements: string;
  images: string[];
  status: DesignRequestStatus;
  adminNotes?: string;
  firebaseUid?: string;
  createdAt: Date;
  updatedAt: Date;
}

const designRequestSchema = new Schema<IDesignRequest>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [120, 'Subject cannot exceed 120 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      maxlength: [15, 'Phone cannot exceed 15 characters'],
    },
    requirements: {
      type: String,
      required: [true, 'Requirements are required'],
      trim: true,
      minlength: [20, 'Requirements must be at least 20 characters'],
      maxlength: [1000, 'Requirements cannot exceed 1000 characters'],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length >= 1 && v.length <= 8,
        message: 'Between 1 and 8 reference images are required',
      },
    },
    status: {
      type: String,
      enum: ['new', 'in_review', 'contacted', 'completed', 'cancelled'],
      default: 'new',
      index: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
      default: '',
    },
    firebaseUid: {
      type: String,
      default: null,
      index: true,
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

designRequestSchema.index({ createdAt: -1 });
designRequestSchema.index({ email: 1 });
designRequestSchema.index({ status: 1, createdAt: -1 });

const DesignRequest = mongoose.model<IDesignRequest>('DesignRequest', designRequestSchema);

export default DesignRequest;
