import { Request, Response } from 'express';
import mongoose from 'mongoose';
import NamePlateConfig from '../models/namePlateConfig.model';

const validId = (id: string) => mongoose.isValidObjectId(id);

export const getNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validId(productId)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }
    const config = await NamePlateConfig.findOne({ productId, isActive: true }).lean();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).json({ success: true, data: config ?? null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch name plate configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const upsertNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validId(productId)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }
    const payload = { ...req.body, productId: new mongoose.Types.ObjectId(productId) };
    delete payload.subCategoryId;
    payload.isActive = payload.isActive !== false;
    const config = await NamePlateConfig.findOneAndUpdate(
      { productId: payload.productId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    res.status(200).json({ success: true, message: 'Name plate configuration saved', data: config });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Failed to save name plate configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const getSubCategoryNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subCategoryId } = req.params;
    if (!validId(subCategoryId)) { res.status(400).json({ success: false, message: 'Invalid subcategory ID' }); return; }

    const config = await NamePlateConfig.findOne({
      subCategoryId: new mongoose.Types.ObjectId(subCategoryId),
      isActive: true,
    }).lean();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).json({ success: true, data: config ?? null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch name plate subcategory configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const upsertSubCategoryNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subCategoryId } = req.params;
    if (!validId(subCategoryId)) { res.status(400).json({ success: false, message: 'Invalid subcategory ID' }); return; }

    const subCategoryObjectId = new mongoose.Types.ObjectId(subCategoryId);
    const payload = { ...req.body, subCategoryId: subCategoryObjectId };
    delete payload.productId;

    // A saved admin configuration is active by default. Only an explicit false disables it.
    payload.isActive = payload.isActive !== false;

    const config = await NamePlateConfig.findOneAndUpdate(
      { subCategoryId: subCategoryObjectId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    if (!config) {
      throw new Error('Name plate configuration was not persisted');
    }

    // Read back from MongoDB before responding so the admin UI only receives a successful
    // response after the reusable SS Name Plates configuration is actually persisted.
    const persisted = await NamePlateConfig.findOne({
      subCategoryId: subCategoryObjectId,
    }).lean();

    if (!persisted) {
      throw new Error('Name plate configuration could not be read back after save');
    }

    res.status(200).json({ success: true, message: 'Name plate subcategory configuration saved', data: persisted });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Failed to save name plate subcategory configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};
