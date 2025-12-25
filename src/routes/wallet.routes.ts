import { Router } from 'express';
import {
  getWalletBalance,
  topUpWallet,
  deductFromWallet,
  getWalletTransactions,
  getWalletDetails
} from '../controllers/wallet.controller';
import { validateRequest } from '../middleware/validateRequest';
import { topUpWalletValidator, deductWalletValidator } from '../validators/wallet.validator';

const router = Router();

// Wallet operations
router.get('/:ownerType/:ownerId', getWalletDetails);
router.get('/:ownerType/:ownerId/balance', getWalletBalance);
router.get('/:ownerType/:ownerId/transactions', getWalletTransactions);
router.post('/:ownerType/:ownerId/topup', topUpWalletValidator, validateRequest, topUpWallet);
router.post('/:ownerType/:ownerId/deduct', deductWalletValidator, validateRequest, deductFromWallet);

export default router;





