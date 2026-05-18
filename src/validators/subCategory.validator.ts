import { Request, Response, NextFunction } from 'express';
import { generateSlug } from '../utils/slug';

export const validateSubCategoryData = (isUpdate: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { name, description, category, isActive, parent } = req.body;
    const errors: string[] = [];

    if (!isUpdate || name !== undefined) {
      if (!name && !isUpdate) {
        errors.push('Name is required');
      } else if (name && (name.trim().length < 2 || name.trim().length > 100)) {
        errors.push('Name must be between 2 and 100 characters');
      }
    }

    if (description && description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    if (!isUpdate || category !== undefined) {
      if (!category && !isUpdate) {
        errors.push('Category is required');
      } else if (category && !/^[0-9a-fA-F]{24}$/.test(category)) {
        errors.push('Invalid category ID format');
      }
    }

    if (parent !== undefined && parent !== null && parent !== '') {
      if (!/^[0-9a-fA-F]{24}$/.test(parent)) {
        errors.push('Invalid parent subcategory ID format');
      }
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    if (name) {
      req.body.slug = generateSlug(name);
    }

    next();
  };
};

export const validateObjectId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid subcategory ID format',
    });
    return;
  }

  next();
};
