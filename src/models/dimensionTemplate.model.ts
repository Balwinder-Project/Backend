import mongoose, { Document, Schema } from 'mongoose';

/**
 * A reusable set of shipping dimensions (weight + box size) that can be applied
 * to a product on the create/edit form instead of typing the values each time.
 */
export interface IDimensionTemplate extends Document {
  name: string;
  weight: number;
  length: number;
  breadth: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
}

const dimensionTemplateSchema = new Schema<IDimensionTemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      minlength: [2, 'Template name must be at least 2 characters long'],
      maxlength: [80, 'Template name cannot exceed 80 characters'],
      unique: true,
    },
    weight: { type: Number, required: [true, 'Weight is required'], min: [0.01, 'Weight must be greater than 0'] },
    length: { type: Number, required: [true, 'Length is required'], min: [0, 'Length cannot be negative'] },
    breadth: { type: Number, required: [true, 'Breadth is required'], min: [0, 'Breadth cannot be negative'] },
    height: { type: Number, required: [true, 'Height is required'], min: [0, 'Height cannot be negative'] },
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

const DimensionTemplate = mongoose.model<IDimensionTemplate>('DimensionTemplate', dimensionTemplateSchema);

export default DimensionTemplate;
