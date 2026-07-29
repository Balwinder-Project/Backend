import mongoose from 'mongoose';
import Order, { IOrder, IOrderItem, IEmbeddedAddress, OrderStatus } from '../models/order.model';

export interface CreateOrderData {
  items: IOrderItem[];
  shippingAddress: IEmbeddedAddress;
  billingAddress: IEmbeddedAddress;
  subtotal: number;
  shippingCharge: number;
  total: number;
  notes?: string;
  paymentMethod?: 'wallet' | 'razorpay';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

interface PaginatedOrders {
  orders: IOrder[];
  total: number;
  page: number;
  totalPages: number;
}

export class OrderService {
  static async createOrder(
    userId: string,
    data: CreateOrderData,
    session: mongoose.ClientSession
  ): Promise<IOrder> {
    const [order] = await Order.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          items: data.items,
          shippingAddress: data.shippingAddress,
          billingAddress: data.billingAddress,
          subtotal: data.subtotal,
          shippingCharge: data.shippingCharge,
          total: data.total,
          paymentMethod: data.paymentMethod || 'wallet',
          razorpayOrderId: data.razorpayOrderId,
          razorpayPaymentId: data.razorpayPaymentId,
          status: OrderStatus.CONFIRMED,
          notes: data.notes,
        },
      ],
      { session }
    );

    return order;
  }

  static async setWalletTransaction(orderId: string, walletTransactionId: string): Promise<void> {
    await Order.findByIdAndUpdate(orderId, { walletTransactionId });
  }

  /**
   * Hard-delete an order by id. Used to compensate a failed wallet debit when
   * running without a transaction (standalone MongoDB).
   */
  static async deleteOrderById(orderId: string): Promise<void> {
    await Order.findByIdAndDelete(orderId);
  }

  static async updateShiprocketDetails(
    orderId: string,
    details: { shiprocketOrderId?: string; shiprocketShipmentId?: string }
  ): Promise<void> {
    await Order.findByIdAndUpdate(orderId, details);
  }

  /**
   * Record the outcome of pushing an order to Shiprocket so failures are
   * visible (and retryable) instead of silently swallowed.
   */
  static async setShiprocketResult(
    orderId: string,
    result:
      | { status: 'success'; shiprocketOrderId: string; shiprocketShipmentId: string }
      | { status: 'failed'; error: string }
  ): Promise<void> {
    if (result.status === 'success') {
      await Order.findByIdAndUpdate(orderId, {
        shiprocketSyncStatus: 'success',
        shiprocketOrderId: result.shiprocketOrderId,
        shiprocketShipmentId: result.shiprocketShipmentId,
        $unset: { shiprocketError: 1 },
      });
    } else {
      await Order.findByIdAndUpdate(orderId, {
        shiprocketSyncStatus: 'failed',
        shiprocketError: result.error?.slice(0, 1000),
      });
    }
  }

  static async getUserOrders(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedOrders> {
    const skip = (page - 1) * limit;
    const query = { userId: new mongoose.Types.ObjectId(userId) };

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    return { orders, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async getOrderById(
    orderId: string,
    userId?: string,
    populateUser: boolean = false
  ): Promise<IOrder | null> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return null;
    }

    const query: any = { _id: orderId };
    if (userId) query.userId = new mongoose.Types.ObjectId(userId);

    let orderQuery = Order.findOne(query);

    if (populateUser) {
      orderQuery = orderQuery.populate('userId', 'name email');
    }

    return orderQuery;
  }

  static async getAllOrders(
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<PaginatedOrders> {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (status) query.status = status;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);

    return { orders, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async updateOrderStatus(
    awbCode: string,
    statusData: {
      status: OrderStatus;
      courierName?: string;
      estimatedDeliveryDate?: Date;
      trackingUrl?: string;
    }
  ): Promise<IOrder | null> {
    return Order.findOneAndUpdate({ awbCode }, statusData, { new: true });
  }

  static async updateOrderStatusById(
    orderId: string,
    status: OrderStatus
  ): Promise<IOrder | null> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return null;
    }

    return Order.findByIdAndUpdate(orderId, { status }, { new: true })
      .populate('userId', 'name email');
  }
}
