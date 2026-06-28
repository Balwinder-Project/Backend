import { Request, Response, NextFunction } from 'express';

/**
 * Validate product creation/update data
 */
export const validateProductData = (isUpdate: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { name, description, price, sku, category, subCategories, tags, stock, images, isActive, isFeatured, normalUserPricing, retailerPricing } = req.body;
    const errors: string[] = [];

    // Validate name
    if (!isUpdate || name !== undefined) {
      if (!name && !isUpdate) {
        errors.push('Name is required');
      } else if (name && (name.trim().length < 2 || name.trim().length > 200)) {
        errors.push('Name must be between 2 and 200 characters');
      }
    }

    // Validate description (optional) — allows rich-text HTML, so a larger limit
    if (description && description.length > 20000) {
      errors.push('Description cannot exceed 20000 characters');
    }

    // Validate price
    if (!isUpdate || price !== undefined) {
      if (price === undefined && !isUpdate) {
        errors.push('Price is required');
      } else if (price !== undefined && (typeof price !== 'number' || price < 0)) {
        errors.push('Price must be a non-negative number');
      }
    }

    // Validate SKU
    if (!isUpdate || sku !== undefined) {
      if (!sku && !isUpdate) {
        errors.push('SKU is required');
      } else if (sku && sku.trim().length === 0) {
        errors.push('SKU cannot be empty');
      }
    }

    // Validate category
    if (!isUpdate || category !== undefined) {
      if (!category && !isUpdate) {
        errors.push('Category is required');
      } else if (category && !/^[0-9a-fA-F]{24}$/.test(category)) {
        errors.push('Invalid category ID format');
      }
    }

    // Validate subCategories (optional array)
    if (subCategories !== undefined) {
      if (!Array.isArray(subCategories)) {
        errors.push('subCategories must be an array');
      } else {
        const invalidIds = subCategories.filter((id: any) => !/^[0-9a-fA-F]{24}$/.test(id));
        if (invalidIds.length > 0) {
          errors.push('Invalid subcategory ID format in subCategories');
        }
      }
    }

    // Validate tags (optional array)
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        errors.push('Tags must be an array');
      } else if (tags.length > 0) {
        const invalidTags = tags.filter(tag => !/^[0-9a-fA-F]{24}$/.test(tag));
        if (invalidTags.length > 0) {
          errors.push('Invalid tag ID format');
        }
      }
    }

    // Validate stock
    if (!isUpdate || stock !== undefined) {
      if (stock === undefined && !isUpdate) {
        errors.push('Stock quantity is required');
      } else if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
        errors.push('Stock must be a non-negative number');
      }
    }

    // Validate images (optional array)
    if (images !== undefined) {
      if (!Array.isArray(images)) {
        errors.push('Images must be an array');
      }
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    }

    if (isFeatured !== undefined && typeof isFeatured !== 'boolean') {
      errors.push('isFeatured must be a boolean');
    }

    // Validate normalUserPricing (optional array of slabs)
    if (normalUserPricing !== undefined) {
      if (!Array.isArray(normalUserPricing)) {
        errors.push('normalUserPricing must be an array');
      } else {
        normalUserPricing.forEach((slab: any, i: number) => {
          if (typeof slab.minQuantity !== 'number' || slab.minQuantity < 1) {
            errors.push(`normalUserPricing[${i}].minQuantity must be a number >= 1`);
          }
          if (typeof slab.price !== 'number' || slab.price < 0) {
            errors.push(`normalUserPricing[${i}].price must be a non-negative number`);
          }
        });
      }
    }

    // Validate retailerPricing (optional object)
    if (retailerPricing !== undefined) {
      if (typeof retailerPricing !== 'object' || retailerPricing === null) {
        errors.push('retailerPricing must be an object');
      } else {
        if (
          retailerPricing.minimumOrderQuantity !== undefined &&
          (typeof retailerPricing.minimumOrderQuantity !== 'number' || retailerPricing.minimumOrderQuantity < 1)
        ) {
          errors.push('retailerPricing.minimumOrderQuantity must be a number >= 1');
        }
        if (retailerPricing.slabs !== undefined) {
          if (!Array.isArray(retailerPricing.slabs)) {
            errors.push('retailerPricing.slabs must be an array');
          } else {
            retailerPricing.slabs.forEach((slab: any, i: number) => {
              if (typeof slab.minQuantity !== 'number' || slab.minQuantity < 1) {
                errors.push(`retailerPricing.slabs[${i}].minQuantity must be a number >= 1`);
              }
              if (typeof slab.price !== 'number' || slab.price < 0) {
                errors.push(`retailerPricing.slabs[${i}].price must be a non-negative number`);
              }
            });
          }
        }
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
      message: 'Invalid product ID format'
    });
    return;
  }

  next();
};
