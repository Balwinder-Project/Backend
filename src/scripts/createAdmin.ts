import dotenv from 'dotenv';
dotenv.config();

import { auth } from '../config/firebase';

const EMAIL = 'admin@bndcreation.com';
const PASSWORD = 'Balwinder@Sticker';
const DISPLAY_NAME = 'Admin';

async function createAdmin() {
  try {
    // Check if user already exists
    try {
      const existing = await auth.getUserByEmail(EMAIL);
      console.log(`User already exists: ${existing.uid}`);
      console.log('Updating claims to OWNER...');
      await auth.setCustomUserClaims(existing.uid, {
        role: 'admin',
        adminRoles: ['OWNER'],
      });
      console.log('Done! Admin account updated with OWNER permissions.');
      return;
    } catch {
      // User doesn't exist, create it
    }

    const userRecord = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: DISPLAY_NAME,
      emailVerified: true,
    });

    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      adminRoles: ['OWNER'],
    });

    console.log('Admin account created successfully!');
    console.log(`  UID: ${userRecord.uid}`);
    console.log(`  Email: ${EMAIL}`);
    console.log(`  Role: OWNER`);
  } catch (error) {
    console.error('Failed to create admin:', error);
    process.exit(1);
  }
}

createAdmin();
