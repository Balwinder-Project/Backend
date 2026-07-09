import mongoose, { Document, Schema } from 'mongoose';

export type MockupRenderMode = 'flat' | 'perspective' | 'curved';

/**
 * Placement of the sticker for `flat` render mode.
 * All coordinates are PERCENTAGES of the base image dimensions (0-100) so they
 * stay correct regardless of the base image's actual pixel resolution.
 */
export interface IMockupPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  blendMode: string;
}

/**
 * Four target corners (percent coords) the sticker is warped onto for
 * `perspective` and `curved` render modes. Each corner is [xPercent, yPercent].
 */
export interface IMockupCorners {
  tl: number[];
  tr: number[];
  br: number[];
  bl: number[];
}

export interface IMockupTemplate extends Document {
  name: string;
  baseImage: string;
  baseWidth?: number;
  baseHeight?: number;
  renderMode: MockupRenderMode;
  /** @deprecated single-area fields kept for backward compatibility; use placements/cornersList. */
  placement?: IMockupPlacement;
  corners?: IMockupCorners;
  /** One flat placement box per area the sticker should appear in. */
  placements?: IMockupPlacement[];
  /** One set of four corner points per area (perspective/curved). */
  cornersList?: IMockupCorners[];
  displacementMap?: string;
  displacementStrength: number;
  lightingMap?: string;
  subCategories: mongoose.Types.ObjectId[];
  categories: mongoose.Types.ObjectId[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const placementSchema = new Schema<IMockupPlacement>(
  {
    x: { type: Number, default: 25 },
    y: { type: Number, default: 25 },
    width: { type: Number, default: 50 },
    height: { type: Number, default: 50 },
    rotation: { type: Number, default: 0 },
    opacity: { type: Number, default: 1, min: 0, max: 1 },
    blendMode: { type: String, default: 'over' },
  },
  { _id: false }
);

const cornersSchema = new Schema<IMockupCorners>(
  {
    tl: { type: [Number], default: undefined },
    tr: { type: [Number], default: undefined },
    br: { type: [Number], default: undefined },
    bl: { type: [Number], default: undefined },
  },
  { _id: false }
);

const mockupTemplateSchema = new Schema<IMockupTemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      minlength: [2, 'Template name must be at least 2 characters long'],
      maxlength: [120, 'Template name cannot exceed 120 characters'],
    },
    baseImage: {
      type: String,
      required: [true, 'Base scene image is required'],
    },
    baseWidth: { type: Number },
    baseHeight: { type: Number },
    renderMode: {
      type: String,
      enum: ['flat', 'perspective', 'curved'],
      default: 'flat',
    },
    placement: { type: placementSchema, default: () => ({}) },
    corners: { type: cornersSchema, default: undefined },
    placements: { type: [placementSchema], default: undefined },
    cornersList: { type: [cornersSchema], default: undefined },
    displacementMap: { type: String },
    displacementStrength: { type: Number, default: 12, min: 0 },
    lightingMap: { type: String },
    subCategories: {
      type: [Schema.Types.ObjectId],
      ref: 'SubCategory',
      default: [],
    },
    categories: {
      type: [Schema.Types.ObjectId],
      ref: 'Category',
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
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

mockupTemplateSchema.index({ subCategories: 1 });
mockupTemplateSchema.index({ isActive: 1 });
mockupTemplateSchema.index({ sortOrder: 1 });

const MockupTemplate = mongoose.model<IMockupTemplate>('MockupTemplate', mockupTemplateSchema);

export default MockupTemplate;
