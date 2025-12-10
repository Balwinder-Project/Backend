/**
 * Migration Script: Create Wallets for Existing Users and Retailers
 * 
 * This script creates wallets for all users and retailers that don't have one.
 * Run this script once to migrate existing data after implementing wallet feature.
 * 
 * Usage: npm run migrate:wallets
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import User from '../models/user.model';
import Retailer from '../models/retailer.model';
import Wallet from '../models/wallet.model';

// Load environment variables
dotenv.config();

async function createMissingWallets() {
  try {
    console.log('🔄 Starting wallet migration...\n');

    // Connect to database
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Get all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users`);

    let usersWithWallets = 0;
    let usersWalletsCreated = 0;

    for (const user of users) {
      // Check if wallet already exists
      const existingWallet = await Wallet.findOne({ 
        userId: user._id,
        ownerType: 'user'
      });

      if (existingWallet) {
        usersWithWallets++;
        console.log(`✓ User ${user.email} already has a wallet`);
      } else {
        // Create wallet for user
        await Wallet.create({
          userId: user._id,
          ownerType: 'user',
          balance: 0
        });
        usersWalletsCreated++;
        console.log(`✅ Created wallet for user: ${user.email}`);
      }
    }

    console.log(`\n📊 User wallets summary:`);
    console.log(`   - Already had wallets: ${usersWithWallets}`);
    console.log(`   - Wallets created: ${usersWalletsCreated}`);

    // Get all retailers
    const retailers = await Retailer.find({});
    console.log(`\n📊 Found ${retailers.length} retailers`);

    let retailersWithWallets = 0;
    let retailersWalletsCreated = 0;

    for (const retailer of retailers) {
      // Check if wallet already exists
      const existingWallet = await Wallet.findOne({ 
        retailerId: retailer._id,
        ownerType: 'retailer'
      });

      if (existingWallet) {
        retailersWithWallets++;
        console.log(`✓ Retailer ${retailer.email} already has a wallet`);
      } else {
        // Create wallet for retailer
        await Wallet.create({
          retailerId: retailer._id,
          ownerType: 'retailer',
          balance: 0
        });
        retailersWalletsCreated++;
        console.log(`✅ Created wallet for retailer: ${retailer.email}`);
      }
    }

    console.log(`\n📊 Retailer wallets summary:`);
    console.log(`   - Already had wallets: ${retailersWithWallets}`);
    console.log(`   - Wallets created: ${retailersWalletsCreated}`);

    console.log(`\n✨ Migration completed successfully!`);
    console.log(`\n📊 Total Summary:`);
    console.log(`   - Total users: ${users.length}`);
    console.log(`   - Total retailers: ${retailers.length}`);
    console.log(`   - Total wallets created: ${usersWalletsCreated + retailersWalletsCreated}`);
    console.log(`   - Total existing wallets: ${usersWithWallets + retailersWithWallets}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the migration
createMissingWallets();

