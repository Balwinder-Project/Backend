import { runRazorpayReconciliationSweep } from '../controllers/order.controller';

let running = false;
let interval: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically reconcile captured Razorpay payments independently of customer
 * or admin page visits. The sweep uses the same server-side Razorpay
 * verification and idempotent order finalization as the webhook path.
 */
export async function runRazorpayReconciliationWorkerSweep(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runRazorpayReconciliationSweep();
  } catch (error: any) {
    console.error('[razorpay worker] sweep failed:', error?.message || error);
  } finally {
    running = false;
  }
}

export function startRazorpayReconciliationWorker(): void {
  if (interval) return;
  // Run immediately after MongoDB connects, then continue every minute.
  void runRazorpayReconciliationWorkerSweep();
  interval = setInterval(() => void runRazorpayReconciliationWorkerSweep(), 60 * 1000);
  console.log('[razorpay worker] started (60-second interval)');
}

export function stopRazorpayReconciliationWorker(): void {
  if (interval) clearInterval(interval);
  interval = null;
}
