/**
 * Manually credit a Razorpay wallet top-up that the webhook missed.
 *
 * It fetches the payment from Razorpay (server-side, authoritative), verifies it
 * was actually captured, finds the user from the order notes, and credits the
 * exact captured amount to their wallet — ONCE (idempotent by payment id, so
 * re-running or a late webhook can't double-credit).
 *
 * Usage:
 *   npx ts-node src/scripts/reconcileRazorpayTopup.ts <razorpay_payment_id | razorpay_order_id>
 *   e.g.  npx ts-node src/scripts/reconcileRazorpayTopup.ts pay_XXXXXXXXXXXX
 *
 * Find the payment/order id in the Razorpay dashboard → Transactions.
 */
import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { RazorpayService } from '../services/razorpay.service';
import { WalletService } from '../services/wallet.service';
import WalletTransaction from '../models/walletTransaction.model';
import User from '../models/user.model';

const run = async () => {
  const ref = process.argv[2];
  if (!ref) {
    console.error('Usage: ts-node src/scripts/reconcileRazorpayTopup.ts <razorpay_payment_id | razorpay_order_id>');
    process.exit(1);
  }

  await connectDatabase();

  // 1. Resolve the payment (accept either a payment id or an order id).
  let payment: any;
  if (ref.startsWith('order_')) {
    const payments = await RazorpayService.getOrderPayments(ref);
    const items = payments?.items || [];
    payment = items.find((p: any) => p.status === 'captured') || items[0];
    if (!payment) throw new Error(`No payments found for order ${ref}`);
  } else {
    payment = await RazorpayService.getPayment(ref);
  }

  console.log('Razorpay payment:', {
    id: payment.id,
    status: payment.status,
    amount: `₹${payment.amount / 100}`,
    order_id: payment.order_id,
  });

  // 2. Only credit genuinely captured payments.
  if (payment.status !== 'captured') {
    throw new Error(`Payment ${payment.id} is not captured (status=${payment.status}). Not crediting.`);
  }

  // 3. Find the user from the order notes (top-up orders store notes.userId).
  const order = payment.order_id ? await RazorpayService.getOrder(payment.order_id) : null;
  const userId: string | null = order?.notes?.userId || payment.notes?.userId || null;
  if (!userId) {
    throw new Error('Could not find userId in the order/payment notes; cannot map to a wallet.');
  }

  const user = await User.findById(userId);
  console.log('Target user:', user ? { id: userId, email: user.email, name: user.name } : `id ${userId} (not found in User collection!)`);
  if (!user) {
    throw new Error(`User ${userId} not found. Aborting.`);
  }

  // 4. Idempotency — don't credit the same payment twice.
  const existing = await WalletTransaction.findOne({ 'metadata.razorpayPaymentId': payment.id });
  if (existing) {
    console.log(`Already credited for payment ${payment.id} (transaction ${existing._id}). Nothing to do.`);
    await disconnectDatabase();
    return;
  }

  // 5. Credit the exact captured amount.
  const amountInRupees = payment.amount / 100;
  const { wallet, transaction } = await WalletService.topUpWallet(userId, 'user', {
    amount: amountInRupees,
    description: 'Wallet Top-up via Razorpay (manual reconciliation)',
    performedByType: 'user',
    performedBy: userId,
    metadata: {
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id,
      reconciled: true,
    },
  });

  console.log(`\n✓ Credited ₹${amountInRupees} to ${user.email}. New balance: ₹${wallet.balance} (transaction ${transaction._id})`);
  await disconnectDatabase();
};

run().catch((error) => {
  console.error('Reconciliation failed:', error?.message || error);
  process.exit(1);
});
