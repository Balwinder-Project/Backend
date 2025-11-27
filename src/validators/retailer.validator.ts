import { Request, Response, NextFunction } from 'express';
import { INDIAN_STATES } from '../constants/indian-states';

/**
 * Validate retailer creation/update data
 */
export const validateRetailerData = (isUpdate: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { name, city, state, pincode, email, phone, password } = req.body;
    const errors: string[] = [];

    // Validate name
    if (!isUpdate || name !== undefined) {
      if (!name && !isUpdate) {
        errors.push('Name is required');
      } else if (name && (name.trim().length < 2 || name.trim().length > 100)) {
        errors.push('Name must be between 2 and 100 characters');
      }
    }

    // Validate city
    if (!isUpdate || city !== undefined) {
      if (!city && !isUpdate) {
        errors.push('City is required');
      } else if (city && (city.trim().length < 2 || city.trim().length > 100)) {
        errors.push('City must be between 2 and 100 characters');
      }
    }

    // Validate state
    if (!isUpdate || state !== undefined) {
      if (!state && !isUpdate) {
        errors.push('State is required');
      } else if (state && !INDIAN_STATES.includes(state)) {
        errors.push('Invalid state. Must be a valid Indian state');
      }
    }

    // Validate pincode
    if (!isUpdate || pincode !== undefined) {
      if (!pincode && !isUpdate) {
        errors.push('Pincode is required');
      } else if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
        errors.push('Pincode must be a valid 6-digit number (cannot start with 0)');
      }
    }

    // Validate email
    if (!isUpdate || email !== undefined) {
      if (!email && !isUpdate) {
        errors.push('Email is required');
      } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format');
      }
    }

    // Validate phone
    if (!isUpdate || phone !== undefined) {
      if (!phone && !isUpdate) {
        errors.push('Phone number is required');
      } else if (phone && !/^[6-9][0-9]{9}$/.test(phone)) {
        errors.push('Phone must be a valid 10-digit Indian mobile number');
      }
    }

    // Validate password (required only for creation)
    if (!isUpdate) {
      if (!password) {
        errors.push('Password is required');
      } else if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
      }
    } else if (password !== undefined && password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
      return;
    }

    next();
  };
};

/**
 * Validate MongoDB ObjectId
 */
export const validateObjectId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;
  
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid retailer ID format'
    });
    return;
  }

  next();
};

