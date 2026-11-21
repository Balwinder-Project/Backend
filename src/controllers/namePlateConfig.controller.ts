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


/** Public, read-only configuration for the customer-facing name plate preview. */
export async function getPublicNamePlateConfigBySubCategory(req: Request, res: Response): Promise<void> {
  try {
    const { subCategoryId } = req.params;
    if (!mongoose.isValidObjectId(subCategoryId)) {
      res.status(400).json({ success: false, message: 'Invalid subcategory ID' });
      return;
    }

    const subCategory = await SubCategory.findById(subCategoryId).lean();
    if (!subCategory || (subCategory as any).isActive === false) {
      res.status(404).json({ success: false, message: 'Name plate subcategory not found or inactive' });
      return;
    }

    const config = getConfig(subCategory);
    if (!config || config.isActive === false) {
      res.status(200).json({ success: true, data: null });
      return;
    }

    // Expose only active, customer-facing data. Admin-only configuration and
    // editing controls are deliberately omitted from this public response.
    const designs = (Array.isArray(config.designs) ? config.designs : [])
      .filter((design: any) => design && design.active !== false)
      .map((design: any) => ({
        id: design.id,
        name: design.name,
        previewImage: design.previewImage || '',
        templateImage: design.templateImage || '',
        layers: (Array.isArray(design.layers) ? design.layers : []).map((layer: any) => ({
          id: layer.id,
          name: layer.name,
          type: layer.type,
          text: layer.text,
          x: layer.x,
          y: layer.y,
          fontSize: layer.fontSize,
          color: layer.color,
          visible: layer.visible,
          customerEditable: layer.customerEditable,
          fontFamily: layer.fontFamily,
          bold: layer.bold,
          italic: layer.italic,
          align: layer.align,
          letterSpacing: layer.letterSpacing,
          maxLength: layer.maxLength,
        })),
        baseWidth: design.baseWidth,
        baseHeight: design.baseHeight,
        minWidth: design.minWidth,
        maxWidth: design.maxWidth,
        minHeight: design.minHeight,
        maxHeight: design.maxHeight,
        ratio: design.ratio,
        pricePerSqIn: design.pricePerSqIn,
        finishCharge: design.finishCharge,
        ledPrice: design.ledPrice,
        drillingCharge: design.drillingCharge,
        minimumOrderPrice: design.minimumOrderPrice,
        fixedArtworkPosition: design.fixedArtworkPosition,
        product: design.product,
      }));

    const previewSettings = config.previewSettings || {};
    const publicConfig = {
      subCategoryId: String((subCategory as any)._id),
      isActive: true,
      designs,
      finishes: (Array.isArray(config.finishes) ? config.finishes : []).filter((item: any) => item && item.active !== false),
      sizes: (Array.isArray(config.sizes) ? config.sizes : []).filter((item: any) => item && item.active !== false),
      layouts: Array.isArray(config.layouts) ? config.layouts : [],
      symbols: (Array.isArray(config.symbols) ? config.symbols : []).filter((item: any) => item && item.active !== false),
      basePrice: Number(config.basePrice || 0),
      customLayoutSurcharge: Number(config.customLayoutSurcharge || 0),
      previewSettings: {
        placementSettings: previewSettings.placementSettings || {},
        customDesign: previewSettings.customDesign || {},
        plateColors: previewSettings.plateColors || [],
        frontColors: previewSettings.frontColors || [],
        fontColors: previewSettings.fontColors || [],
        symbolColors: previewSettings.symbolColors || [],
      },
    };

    res.status(200).json({ success: true, data: publicConfig });
  } catch (error: any) {
    console.error('Error loading public name plate configuration:', error);
    res.status(500).json({ success: false, message: 'Failed to load name plate preview configuration' });
  }
}
