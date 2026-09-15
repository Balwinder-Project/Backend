import { Request, Response } from 'express';
import SymbolLibraryItem from '../models/symbolLibrary.model';

const isValidId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

const sendError = (res: Response, error: any, fallback: string): void => {
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((e: any) => e.message);
    res.status(400).json({ success: false, message: 'Validation failed', errors });
    return;
  }
  res.status(500).json({
    success: false,
    message: fallback,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
};

/** GET /api/v1/symbol-library */
export const getSymbolLibrary = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const includeInactive = req.query.includeInactive === 'true';

    const filter: any = {};
    if (category && category !== 'All Symbols') filter.category = category;
    if (!includeInactive) filter.active = true;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { keywords: { $regex: search, $options: 'i' } },
      ];
    }

    const symbols = await SymbolLibraryItem.find(filter).sort({ sortOrder: 1, name: 1 });
    const categories = await SymbolLibraryItem.distinct('category', includeInactive ? {} : { active: true });

    res.status(200).json({
      success: true,
      data: symbols,
      categories: categories.sort(),
    });
  } catch (error: any) {
    sendError(res, error, 'Failed to fetch symbol library');
  }
};

/** POST /api/v1/symbol-library */
export const createSymbolLibraryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, category, imageUrl, value, iconKey, keywords, sortOrder, active } = req.body;
    const symbol = await SymbolLibraryItem.create({
      name,
      category,
      imageUrl: imageUrl || '',
      value: value || '',
      iconKey: iconKey || '',
      keywords: Array.isArray(keywords) ? keywords : [],
      sortOrder: Number(sortOrder) || 0,
      active: active !== false,
    });
    res.status(201).json({ success: true, message: 'Symbol created', data: symbol });
  } catch (error: any) {
    sendError(res, error, 'Failed to create symbol');
  }
};

/** PUT /api/v1/symbol-library/:id */
export const updateSymbolLibraryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ success: false, message: 'Invalid symbol ID' });
      return;
    }

    const allowed = ['name', 'category', 'imageUrl', 'value', 'iconKey', 'keywords', 'sortOrder', 'active'];
    const updateData: Record<string, any> = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    });
    if (updateData.sortOrder !== undefined) updateData.sortOrder = Number(updateData.sortOrder) || 0;
    if (updateData.keywords !== undefined && !Array.isArray(updateData.keywords)) updateData.keywords = [];

    const symbol = await SymbolLibraryItem.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!symbol) {
      res.status(404).json({ success: false, message: 'Symbol not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Symbol updated', data: symbol });
  } catch (error: any) {
    sendError(res, error, 'Failed to update symbol');
  }
};

/** DELETE /api/v1/symbol-library/:id */
export const deleteSymbolLibraryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ success: false, message: 'Invalid symbol ID' });
      return;
    }
    const symbol = await SymbolLibraryItem.findByIdAndDelete(id);
    if (!symbol) {
      res.status(404).json({ success: false, message: 'Symbol not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Symbol deleted' });
  } catch (error: any) {
    sendError(res, error, 'Failed to delete symbol');
  }
};
