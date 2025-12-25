import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
  userId?: mongoose.Types.ObjectId;
  retailerId?: mongoose.Types.ObjectId;
  ownerType: 'user' | 'retailer';
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    retailerId: {
      type: Schema.Types.ObjectId,
      ref: 'Retailer',
      default: null
    },
    ownerType: {
      type: String,
      required: [true, 'Owner type is required'],
      enum: {
        values: ['user', 'retailer'],
        message: '{VALUE} is not a valid owner type'
      }
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Balance cannot be negative']
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

// Validation: Ensure either userId or retailerId is set, but not both
walletSchema.pre('save', function(next) {
  if (this.ownerType === 'user' && !this.userId) {
    next(new Error('userId is required for user wallets'));
  } else if (this.ownerType === 'retailer' && !this.retailerId) {
    next(new Error('retailerId is required for retailer wallets'));
  } else if (this.userId && this.retailerId) {
    next(new Error('Wallet cannot belong to both user and retailer'));
  } else {
    next();
  }
});

// Indexes for efficient queries
walletSchema.index({ userId: 1 });
walletSchema.index({ retailerId: 1 });
walletSchema.index({ ownerType: 1 });

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;





