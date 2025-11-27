import mongoose, { Document, Schema } from 'mongoose';

export interface ITag extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      trim: true,
      minlength: [2, 'Tag name must be at least 2 characters long'],
      maxlength: [50, 'Tag name cannot exceed 50 characters'],
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
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

// Indexes
tagSchema.index({ name: 1 });

const Tag = mongoose.model<ITag>('Tag', tagSchema);

export default Tag;

