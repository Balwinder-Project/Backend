import { Request, Response } from 'express';
import SymbolLibraryItem from '../models/symbolLibrary.model';

const isValidId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

const STARTER_SYMBOLS = [
  ['Ganesha 01', 'God & Goddess', '🙏', 'ganesha'], ['Ganesha 02', 'God & Goddess', '🙏', 'ganesha'], ['Ganesha 03', 'God & Goddess', '🙏', 'ganesha'],
  ['Om', 'Hindu Symbols', 'ॐ', 'om'], ['Swastik', 'Hindu Symbols', '卐', 'swastik'], ['Kalash', 'Hindu Symbols', '🏺', 'kalash'],
  ['Trishul', 'Hindu Symbols', '🔱', 'trishul'], ['Shiv Ling', 'Hindu Symbols', '🕉', 'shiv-ling'], ['Nandi', 'God & Goddess', '🐂', 'nandi'],
  ['Hanuman', 'God & Goddess', '🙏', 'hanuman'], ['Ram', 'God & Goddess', '🏹', 'ram'], ['Krishna', 'God & Goddess', '🪈', 'krishna'],
  ['Radha Krishna', 'God & Goddess', '🪷', 'radha-krishna'], ['Durga', 'God & Goddess', '👁', 'durga'], ['Lakshmi', 'God & Goddess', '🪷', 'lakshmi'],
  ['Saraswati', 'God & Goddess', '🎵', 'saraswati'], ['Sai Baba', 'Spiritual', '🧘', 'sai-baba'], ['Buddha', 'Spiritual', '☸', 'buddha'],
  ['Khanda', 'Religious', '☬', 'khanda'], ['Ek Onkar', 'Religious', 'ੴ', 'ek-onkar'], ['Cross', 'Religious', '✝', 'cross'],
  ['Crescent Moon', 'Religious', '☪', 'crescent-moon'], ['Star', 'Modern / Minimal', '★', 'star'], ['Lotus', 'Nature & Floral', '🪷', 'lotus'],
  ['Rose', 'Nature & Floral', '🌹', 'rose'], ['Leaves', 'Nature & Floral', '🍃', 'leaves'], ['Peacock Feather', 'Nature & Floral', '🪶', 'peacock-feather'],
  ['Peacock', 'Animals & Birds', '🦚', 'peacock'], ['Tree of Life', 'Nature & Floral', '🌳', 'tree-of-life'], ['Sun', 'Nature & Floral', '☀', 'sun'],
  ['Moon & Stars', 'Spiritual', '☾', 'moon-stars'], ['Mountains', 'Nature & Floral', '⛰', 'mountains'], ['Horse', 'Animals & Birds', '🐎', 'horse'],
  ['Lion', 'Animals & Birds', '🦁', 'lion'], ['Elephant', 'Animals & Birds', '🐘', 'elephant'], ['Paw Print', 'Animals & Birds', '🐾', 'paw-print'],
  ['Home', 'Family & Home', '⌂', 'home'], ['Family', 'Family & Home', '♟', 'family'], ['Infinity', 'Abstract', '∞', 'infinity'],
  ['Heart', 'Modern / Minimal', '♥', 'heart'], ['Love', 'Modern / Minimal', '♡', 'love'], ['Crown', 'Royal & Decorative', '♛', 'crown'],
  ['Royal Fleur', 'Royal & Decorative', '⚜', 'royal-fleur'], ['Decorative 01', 'Royal & Decorative', '❧', 'decorative-01'], ['Decorative 02', 'Royal & Decorative', '❧', 'decorative-02'],
  ['Border 01', 'Royal & Decorative', '─◆─', 'border-01'], ['Border 02', 'Royal & Decorative', '─❧─', 'border-02'], ['Border 03', 'Royal & Decorative', '〰', 'border-03'],
  ['Floral 01', 'Nature & Floral', '✿', 'floral-01'], ['Floral 02', 'Nature & Floral', '❀', 'floral-02'], ['Floral 03', 'Nature & Floral', '❁', 'floral-03'],
  ['Corner 01', 'Royal & Decorative', '⌜', 'corner-01'], ['Corner 02', 'Royal & Decorative', '⌝', 'corner-02'],
].map(([name, category, value, iconKey], index) => ({
  name, category, value, iconKey,
  keywords: [String(name).toLowerCase(), String(category).toLowerCase()],
  sortOrder: index, active: true,
}));

const ensureStarterSymbols = async (): Promise<void> => {
  const count = await SymbolLibraryItem.countDocuments();
  if (count === 0) await SymbolLibraryItem.insertMany(STARTER_SYMBOLS, { ordered: false });
};

const sendError = (res: Response, error: any, fallback: string): void => {
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((e: any) => e.message);
    res.status(400).json({ success: false, message: 'Validation failed', errors });
    return;
  }
  res.status(500).json({ success: false, message: fallback, error: process.env.NODE_ENV === 'development' ? error.message : undefined });
};

/** GET /api/v1/symbols */
export const getSymbolLibrary = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureStarterSymbols();
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const includeInactive = req.query.includeInactive === 'true';
    const filter: any = {};
    if (category && category !== 'All Symbols') filter.category = category;
    if (!includeInactive) filter.active = true;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
      { keywords: { $regex: search, $options: 'i' } },
    ];
    const symbols = await SymbolLibraryItem.find(filter).sort({ sortOrder: 1, name: 1 });
    const categories = await SymbolLibraryItem.distinct('category', includeInactive ? {} : { active: true });
    res.status(200).json({ success: true, data: symbols, categories: categories.sort() });
  } catch (error: any) { sendError(res, error, 'Failed to fetch symbol library'); }
};

/** POST /api/v1/symbols */
export const createSymbolLibraryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, category, imageUrl, value, iconKey, keywords, sortOrder, active } = req.body;
    const symbol = await SymbolLibraryItem.create({ name, category, imageUrl: imageUrl || '', value: value || '', iconKey: iconKey || '', keywords: Array.isArray(keywords) ? keywords : [], sortOrder: Number(sortOrder) || 0, active: active !== false });
    res.status(201).json({ success: true, message: 'Symbol created', data: symbol });
  } catch (error: any) { sendError(res, error, 'Failed to create symbol'); }
};

/** PUT /api/v1/symbols/:id */
export const updateSymbolLibraryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid symbol ID' }); return; }
    const allowed = ['name', 'category', 'imageUrl', 'value', 'iconKey', 'keywords', 'sortOrder', 'active'];
    const updateData: Record<string, any> = {};
    allowed.forEach((key) => { if (req.body[key] !== undefined) updateData[key] = req.body[key]; });
    if (updateData.sortOrder !== undefined) updateData.sortOrder = Number(updateData.sortOrder) || 0;
    if (updateData.keywords !== undefined && !Array.isArray(updateData.keywords)) updateData.keywords = [];
    const symbol = await SymbolLibraryItem.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!symbol) { res.status(404).json({ success: false, message: 'Symbol not found' }); return; }
    res.status(200).json({ success: true, message: 'Symbol updated', data: symbol });
  } catch (error: any) { sendError(res, error, 'Failed to update symbol'); }
};

/** DELETE /api/v1/symbols/:id */
export const deleteSymbolLibraryItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) { res.status(400).json({ success: false, message: 'Invalid symbol ID' }); return; }
    const symbol = await SymbolLibraryItem.findByIdAndDelete(id);
    if (!symbol) { res.status(404).json({ success: false, message: 'Symbol not found' }); return; }
    res.status(200).json({ success: true, message: 'Symbol deleted' });
  } catch (error: any) { sendError(res, error, 'Failed to delete symbol'); }
};
