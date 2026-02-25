import { Router } from 'express';
import {
  getWalletBalance,
  topUpWallet,
  deductFromWallet,
  getWalletTransactions,
  getWalletDetails,
  createRazorpayOrder,
  razorpayWebhook
} from '../controllers/wallet.controller';
import { validateRequest } from '../middleware/validateRequest';
import { topUpWalletValidator, deductWalletValidator } from '../validators/wallet.validator';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

// Razorpay routes — webhook MUST come before auth middleware since it uses HMAC verification
router.post('/razorpay/webhook', razorpayWebhook);
router.post('/razorpay/create-order', authenticateUser, createRazorpayOrder);

// Wallet operations
router.get('/:ownerType/:ownerId', getWalletDetails);
router.get('/:ownerType/:ownerId/balance', getWalletBalance);
router.get('/:ownerType/:ownerId/transactions', getWalletTransactions);
router.post('/:ownerType/:ownerId/topup', topUpWalletValidator, validateRequest, topUpWallet);
router.post('/:ownerType/:ownerId/deduct', deductWalletValidator, validateRequest, deductFromWallet);

export default router;



