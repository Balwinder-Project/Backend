import { Request, Response, NextFunction } from 'express';

const validateString = (
  value: unknown,
  field: string,
  errors: string[],
  options: { required: boolean; min?: number; max?: number }
) => {
  if (value === undefined || value === null) {
    if (options.required) errors.push(`${field} is required`);
    return;
  }

  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`);
    return;
  }

  const trimmed = value.trim();
  if (!trimmed && options.required) {
    errors.push(`${field} is required`);
    return;
  }

  if (options.min !== undefined && trimmed.length < options.min) {
    errors.push(`${field} must be at least ${options.min} characters`);
  }

  if (options.max !== undefined && trimmed.length > options.max) {
    errors.push(`${field} cannot exceed ${options.max} characters`);
  }
};

export const validateHeroSlideData = (isUpdate: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { title, description, imageUrl, buttonText, buttonLink, position } = req.body;
    const required = !isUpdate;
    const errors: string[] = [];

    validateString(title, 'Title', errors, { required, min: 2, max: 120 });
    validateString(description, 'Description', errors, { required, min: 2, max: 1000 });
    validateString(imageUrl, 'Image URL', errors, { required, min: 1 });
    validateString(buttonText, 'Button title', errors, { required, min: 1, max: 80 });
    validateString(buttonLink, 'Button link', errors, { required, min: 1 });

    if (position === undefined || position === null) {
      if (required) errors.push('Position is required');
    } else if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) {
      errors.push('Position must be a non-negative number');
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    next();
  };
};

export const validateObjectId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid hero slide ID format',
    });
    return;
  }

  next();
};
