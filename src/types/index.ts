// Define your custom types here

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export enum TransactionType {
  TOP_UP = 'TOP_UP',
  DEDUCTION = 'DEDUCTION',
  PURCHASE = 'PURCHASE',
  REFUND = 'REFUND',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT'
}

export enum OwnerType {
  USER = 'user',
  RETAILER = 'retailer'
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy?: string;
  performedByType?: 'admin' | 'user' | 'retailer';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}


