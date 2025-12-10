import { Request, Response } from 'express';
import { UserService } from '../services/user.service';

/**
 * Handle Google sign-in and auto-create user
 * POST /api/v1/auth/google-signin
 */
export const googleSignIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firebaseUid, email, name, profilePicture } = req.body;

    const user = await UserService.createOrGetUserFromGoogle({
      firebaseUid,
      email,
      name,
      profilePicture
    });

    res.status(200).json({
      success: true,
      message: 'User authenticated successfully',
      data: user
    });
  } catch (error: any) {
    console.error('Error in Google sign-in:', error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      res.status(409).json({
        success: false,
        message: `A user with this ${field} already exists`
      });
      return;
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to authenticate user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all users with pagination
 * GET /api/v1/users
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    const result = await UserService.getAllUsers(page, limit, search);

    res.status(200).json({
      success: true,
      data: result.users,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user by ID
 * GET /api/v1/users/:id
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await UserService.getUserById(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update user
 * PUT /api/v1/users/:id
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, profilePicture } = req.body;

    const user = await UserService.updateUser(id, {
      name,
      email,
      profilePicture
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error: any) {
    console.error('Error updating user:', error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      res.status(409).json({
        success: false,
        message: `A user with this ${field} already exists`
      });
      return;
    }

    // Handle Firebase Auth errors
    if (error.code?.startsWith('auth/')) {
      let message = 'Failed to update user account';
      
      if (error.code === 'auth/email-already-exists') {
        message = 'An account with this email already exists';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      } else if (error.code === 'auth/user-not-found') {
        message = 'User account not found in authentication system';
      }

      res.status(400).json({
        success: false,
        message
      });
      return;
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete user
 * DELETE /api/v1/users/:id
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await UserService.deleteUser(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
