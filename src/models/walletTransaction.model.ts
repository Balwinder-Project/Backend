import mongoose, { Document, Schema } from 'mongoose';

export enum TransactionType {
  TOP_UP = 'TOP_UP',
  DEDUCTION = 'DEDUCTION',
  PURCHASE = 'PURCHASE',
  REFUND = 'REFUND',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT'
}

export interface IWalletTransaction extends Document {
  walletId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  performedBy?: mongoose.Types.ObjectId;
  performedByType?: 'admin' | 'user' | 'retailer';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    walletId: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: [true, 'Wallet ID is required'],
      index: true
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: Object.values(TransactionType),
        message: '{VALUE} is not a valid transaction type'
      }
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0']
    },
    balanceBefore: {
      type: Number,
      required: [true, 'Balance before is required'],
      min: [0, 'Balance before cannot be negative']
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after is required'],
      min: [0, 'Balance after cannot be negative']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      default: null
    },
    performedByType: {
      type: String,
      enum: ['admin', 'user', 'retailer'],
      default: null
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id, ...rest };
      }
    }
  }
);

// Indexes for efficient queries
walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ performedBy: 1 });

const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);

export default WalletTransaction;







