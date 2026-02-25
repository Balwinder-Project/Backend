import { Request, Response } from 'express';
import crypto from 'crypto';
import { WalletService } from '../services/wallet.service';
import { RazorpayService } from '../services/razorpay.service';

/**
 * Get wallet balance
 * GET /api/v1/wallets/:ownerType/:ownerId/balance
 */
export const getWalletBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerType, ownerId } = req.params;

    if (ownerType !== 'user' && ownerType !== 'retailer') {
      res.status(400).json({
        success: false,
        message: 'Invalid owner type. Must be "user" or "retailer"'
      });
      return;
    }

    const balance = await WalletService.getWalletBalance(ownerId, ownerType);

    if (balance === null) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { balance }
    });
  } catch (error: any) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Top up wallet
 * POST /api/v1/wallets/:ownerType/:ownerId/topup
 */
export const topUpWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerType, ownerId } = req.params;
    const { amount, description, performedBy, performedByType, metadata } = req.body;

    if (ownerType !== 'user' && ownerType !== 'retailer') {
      res.status(400).json({
        success: false,
        message: 'Invalid owner type. Must be "user" or "retailer"'
      });
      return;
    }

    const result = await WalletService.topUpWallet(ownerId, ownerType, {
      amount,
      description,
      performedBy,
      performedByType,
      metadata
    });

    res.status(200).json({
      success: true,
      message: 'Wallet topped up successfully',
      data: {
        balance: result.wallet.balance,
        transaction: result.transaction
      }
    });
  } catch (error: any) {
    console.error('Error topping up wallet:', error);

    if (error.message === 'Wallet not found') {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to top up wallet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Deduct from wallet
 * POST /api/v1/wallets/:ownerType/:ownerId/deduct
 */
export const deductFromWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerType, ownerId } = req.params;
    const { amount, description, performedBy, performedByType, metadata } = req.body;

    if (ownerType !== 'user' && ownerType !== 'retailer') {
      res.status(400).json({
        success: false,
        message: 'Invalid owner type. Must be "user" or "retailer"'
      });
      return;
    }

    const result = await WalletService.deductFromWallet(ownerId, ownerType, {
      amount,
      description,
      performedBy,
      performedByType,
      metadata
    });

    res.status(200).json({
      success: true,
      message: 'Amount deducted successfully',
      data: {
        balance: result.wallet.balance,
        transaction: result.transaction
      }
    });
  } catch (error: any) {
    console.error('Error deducting from wallet:', error);

    if (error.message === 'Wallet not found') {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    if (error.message === 'Insufficient wallet balance') {
      res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to deduct from wallet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get wallet transactions
 * GET /api/v1/wallets/:ownerType/:ownerId/transactions
 */
export const getWalletTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerType, ownerId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (ownerType !== 'user' && ownerType !== 'retailer') {
      res.status(400).json({
        success: false,
        message: 'Invalid owner type. Must be "user" or "retailer"'
      });
      return;
    }

    const result = await WalletService.getWalletTransactions(ownerId, ownerType, page, limit);

    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching wallet transactions:', error);

    if (error.message === 'Wallet not found') {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get wallet details (balance + recent transactions)
 * GET /api/v1/wallets/:ownerType/:ownerId
 */
export const getWalletDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerType, ownerId } = req.params;

    if (ownerType !== 'user' && ownerType !== 'retailer') {
      res.status(400).json({
        success: false,
        message: 'Invalid owner type. Must be "user" or "retailer"'
      });
      return;
    }

    const wallet = await WalletService.getWalletByOwner(ownerId, ownerType);

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
      return;
    }

    // Get recent transactions (limit to 5 for overview)
    const recentTransactions = await WalletService.getWalletTransactions(ownerId, ownerType, 1, 5);

    res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        createdAt: wallet.createdAt,
        recentTransactions: recentTransactions.transactions
      }
    });
  } catch (error: any) {
    console.error('Error fetching wallet details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a Razorpay order for wallet top-up
 * POST /api/v1/wallets/razorpay/create-order
 * Requires authentication
 */
export const createRazorpayOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, userId } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be a positive number (in ₹).'
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }

    // Amount in paise (1 ₹ = 100 paise)
    const amountInPaise = Math.round(amount * 100);
    // Razorpay receipt max length is 40 chars.
    // Format: wp_<last8ofUserId>_<epochSeconds> → always ≤ 25 chars.
    // We also store userId in order metadata so the webhook can look it up.
    const shortUserId = userId.slice(-8);
    const epochSec = Math.floor(Date.now() / 1000);
    const receipt = `wp_${shortUserId}_${epochSec}`;

    const order = await RazorpayService.createOrder(amountInPaise, 'INR', receipt, {
      userId,
    });

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Razorpay Webhook handler — credits wallet on payment.captured event
 * POST /api/v1/wallets/razorpay/webhook
 * No auth middleware — verified via HMAC signature
 */
export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      const rawBody = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('Invalid Razorpay webhook signature');
        res.status(400).json({ success: false, message: 'Invalid signature' });
        return;
      }
    }

    const event = req.body?.event;
    const paymentEntity = req.body?.payload?.payment?.entity;
    const orderEntity = req.body?.payload?.order?.entity;

    if (event === 'payment.captured' && paymentEntity) {
      const amountInPaise: number = paymentEntity.amount;
      const amountInRupees = amountInPaise / 100;
      const razorpayPaymentId: string = paymentEntity.id;
      const razorpayOrderId: string = paymentEntity.order_id;

      // Extract userId from order notes (most reliable) or fall back to receipt parsing
      const userId = orderEntity?.notes?.userId || null;

      if (!userId) {
        console.error('Could not extract userId from order notes. orderId:', razorpayOrderId);
        // Still return 200 so Razorpay doesn't retry
        res.status(200).json({ success: true, message: 'Webhook received, userId extraction failed' });
        return;
      }

      await WalletService.topUpWallet(userId, 'user', {
        amount: amountInRupees,
        description: 'Wallet Top-up via Razorpay',
        performedByType: 'user',
        performedBy: userId,
        metadata: {
          razorpayPaymentId,
          razorpayOrderId,
        }
      });

      console.log(`Wallet credited ₹${amountInRupees} for user ${userId} (payment: ${razorpayPaymentId})`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    console.error('Error processing Razorpay webhook:', error);
    // Return 200 even on error to prevent Razorpay from retrying
    res.status(200).json({ success: true, message: 'Webhook received with errors' });
  }
};
