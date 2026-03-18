import mongoose from 'mongoose';
import Wallet, { IWallet } from '../models/wallet.model';
import WalletTransaction, { IWalletTransaction, TransactionType } from '../models/walletTransaction.model';

interface CreateWalletData {
  ownerId: string;
  ownerType: 'user' | 'retailer';
}

interface TopUpWalletData {
  amount: number;
  description?: string;
  performedBy?: string;
  performedByType?: 'admin' | 'user' | 'retailer';
  metadata?: Record<string, any>;
}

interface DeductWalletData {
  amount: number;
  description: string;
  performedBy?: string;
  performedByType?: 'admin' | 'user' | 'retailer';
  metadata?: Record<string, any>;
}

export class WalletService {
  /**
   * Create a new wallet for a user or retailer
   */
  static async createWallet(data: CreateWalletData): Promise<IWallet> {
    const walletData: any = {
      ownerType: data.ownerType,
      balance: 0
    };

    if (data.ownerType === 'user') {
      walletData.userId = new mongoose.Types.ObjectId(data.ownerId);
    } else {
      walletData.retailerId = new mongoose.Types.ObjectId(data.ownerId);
    }

    const wallet = await Wallet.create(walletData);
    return wallet;
  }

  /**
   * Get wallet by owner ID and type
   */
  static async getWalletByOwner(ownerId: string, ownerType: 'user' | 'retailer'): Promise<IWallet | null> {
    const query: any = { ownerType };
    
    if (ownerType === 'user') {
      query.userId = new mongoose.Types.ObjectId(ownerId);
    } else {
      query.retailerId = new mongoose.Types.ObjectId(ownerId);
    }

    return await Wallet.findOne(query);
  }

  /**
   * Get wallet balance
   */
  static async getWalletBalance(ownerId: string, ownerType: 'user' | 'retailer'): Promise<number | null> {
    const wallet = await this.getWalletByOwner(ownerId, ownerType);
    return wallet ? wallet.balance : null;
  }

  /**
   * Top up wallet
   */
  static async topUpWallet(
    ownerId: string,
    ownerType: 'user' | 'retailer',
    data: TopUpWalletData
  ): Promise<{ wallet: IWallet; transaction: IWalletTransaction }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await this.getWalletByOwner(ownerId, ownerType);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + data.amount;

      // Update wallet balance
      wallet.balance = balanceAfter;
      await wallet.save({ session });

      // Create transaction record
      const transaction = await WalletTransaction.create([{
        walletId: wallet._id,
        type: TransactionType.TOP_UP,
        amount: data.amount,
        balanceBefore,
        balanceAfter,
        description: data.description || 'Wallet top-up',
        performedBy: data.performedBy ? new mongoose.Types.ObjectId(data.performedBy) : undefined,
        performedByType: data.performedByType,
        metadata: data.metadata || {}
      }], { session });

      await session.commitTransaction();
      
      return {
        wallet,
        transaction: transaction[0]
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Deduct from wallet (with validation to prevent negative balance)
   * If an external session is provided, it will be used (caller manages commit/abort).
   * If no session is provided, an internal session is created and managed here.
   */
  static async deductFromWallet(
    ownerId: string,
    ownerType: 'user' | 'retailer',
    data: DeductWalletData,
    externalSession?: mongoose.ClientSession
  ): Promise<{ wallet: IWallet; transaction: IWalletTransaction }> {
    const ownSession = !externalSession;
    const session = externalSession ?? await mongoose.startSession();

    if (ownSession) session.startTransaction();

    try {
      const wallet = await this.getWalletByOwner(ownerId, ownerType);

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - data.amount;

      // Validate sufficient balance
      if (balanceAfter < 0) {
        throw new Error('Insufficient wallet balance');
      }

      // Update wallet balance
      wallet.balance = balanceAfter;
      await wallet.save({ session });

      // Create transaction record
      const transaction = await WalletTransaction.create([{
        walletId: wallet._id,
        type: TransactionType.DEDUCTION,
        amount: data.amount,
        balanceBefore,
        balanceAfter,
        description: data.description,
        performedBy: data.performedBy ? new mongoose.Types.ObjectId(data.performedBy) : undefined,
        performedByType: data.performedByType,
        metadata: data.metadata || {}
      }], { session });

      if (ownSession) await session.commitTransaction();

      return {
        wallet,
        transaction: transaction[0]
      };
    } catch (error) {
      if (ownSession) await session.abortTransaction();
      throw error;
    } finally {
      if (ownSession) session.endSession();
    }
  }

  /**
   * Get wallet transactions with pagination
   */
  static async getWalletTransactions(
    ownerId: string,
    ownerType: 'user' | 'retailer',
    page: number = 1,
    limit: number = 10
  ): Promise<{ transactions: IWalletTransaction[]; total: number; page: number; totalPages: number }> {
    const wallet = await this.getWalletByOwner(ownerId, ownerType);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ walletId: wallet._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WalletTransaction.countDocuments({ walletId: wallet._id })
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Record a purchase transaction
   * If an external session is provided, it will be used (caller manages commit/abort).
   */
  static async recordPurchase(
    ownerId: string,
    ownerType: 'user' | 'retailer',
    amount: number,
    description: string,
    metadata?: Record<string, any>,
    externalSession?: mongoose.ClientSession
  ): Promise<{ wallet: IWallet; transaction: IWalletTransaction }> {
    return this.deductFromWallet(ownerId, ownerType, {
      amount,
      description,
      performedByType: ownerType,
      performedBy: ownerId,
      metadata: { ...metadata, transactionType: 'purchase' }
    }, externalSession);
  }

  /**
   * Record a refund transaction
   */
  static async recordRefund(
    ownerId: string,
    ownerType: 'user' | 'retailer',
    amount: number,
    description: string,
    performedBy?: string,
    metadata?: Record<string, any>
  ): Promise<{ wallet: IWallet; transaction: IWalletTransaction }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await this.getWalletByOwner(ownerId, ownerType);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      // Update wallet balance
      wallet.balance = balanceAfter;
      await wallet.save({ session });

      // Create transaction record
      const transaction = await WalletTransaction.create([{
        walletId: wallet._id,
        type: TransactionType.REFUND,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        performedBy: performedBy ? new mongoose.Types.ObjectId(performedBy) : undefined,
        performedByType: 'admin',
        metadata: metadata || {}
      }], { session });

      await session.commitTransaction();
      
      return {
        wallet,
        transaction: transaction[0]
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin adjustment (can be positive or negative)
   */
  static async adminAdjustment(
    ownerId: string,
    ownerType: 'user' | 'retailer',
    amount: number,
    description: string,
    performedBy: string,
    metadata?: Record<string, any>
  ): Promise<{ wallet: IWallet; transaction: IWalletTransaction }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await this.getWalletByOwner(ownerId, ownerType);
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      // Validate non-negative balance after adjustment
      if (balanceAfter < 0) {
        throw new Error('Adjustment would result in negative balance');
      }

      // Update wallet balance
      wallet.balance = balanceAfter;
      await wallet.save({ session });

      // Create transaction record
      const transaction = await WalletTransaction.create([{
        walletId: wallet._id,
        type: TransactionType.ADMIN_ADJUSTMENT,
        amount: Math.abs(amount),
        balanceBefore,
        balanceAfter,
        description,
        performedBy: new mongoose.Types.ObjectId(performedBy),
        performedByType: 'admin',
        metadata: { ...metadata, adjustmentAmount: amount }
      }], { session });

      await session.commitTransaction();
      
      return {
        wallet,
        transaction: transaction[0]
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

