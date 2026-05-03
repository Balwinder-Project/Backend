import mongoose, { Document, Schema } from 'mongoose';

export interface IHeroSlide extends Document {
  title: string;
  description: string;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

const heroSlideSchema = new Schema<IHeroSlide>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters long'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [2, 'Description must be at least 2 characters long'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
    },
    buttonText: {
      type: String,
      required: [true, 'Button title is required'],
      trim: true,
      minlength: [1, 'Button title is required'],
      maxlength: [80, 'Button title cannot exceed 80 characters'],
    },
    buttonLink: {
      type: String,
      required: [true, 'Button link is required'],
      trim: true,
    },
    position: {
      type: Number,
      required: [true, 'Position is required'],
      min: [0, 'Position cannot be negative'],
      default: 0,
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

heroSlideSchema.index({ position: 1, createdAt: 1 });

const HeroSlide = mongoose.model<IHeroSlide>('HeroSlide', heroSlideSchema);

export default HeroSlide;
