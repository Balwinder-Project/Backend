import { Request, Response, NextFunction } from 'express';

const RENDER_MODES = ['flat', 'perspective', 'curved'];

export const validateMockupTemplateData = (isUpdate: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { name, baseImage, renderMode, corners, subCategories } = req.body;
    const errors: string[] = [];

    if (!isUpdate || name !== undefined) {
      if (!name && !isUpdate) {
        errors.push('Name is required');
      } else if (name && (name.trim().length < 2 || name.trim().length > 120)) {
        errors.push('Name must be between 2 and 120 characters');
      }
    }

    if (!isUpdate || baseImage !== undefined) {
      if (!baseImage && !isUpdate) {
        errors.push('Base scene image is required');
      }
    }

    if (renderMode !== undefined && !RENDER_MODES.includes(renderMode)) {
      errors.push(`renderMode must be one of: ${RENDER_MODES.join(', ')}`);
    }

    // Perspective/curved modes need four corner points.
    if (renderMode === 'perspective' || renderMode === 'curved') {
      const ok =
        corners &&
        ['tl', 'tr', 'br', 'bl'].every(
          (k) => Array.isArray(corners[k]) && corners[k].length === 2
        );
      if (!ok) {
        errors.push('Perspective/curved templates require corners with tl, tr, br, bl [x, y] points');
      }
    }

    if (subCategories !== undefined) {
      if (!Array.isArray(subCategories)) {
        errors.push('subCategories must be an array');
      } else {
        const invalid = subCategories.some((id: any) => !/^[0-9a-fA-F]{24}$/.test(String(id)));
        if (invalid) errors.push('One or more subcategory IDs are invalid');
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: 'Validation failed', errors });
      return;
    }

    next();
  };
};

export const validateObjectId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    res.status(400).json({ success: false, message: 'Invalid mockup template ID format' });
    return;
  }
  next();
};
