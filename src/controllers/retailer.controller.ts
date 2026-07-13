import { Request, Response } from 'express';
import { RetailerService } from '../services/retailer.service';

/**
 * Whether the authenticated user is a registered retailer.
 * Lets the storefront distinguish a retailer from a normal email/password
 * customer instead of guessing from the Firebase sign-in provider.
 * GET /api/retailers/me
 */
export const getMyRetailerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.uid) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const retailer = await RetailerService.getRetailerByFirebaseUid(req.user.uid);
    res.json({ success: true, data: { isRetailer: !!retailer, retailer: retailer || null } });
  } catch (error) {
    console.error('Error checking retailer status:', error);
    res.status(500).json({ success: false, message: 'Failed to check retailer status' });
  }
};

/**
 * Create a new retailer
 * POST /api/retailers
 */
export const createRetailer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, city, state, pincode, email, phone, password } = req.body;

    const retailer = await RetailerService.createRetailer({
      name,
      city,
      state,
      pincode,
      email,
      phone,
      password
    });

    res.status(201).json({
      success: true,
      message: 'Retailer created successfully',
      data: retailer
    });
  } catch (error: any) {
    console.error('Error creating retailer:', error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      res.status(409).json({
        success: false,
        message: `A retailer with this ${field} already exists`
      });
      return;
    }

    // Handle Firebase Auth errors
    if (error.code?.startsWith('auth/')) {
      let message = 'Failed to create retailer account';
      
      if (error.code === 'auth/email-already-exists') {
        message = 'An account with this email already exists';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      } else if (error.code === 'auth/invalid-password') {
        message = 'Password must be at least 6 characters long';
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
      message: 'Failed to create retailer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all retailers with pagination
 * GET /api/retailers
 */
export const getAllRetailers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    const result = await RetailerService.getAllRetailers(page, limit, search);

    res.status(200).json({
      success: true,
      data: result.retailers,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching retailers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch retailers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get retailer by ID
 * GET /api/retailers/:id
 */
export const getRetailerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const retailer = await RetailerService.getRetailerById(id);

    if (!retailer) {
      res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: retailer
    });
  } catch (error: any) {
    console.error('Error fetching retailer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch retailer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update retailer
 * PUT /api/retailers/:id
 */
export const updateRetailer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, city, state, pincode, email, phone, password } = req.body;

    const retailer = await RetailerService.updateRetailer(id, {
      name,
      city,
      state,
      pincode,
      email,
      phone,
      password
    });

    if (!retailer) {
      res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Retailer updated successfully',
      data: retailer
    });
  } catch (error: any) {
    console.error('Error updating retailer:', error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      res.status(409).json({
        success: false,
        message: `A retailer with this ${field} already exists`
      });
      return;
    }

    // Handle Firebase Auth errors
    if (error.code?.startsWith('auth/')) {
      let message = 'Failed to update retailer account';
      
      if (error.code === 'auth/email-already-exists') {
        message = 'An account with this email already exists';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      } else if (error.code === 'auth/user-not-found') {
        message = 'Retailer account not found in authentication system';
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
      message: 'Failed to update retailer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete retailer
 * DELETE /api/retailers/:id
 */
export const deleteRetailer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await RetailerService.deleteRetailer(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Retailer deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting retailer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete retailer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

