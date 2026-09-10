import { Request, Response } from 'express';
import mongoose from 'mongoose';
import NamePlateConfig from '../models/namePlateConfig.model';

const validId = (id: string) => mongoose.isValidObjectId(id);

export const getNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validId(productId)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }
    const config = await NamePlateConfig.findOne({ productId, isActive: true });
    res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch name plate configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const upsertNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validId(productId)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }
    const config = await NamePlateConfig.findOneAndUpdate(
      { productId },
      { $set: { ...req.body, productId, subCategoryId: undefined } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, message: 'Name plate configuration saved', data: config });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Failed to save name plate configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const getSubCategoryNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subCategoryId } = req.params;
    if (!validId(subCategoryId)) { res.status(400).json({ success: false, message: 'Invalid subcategory ID' }); return; }
    const config = await NamePlateConfig.findOne({ subCategoryId, isActive: true });
    res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch name plate subcategory configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const upsertSubCategoryNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subCategoryId } = req.params;
    if (!validId(subCategoryId)) { res.status(400).json({ success: false, message: 'Invalid subcategory ID' }); return; }
    const config = await NamePlateConfig.findOneAndUpdate(
      { subCategoryId },
      { $set: { ...req.body, subCategoryId, productId: undefined } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, message: 'Name plate subcategory configuration saved', data: config });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Failed to save name plate subcategory configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};
