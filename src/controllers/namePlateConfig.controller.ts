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

    const subCategoryObjectId = new mongoose.Types.ObjectId(subCategoryId);
    const config = await NamePlateConfig.findOne({
      subCategoryId: subCategoryObjectId,
      isActive: true,
    }).lean();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Preview-only diagnostic mode. It never exposes MONGODB_URI or credentials and lets us
    // distinguish a query/filter problem from a persistence/database-target problem.
    if (req.query.debug === '1') {
      const allMatches = await NamePlateConfig.find({ subCategoryId: subCategoryObjectId })
        .select('_id subCategoryId productId isActive designs finishes sizes symbols layouts basePrice customLayoutSurcharge createdAt updatedAt')
        .lean();

      res.status(200).json({
        success: true,
        data: config ?? null,
        diagnostics: {
          databaseName: mongoose.connection.db?.databaseName ?? null,
          collectionName: NamePlateConfig.collection.name,
          connectionState: mongoose.connection.readyState,
          totalMatches: allMatches.length,
          activeMatches: allMatches.filter((item: any) => item.isActive === true).length,
          records: allMatches.map((item: any) => ({
            _id: item._id,
            subCategoryId: item.subCategoryId,
            productId: item.productId ?? null,
            isActive: item.isActive,
            designs: Array.isArray(item.designs) ? item.designs.length : 0,
            finishes: Array.isArray(item.finishes) ? item.finishes.length : 0,
            sizes: Array.isArray(item.sizes) ? item.sizes.length : 0,
            symbols: Array.isArray(item.symbols) ? item.symbols.length : 0,
            layouts: Array.isArray(item.layouts) ? item.layouts.length : 0,
            basePrice: item.basePrice,
            customLayoutSurcharge: item.customLayoutSurcharge,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })),
        },
      });
      return;
    }

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
