/**
 * Manually re-push an order to Shiprocket (uses the current code path, so it
 * verifies fixes without needing a deploy).
 *
 * Usage:
 *   npx ts-node src/scripts/retryShiprocket.ts <orderNumber | order _id>
 *   e.g.  npx ts-node src/scripts/retryShiprocket.ts ORD-2026-00002
 */
import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database';
import Order from '../models/order.model';
import { pushOrderToShiprocket } from '../controllers/order.controller';

const run = async () => {
  const ref = process.argv[2] || 'ORD-2026-00002';
  await connectDatabase();

  const order = /^[0-9a-fA-F]{24}$/.test(ref)
    ? await Order.findById(ref)
    : await Order.findOne({ orderNumber: ref });

  if (!order) throw new Error(`Order ${ref} not found`);

  console.log('Order before:', {
    orderNumber: order.orderNumber,
    syncStatus: order.shiprocketSyncStatus,
    shiprocketOrderId: order.shiprocketOrderId,
    prevError: order.shiprocketError,
  });

  if (order.shiprocketOrderId) {
    console.log('Already synced to Shiprocket — skipping to avoid a duplicate.');
    await disconnectDatabase();
    return;
  }

  await pushOrderToShiprocket(order);

  const updated = await Order.findById(order._id);
  console.log('\nResult:', {
    syncStatus: updated?.shiprocketSyncStatus,
    shiprocketOrderId: updated?.shiprocketOrderId,
    shiprocketShipmentId: updated?.shiprocketShipmentId,
    error: updated?.shiprocketError,
  });

  if (updated?.shiprocketSyncStatus === 'success') {
    console.log('\n✅ SHIPROCKET INTEGRATION WORKING — order pushed successfully.');
  } else {
    console.log('\n❌ Still failing. See error above.');
  }

  await disconnectDatabase();
};

run().catch(async (e) => {
  console.error('FAILED:', e.message);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
