import { Request, Response } from 'express';
import { WalletService } from '../services/wallet.service';

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


