import Order, { OrderStatus } from '../models/order.model';
import Product from '../models/product.model';
import Retailer from '../models/retailer.model';
import User from '../models/user.model';

export type DashboardRange = '7d' | '30d' | '90d';

interface DashboardKpis {
  grossRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  openOrderCount: number;
  newUserCount: number;
  lowStockCount: number;
  activeProductCount: number;
  featuredProductCount: number;
  retailerCount: number;
  todayRevenue: number;
  todayOrderCount: number;
  outOfStockCount: number;
  totalStockUnits: number;
  inventoryRetailValue: number;
  paidOrderCount: number;
  unpaidOrderCount: number;
  refundedOrderCount: number;
  razorpayOrderCount: number;
  walletOrderCount: number;
  shiprocketPendingCount: number;
  shiprocketFailedCount: number;
  shippedOrderCount: number;
  deliveredOrderCount: number;
  cancelledOrderCount: number;
  returnedOrderCount: number;
}

interface DashboardTrendPoint {
  label: string;
  revenue: number;
  orders: number;
}

interface DashboardStatusBreakdown {
  status: OrderStatus;
  count: number;
}

interface DashboardTopProduct {
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

interface DashboardRecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;
}

interface DashboardLowStockProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  isActive: boolean;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  trends: DashboardTrendPoint[];
  orderStatusBreakdown: DashboardStatusBreakdown[];
  topProducts: DashboardTopProduct[];
  recentOrders: DashboardRecentOrder[];
  lowStockProducts: DashboardLowStockProduct[];
}

const RANGE_TO_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const NON_REVENUE_STATUSES = [OrderStatus.CANCELLED, OrderStatus.RETURNED];
const OPEN_ORDER_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
];
const LOW_STOCK_THRESHOLD = 5;

const formatTrendLabel = (date: Date): string =>
  date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });

const getStartDateForRange = (range: DashboardRange): Date => {
  const days = RANGE_TO_DAYS[range];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
};

const getTrendBuckets = (startDate: Date, days: number): Array<{ key: string; label: string }> => {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      key: date.toISOString().slice(0, 10),
      label: formatTrendLabel(date),
    };
  });
};

export class AdminService {
  static async getDashboardSummary(range: DashboardRange): Promise<DashboardSummary> {
    const days = RANGE_TO_DAYS[range];
    const startDate = getStartDateForRange(range);
    const trendBuckets = getTrendBuckets(startDate, days);

    const [
      orderCount,
      grossRevenueResult,
      openOrderCount,
      newUserCount,
      lowStockCount,
      activeProductCount,
      featuredProductCount,
      retailerCount,
      trendResults,
      orderStatusBreakdownResult,
      topProductsResult,
      recentOrdersResult,
      lowStockProductsResult,
      todayRevenueResult,
      todayOrderCount,
      outOfStockCount,
      inventoryResult,
      paymentBreakdownResult,
      shipmentBreakdownResult,
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: startDate } }),
      Order.aggregate<{ grossRevenue: number; revenueOrderCount: number }>([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: { $nin: NON_REVENUE_STATUSES },
          },
        },
        {
          $group: {
            _id: null,
            grossRevenue: { $sum: '$total' },
            revenueOrderCount: { $sum: 1 },
          },
        },
      ]),
      Order.countDocuments({ status: { $in: OPEN_ORDER_STATUSES } }),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      Product.countDocuments({ stock: { $lte: LOW_STOCK_THRESHOLD } }),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isFeatured: true }),
      Retailer.countDocuments(),
      Order.aggregate<{ _id: string; revenue: number; orders: number }>([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            orders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [{ $in: ['$status', NON_REVENUE_STATUSES] }, 0, '$total'],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate<{ _id: OrderStatus; count: number }>([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Order.aggregate<{ _id: { name: string; sku: string }; quantitySold: number; revenue: number }>([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: { $nin: NON_REVENUE_STATUSES },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              name: '$items.name',
              sku: '$items.sku',
            },
            quantitySold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          },
        },
        { $sort: { revenue: -1, quantitySold: -1, '_id.name': 1 } },
        { $limit: 5 },
      ]),
      Order.find({})
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('userId', 'name email')
        .lean(),
      Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } })
        .sort({ stock: 1, updatedAt: -1, createdAt: -1 })
        .limit(20)
        .select('name sku stock isActive')
        .lean(),
      Order.aggregate<{ revenue: number }>([
        { $match: { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }, status: { $nin: NON_REVENUE_STATUSES } } },
        { $group: { _id: null, revenue: { $sum: '$total' } } },
      ]),
      Order.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      Product.countDocuments({ stock: { $lte: 0 } }),
      Product.aggregate<{ totalStockUnits: number; inventoryRetailValue: number }>([
        { $group: { _id: null, totalStockUnits: { $sum: '$stock' }, inventoryRetailValue: { $sum: { $multiply: ['$stock', '$price'] } } } },
      ]),
      Order.aggregate<{ _id: { paymentMethod: string; paymentStatus: string }; count: number }>([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: { paymentMethod: '$paymentMethod', paymentStatus: '$paymentStatus' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate<{ _id: { shiprocketSyncStatus: string; status: OrderStatus }; count: number }>([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: { shiprocketSyncStatus: '$shiprocketSyncStatus', status: '$status' }, count: { $sum: 1 } } },
      ]),
    ]);

    const grossRevenue = grossRevenueResult[0]?.grossRevenue ?? 0;
    const revenueOrderCount = grossRevenueResult[0]?.revenueOrderCount ?? 0;
    const paymentCounts = paymentBreakdownResult.reduce((acc, item) => {
      const method = item._id.paymentMethod;
      const status = item._id.paymentStatus;
      if (status === 'paid') acc.paid += item.count;
      if (status === 'pending' || status === 'failed') acc.unpaid += item.count;
      if (status === 'refunded') acc.refunded += item.count;
      if (method === 'razorpay') acc.razorpay += item.count;
      if (method === 'wallet') acc.wallet += item.count;
      return acc;
    }, { paid: 0, unpaid: 0, refunded: 0, razorpay: 0, wallet: 0 });
    const shipmentCounts = shipmentBreakdownResult.reduce((acc, item) => {
      if (item._id.shiprocketSyncStatus === 'pending' || item._id.shiprocketSyncStatus === 'processing') acc.shiprocketPending += item.count;
      if (item._id.shiprocketSyncStatus === 'failed') acc.shiprocketFailed += item.count;
      if (item._id.status === OrderStatus.SHIPPED || item._id.status === OrderStatus.OUT_FOR_DELIVERY) acc.shipped += item.count;
      if (item._id.status === OrderStatus.DELIVERED) acc.delivered += item.count;
      if (item._id.status === OrderStatus.CANCELLED) acc.cancelled += item.count;
      if (item._id.status === OrderStatus.RETURNED) acc.returned += item.count;
      return acc;
    }, { shiprocketPending: 0, shiprocketFailed: 0, shipped: 0, delivered: 0, cancelled: 0, returned: 0 });

    const trendByDate = new Map(
      trendResults.map((item) => [
        item._id,
        {
          revenue: item.revenue ?? 0,
          orders: item.orders ?? 0,
        },
      ])
    );

    const trends = trendBuckets.map(({ key, label }) => {
      const point = trendByDate.get(key);
      return {
        label,
        revenue: point?.revenue ?? 0,
        orders: point?.orders ?? 0,
      };
    });

    const recentOrders = recentOrdersResult.map((order: any) => ({
      id: String(order._id),
      orderNumber: order.orderNumber,
      customerName:
        order.userId?.name ||
        order.userId?.email ||
        order.shippingAddress?.name ||
        'Customer',
      total: Number(order.total ?? 0),
      status: order.status,
      createdAt: order.createdAt,
    }));

    const lowStockProducts = lowStockProductsResult.map((product: any) => ({
      id: String(product._id),
      name: product.name,
      sku: product.sku,
      stock: Number(product.stock ?? 0),
      isActive: Boolean(product.isActive),
    }));

    return {
      kpis: {
        grossRevenue,
        orderCount,
        averageOrderValue: revenueOrderCount > 0 ? grossRevenue / revenueOrderCount : 0,
        openOrderCount,
        newUserCount,
        lowStockCount,
        activeProductCount,
        featuredProductCount,
        retailerCount,
        todayRevenue: todayRevenueResult[0]?.revenue ?? 0,
        todayOrderCount,
        outOfStockCount,
        totalStockUnits: inventoryResult[0]?.totalStockUnits ?? 0,
        inventoryRetailValue: inventoryResult[0]?.inventoryRetailValue ?? 0,
        paidOrderCount: paymentCounts.paid,
        unpaidOrderCount: paymentCounts.unpaid,
        refundedOrderCount: paymentCounts.refunded,
        razorpayOrderCount: paymentCounts.razorpay,
        walletOrderCount: paymentCounts.wallet,
        shiprocketPendingCount: shipmentCounts.shiprocketPending,
        shiprocketFailedCount: shipmentCounts.shiprocketFailed,
        shippedOrderCount: shipmentCounts.shipped,
        deliveredOrderCount: shipmentCounts.delivered,
        cancelledOrderCount: shipmentCounts.cancelled,
        returnedOrderCount: shipmentCounts.returned,
      },
      trends,
      orderStatusBreakdown: orderStatusBreakdownResult.map((item) => ({
        status: item._id,
        count: item.count,
      })),
      topProducts: topProductsResult.map((product) => ({
        name: product._id.name,
        sku: product._id.sku,
        quantitySold: product.quantitySold,
        revenue: product.revenue,
      })),
      recentOrders,
      lowStockProducts,
    };
  }
}
