import { Request, Response } from 'express';
import mongoose from 'mongoose';
import SubCategory from '../models/subCategory.model';

const CONFIG_KEY = 'namePlateConfig';

function getConfig(subCategory: any) {
  const fieldTemplate = subCategory?.fieldTemplate;
  if (fieldTemplate && typeof fieldTemplate === 'object' && fieldTemplate[CONFIG_KEY]) {
    return fieldTemplate[CONFIG_KEY];
  }
  return null;
}

/** GET /api/v1/name-plate-config/subcategory/:subCategoryId */
export async function getNamePlateConfigBySubCategory(req: Request, res: Response): Promise<void> {
  try {
    const { subCategoryId } = req.params;
    if (!mongoose.isValidObjectId(subCategoryId)) {
      res.status(400).json({ success: false, message: 'Invalid subcategory ID' });
      return;
    }
    const subCategory = await SubCategory.findById(subCategoryId).lean();
    if (!subCategory) {
      res.status(404).json({ success: false, message: 'Name plate subcategory not found' });
      return;
    }
    const config = getConfig(subCategory) || {
      subCategoryId: String(subCategory._id),
      categories: [],
      designs: [],
      finishes: [],
      sizes: [],
      layouts: [],
      symbols: [],
      basePrice: 0,
      customLayoutSurcharge: 0,
      isActive: true,
      previewSettings: {},
    };
    res.status(200).json({ success: true, data: { ...config, subCategoryId: String(subCategory._id) } });
  } catch (error: any) {
    console.error('Error loading name plate configuration:', error);
    res.status(500).json({ success: false, message: 'Failed to load name plate configuration' });
  }
}

/** PUT /api/v1/name-plate-config/subcategory/:subCategoryId */
export async function saveNamePlateConfigBySubCategory(req: Request, res: Response): Promise<void> {
  try {
    const { subCategoryId } = req.params;
    if (!mongoose.isValidObjectId(subCategoryId)) {
      res.status(400).json({ success: false, message: 'Invalid subcategory ID' });
      return;
    }
    const subCategory = await SubCategory.findById(subCategoryId);
    if (!subCategory) {
      res.status(404).json({ success: false, message: 'Name plate subcategory not found' });
      return;
    }
    const current = subCategory.fieldTemplate && typeof subCategory.fieldTemplate === 'object'
      ? subCategory.fieldTemplate.toObject?.() || subCategory.fieldTemplate
      : {};
    const config = { ...req.body, subCategoryId: String(subCategory._id) };
    subCategory.fieldTemplate = { ...current, [CONFIG_KEY]: config };
    await subCategory.save();
    res.status(200).json({ success: true, message: 'Name plate configuration saved', data: config });
  } catch (error: any) {
    console.error('Error saving name plate configuration:', error);
    res.status(500).json({ success: false, message: 'Failed to save name plate configuration' });
  }
}
