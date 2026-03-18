import mongoose, { Document, Schema } from 'mongoose';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  variant?: string;
  weight: number;
}

export interface IEmbeddedAddress {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  orderNumber: string;
  items: IOrderItem[];
  shippingAddress: IEmbeddedAddress;
  billingAddress: IEmbeddedAddress;
  subtotal: number;
  shippingCharge: number;
  total: number;
  paymentMethod: 'wallet';
  walletTransactionId?: mongoose.Types.ObjectId;
  status: OrderStatus;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  awbCode?: string;
  courierName?: string;
  estimatedDeliveryDate?: Date;
  trackingUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const embeddedAddressSchema = new Schema<IEmbeddedAddress>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
  },
  { _id: false }
);

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    variant: { type: String },
    weight: { type: Number, required: true, default: 0.5 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    orderNumber: {
      type: String,
      unique: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (v: IOrderItem[]) => v.length > 0,
        message: 'Order must have at least one item',
      },
    },
    shippingAddress: {
      type: embeddedAddressSchema,
      required: true,
    },
    billingAddress: {
      type: embeddedAddressSchema,
      required: true,
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingCharge: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['wallet'],
      default: 'wallet',
    },
    walletTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'WalletTransaction',
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.CONFIRMED,
    },
    shiprocketOrderId: { type: String },
    shiprocketShipmentId: { type: String },
    awbCode: { type: String, index: true },
    courierName: { type: String },
    estimatedDeliveryDate: { type: Date },
    trackingUrl: { type: String },
    notes: { type: String },
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

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ status: 1 });

orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const year = new Date().getFullYear();
    const count = await (this.constructor as typeof Order).countDocuments();
    this.orderNumber = `ORD-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
