import mongoose from 'mongoose';

/**
 * Establish a connection to the MongoDB database.
 */
export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in the environment variables.');
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME,
    autoIndex: process.env.NODE_ENV !== 'production'
  });

  console.log('📦 MongoDB connected');
};

/**
 * Close the MongoDB connection gracefully.
 */
export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.connection.close();
  console.log('📦 MongoDB disconnected');
};

