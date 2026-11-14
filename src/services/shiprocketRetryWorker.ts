import Order, { OrderStatus } from '../models/order.model';
import { pushOrderToShiprocket } from '../controllers/order.controller';

let running = false;
let interval: ReturnType<typeof setInterval> | null = null;

/**
 * Recover paid orders that did not reach Shiprocket because of transient API
 * failures or a backend restart between order creation and the initial push.
 */
export async function runShiprocketRetrySweep(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const staleProcessing = new Date(now.getTime() - 10 * 60 * 1000);
    const candidates = await Order.find({
      status: { $in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING] },
      $or: [
        { paymentStatus: 'paid' },
        { paymentMethod: 'wallet', walletTransactionId: { $exists: true, $ne: null } },
      ],
      shiprocketOrderId: { $exists: false },
      $and: [
        {
          $or: [
            { shiprocketSyncStatus: { $in: ['pending', 'failed'] } },
            { shiprocketSyncStatus: { $exists: false } },
            { shiprocketSyncStatus: 'processing', updatedAt: { $lte: staleProcessing } },
          ],
        },
        {
          $or: [
            { shiprocketNextRetryAt: { $exists: false } },
            { shiprocketNextRetryAt: null },
            { shiprocketNextRetryAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { shiprocketSyncAttempts: { $lt: 5 } },
            { shiprocketSyncAttempts: { $exists: false } },
          ],
        },
      ],
    }).sort({ createdAt: 1 }).limit(20);

    for (const order of candidates) {
      await pushOrderToShiprocket(order);
    }
  } catch (error: any) {
    console.error('[shiprocket retry worker] sweep failed:', error?.message || error);
  } finally {
    running = false;
  }
}

export function startShiprocketRetryWorker(): void {
  if (interval) return;
  // Run once after the database is ready, then check for due retries every minute.
  void runShiprocketRetrySweep();
  interval = setInterval(() => void runShiprocketRetrySweep(), 60 * 1000);
  console.log('[shiprocket retry worker] started (60-second interval)');
}

export function stopShiprocketRetryWorker(): void {
  if (interval) clearInterval(interval);
  interval = null;
}
