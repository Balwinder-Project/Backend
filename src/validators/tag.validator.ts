import { Request, Response, NextFunction } from 'express';
import { generateSlug } from '../utils/slug';

/**
 * Validate tag creation/update data
 */
export const validateTagData = (isUpdate: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { name } = req.body;
    const errors: string[] = [];

    // Validate name
    if (!isUpdate || name !== undefined) {
      if (!name && !isUpdate) {
        errors.push('Name is required');
      } else if (name && (name.trim().length < 2 || name.trim().length > 50)) {
        errors.push('Name must be between 2 and 50 characters');
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
      return;
    }

    // Auto-generate slug from name
    if (name) {
      req.body.slug = generateSlug(name);
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
      message: 'Invalid tag ID format'
    });
    return;
  }

  next();
};

