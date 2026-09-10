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
      { $set: { ...req.body, productId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, message: 'Name plate configuration saved', data: config });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Failed to save name plate configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};
