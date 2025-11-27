import { Request, Response } from 'express';
import { auth } from '../config/firebase';

interface CreateAdminUserRequest {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * Create a new admin user in Firebase Auth with custom claims
 * POST /api/admin/create-admin-user
 */
export const createAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName }: CreateAdminUserRequest = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
      return;
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      emailVerified: false
    });

    // Set custom claims for admin role
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin'
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: 'admin'
      }
    });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    
    // Handle Firebase-specific errors
    if (error.code === 'auth/email-already-exists') {
      res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
      return;
    }

    if (error.code === 'auth/invalid-password') {
      res.status(400).json({
        success: false,
        message: 'Invalid password. Password must be at least 6 characters long'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create admin user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

