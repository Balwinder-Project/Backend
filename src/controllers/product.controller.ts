import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { CatalogueQcService } from '../services/catalogueQc.service';
import { MockupService } from '../services/mockup.service';
import { RetailerService } from '../services/retailer.service';
import { DiscountCampaignService } from '../services/discountCampaign.service';
import { ADMIN_ROLE_CLAIM, hasAdminPermission } from '../constants/adminRoles';
import { transformProductImages, isNamePlateCategory } from '../utils/imageTransform';

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const productCategoryId = (obj: any): string => {
  if (obj.category && typeof obj.category === 'object') return String(obj.category.id || obj.category._id || '');
  return String(obj.category || '');
};

/**
 * Resolve pricing for a public (non-admin) product response.
 *  - Retailer: per-product special slabs → their per-category % discount (as
 *    absolute slabs) → global wholesale slabs. retailerSpecialPricing is always
 *    stripped so no retailer sees another's negotiated prices.
 *  - Normal / guest: attach the active category campaign %.
 * @param obj  A product plain object (post toJSON).
 * @param retailer  The requesting retailer doc, or null for guests/customers.
 * @param campaignPercents  categoryId -> active campaign %.
 */
const resolveBuyerPricing = (obj: any, retailer: any | null, campaignPercents: Map<string, number>): any => {
  const special = Array.isArray(obj.retailerSpecialPricing) ? obj.retailerSpecialPricing : [];
  const categoryId = productCategoryId(obj);

  if (retailer) {
    const retailerId = String(retailer._id);
    const match = special.find((s: any) => String(s.retailer) === retailerId);
    if (match && Array.isArray(match.slabs) && match.slabs.length > 0) {
      obj.retailerPricing = { minimumOrderQuantity: match.minimumOrderQuantity ?? 1, slabs: match.slabs };
    } else {
      // Attach the retailer's category-discount slabs (raw %). The discount is
      // based on the whole-cart quantity for this category, so it's applied at
      // cart/checkout time on the client and re-verified in createOrder.
      const catDiscount = (retailer.categoryDiscounts || []).find(
        (d: any) => String(d.category) === categoryId
      );
      if (catDiscount && Array.isArray(catDiscount.slabs) && catDiscount.slabs.length > 0) {
        obj.retailerCategoryDiscount = {
          category: categoryId,
          slabs: catDiscount.slabs.map((s: any) => ({
            minQuantity: s.minQuantity,
            discountPercentage: s.discountPercentage,
          })),
        };
      }
    }
    obj.categoryCampaignPercent = 0; // retailers keep their own pricing
  } else {
    obj.categoryCampaignPercent = campaignPercents.get(categoryId) || 0;
  }

  delete obj.retailerSpecialPricing;
  return obj;
};

/** Look up the requesting user's retailer doc (null if they aren't a retailer). */
const getRequestingRetailer = async (req: Request): Promise<any | null> => {
  if (!req.user?.uid) return null;
  try {
    return await RetailerService.getRetailerByFirebaseUid(req.user.uid);
  } catch {
    return null;
  }
};

const getActor = (req: Request) => ({
  uid: req.user?.uid || 'unknown',
  email: req.user?.email,
});

const sendMutationError = (res: Response, error: any, fallbackMessage: string): void => {
  if (
    error.message === 'Category not found' ||
    error.message === 'Subcategory not found' ||
    error.message === 'One or more subcategories not found or do not belong to the selected category' ||
    error.message === 'One or more tags were not found' ||
    error.message === 'product not found'
  ) {
    res.status(400).json({
      success: false,
      message: error.message
    });
    return;
  }

  if (error.message === 'A product with this SKU already exists' || error.code === 11000) {
    res.status(409).json({
      success: false,
      message: 'A product with this SKU already exists'
    });
    return;
  }

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: fallbackMessage,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

/**
 * Create a new product
 * POST /api/v1/products
 */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      features,
      price,
      sku,
      images,
      holographicImages,
      category,
      subCategories,
      tags,
      stock,
      isActive,
      isFeatured,
      isHomepageSticker,
      homepageStickerOrder,
      customFields,
      normalUserPricing,
      retailerPricing,
      retailerSpecialPricing,
      weight,
      length,
      breadth,
      height,
    } = req.body;

    const productData = {
      name,
      description,
      features: features || [],
      price,
      sku,
      images: images || [],
      holographicImages: holographicImages || [],
      category,
      subCategories: subCategories || [],
      tags: tags || [],
      stock: stock !== undefined ? stock : 0,
      isActive: isActive !== undefined ? isActive : true,
      isFeatured: isFeatured !== undefined ? isFeatured : false,
      isHomepageSticker: isHomepageSticker !== undefined ? isHomepageSticker : false,
      homepageStickerOrder: homepageStickerOrder !== undefined ? homepageStickerOrder : 0,
      customFields: customFields || null,
      normalUserPricing: normalUserPricing || [],
      retailerPricing: retailerPricing || { minimumOrderQuantity: 1, slabs: [] },
      retailerSpecialPricing: retailerSpecialPricing || [],
      weight: weight !== undefined ? weight : 0.5,
      length: length !== undefined ? length : 10,
      breadth: breadth !== undefined ? breadth : 10,
      height: height !== undefined ? height : 5,
    } as any;

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('product', 'create', productData, getActor(req));
      res.status(202).json({
        success: true,
        message: 'Product submitted for QC approval',
        data: request
      });
      return;
    }

    const product = await ProductService.createProduct(productData);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error: any) {
    console.error('Error creating product:', error);

    sendMutationError(res, error, 'Failed to create product');
  }
};

/**
 * Get all products with pagination and filters
 * GET /api/v1/products
 */
export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const category = req.query.category as string;
    const subCategory = req.query.subCategory as string;
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    const featured = parseBooleanQuery(req.query.featured);
    const active = parseBooleanQuery(req.query.active);
    const homepageSticker = parseBooleanQuery(req.query.homepageSticker);

    const result = await ProductService.getAllProducts(page, limit, search, category, subCategory, tags, featured, active, homepageSticker);

    const isAdmin = req.user?.role === ADMIN_ROLE_CLAIM;
    let products;
    if (isAdmin) {
      products = result.products;
    } else {
      const retailer = await getRequestingRetailer(req);
      const campaignPercents = retailer ? new Map<string, number>() : await DiscountCampaignService.getActiveCategoryPercents();
      products = result.products.map((p: any) => {
        const obj = typeof p.toJSON === 'function' ? p.toJSON() : { ...p };
        obj.images = transformProductImages(obj.images || [], 'thumbnail');
        return resolveBuyerPricing(obj, retailer, campaignPercents);
      });
    }

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get product by ID
 * GET /api/v1/products/:id
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await ProductService.getProductById(id);

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    const isAdmin = req.user?.role === ADMIN_ROLE_CLAIM;
    if (isAdmin) {
      res.status(200).json({
        success: true,
        data: product
      });
      return;
    }

    const productObj: any = typeof (product as any).toJSON === 'function' ? (product as any).toJSON() : { ...product };
    // Name Plate products show clean product photos (no brand watermark).
    // All other categories keep the watermarked high-res variant for the public PDP.
    if (!isNamePlateCategory(productObj.category)) {
      productObj.images = transformProductImages(productObj.images || [], 'watermarked');
    }
    const retailer = await getRequestingRetailer(req);
    const campaignPercents = retailer ? new Map<string, number>() : await DiscountCampaignService.getActiveCategoryPercents();
    resolveBuyerPricing(productObj, retailer, campaignPercents);

    res.status(200).json({
      success: true,
      data: productObj
    });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update product
 * PUT /api/v1/products/:id
 */
/**
 * Bulk update pricing for a product group/category.
 * PATCH /api/v1/products/bulk-pricing
 *
 * Targeting is intentionally explicit:
 * - skuPrefix can target groups such as 2627EAGLE
 * - categoryId can target an entire Mongo category
 * Both may be supplied together to narrow the update.
 *
 * Only the base product price and shared user/retailer slabs are changed.
 * Per-retailer special pricing is never overwritten by this endpoint.
 */
export const previewBulkSubcategoryAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, subCategoryId, skuPrefix, limit } = req.body;
    if (!categoryId || !subCategoryId) {
      res.status(400).json({ success: false, message: 'categoryId and subCategoryId are required' });
      return;
    }
    if (skuPrefix !== undefined && (typeof skuPrefix !== 'string' || !skuPrefix.trim())) {
      res.status(400).json({ success: false, message: 'skuPrefix must be a non-empty string when provided' });
      return;
    }
    if (!hasAdminPermission(req.user, 'OWNER')) {
      res.status(403).json({ success: false, message: 'Subcategory assignment requires OWNER permission' });
      return;
    }
    const result = await ProductService.previewBulkSubcategoryAssignment({
      categoryId,
      subCategoryId,
      skuPrefix: typeof skuPrefix === 'string' ? skuPrefix.trim() : undefined,
      limit: typeof limit === 'number' ? limit : undefined,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error previewing bulk subcategory assignment:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to preview subcategory assignment' });
  }
};

export const bulkAssignSubcategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, subCategoryId, skuPrefix } = req.body;
    if (!categoryId || !subCategoryId) {
      res.status(400).json({ success: false, message: 'categoryId and subCategoryId are required' });
      return;
    }
    if (skuPrefix !== undefined && (typeof skuPrefix !== 'string' || !skuPrefix.trim())) {
      res.status(400).json({ success: false, message: 'skuPrefix must be a non-empty string when provided' });
      return;
    }
    if (!hasAdminPermission(req.user, 'OWNER')) {
      res.status(403).json({ success: false, message: 'Subcategory assignment requires OWNER permission' });
      return;
    }
    const result = await ProductService.bulkAssignSubcategory({
      categoryId,
      subCategoryId,
      skuPrefix: typeof skuPrefix === 'string' ? skuPrefix.trim() : undefined,
    });
    res.status(200).json({ success: true, message: 'Products assigned to subcategory successfully', data: result });
  } catch (error: any) {
    console.error('Error bulk assigning subcategory:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to assign products to subcategory' });
  }
};
export const previewBulkProductPricing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, skuPrefix, limit } = req.body;

    if (!categoryId && !skuPrefix) {
      res.status(400).json({ success: false, message: 'At least one target is required: categoryId or skuPrefix' });
      return;
    }

    if (skuPrefix !== undefined && (typeof skuPrefix !== 'string' || !skuPrefix.trim())) {
      res.status(400).json({ success: false, message: 'skuPrefix must be a non-empty string' });
      return;
    }

    if (!hasAdminPermission(req.user, 'OWNER')) {
      res.status(403).json({ success: false, message: 'Bulk pricing preview requires OWNER permission' });
      return;
    }

    const result = await ProductService.previewBulkPricing({
      categoryId,
      skuPrefix: typeof skuPrefix === 'string' ? skuPrefix.trim() : undefined,
      limit: typeof limit === 'number' ? limit : undefined,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error previewing bulk product pricing:', error);
    res.status(error.message === 'Category not found' ? 400 : 500).json({
      success: false,
      message: error.message === 'Category not found' ? error.message : 'Failed to preview bulk product pricing',
    });
  }
};

export const bulkUpdateProductPricing = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      categoryId,
      skuPrefix,
      price,
      normalUserPricing,
      retailerPricing,
    } = req.body;

    if (!categoryId && !skuPrefix) {
      res.status(400).json({
        success: false,
        message: 'At least one target is required: categoryId or skuPrefix',
      });
      return;
    }

    if (price === undefined && normalUserPricing === undefined && retailerPricing === undefined) {
      res.status(400).json({
        success: false,
        message: 'Provide at least one pricing field: price, normalUserPricing, or retailerPricing',
      });
      return;
    }

    if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
      res.status(400).json({ success: false, message: 'price must be a non-negative number' });
      return;
    }

    if (skuPrefix !== undefined && (typeof skuPrefix !== 'string' || !skuPrefix.trim())) {
      res.status(400).json({ success: false, message: 'skuPrefix must be a non-empty string' });
      return;
    }

    if (normalUserPricing !== undefined && !Array.isArray(normalUserPricing)) {
      res.status(400).json({ success: false, message: 'normalUserPricing must be an array of pricing slabs' });
      return;
    }

    if (retailerPricing !== undefined && (
      typeof retailerPricing !== 'object' ||
      retailerPricing === null ||
      !Array.isArray(retailerPricing.slabs)
    )) {
      res.status(400).json({ success: false, message: 'retailerPricing must contain a slabs array' });
      return;
    }

    if (normalUserPricing !== undefined) {
      for (const slab of normalUserPricing) {
        if (
          !slab ||
          typeof slab.minQuantity !== 'number' ||
          !Number.isFinite(slab.minQuantity) ||
          slab.minQuantity < 1 ||
          typeof slab.price !== 'number' ||
          !Number.isFinite(slab.price) ||
          slab.price < 0
        ) {
          res.status(400).json({
            success: false,
            message: 'Each normalUserPricing slab requires minQuantity >= 1 and price >= 0',
          });
          return;
        }
      }
    }

    if (retailerPricing !== undefined) {
      if (
        retailerPricing.minimumOrderQuantity !== undefined &&
        (
          typeof retailerPricing.minimumOrderQuantity !== 'number' ||
          !Number.isFinite(retailerPricing.minimumOrderQuantity) ||
          retailerPricing.minimumOrderQuantity < 1
        )
      ) {
        res.status(400).json({
          success: false,
          message: 'retailerPricing.minimumOrderQuantity must be >= 1',
        });
        return;
      }

      for (const slab of retailerPricing.slabs) {
        if (
          !slab ||
          typeof slab.minQuantity !== 'number' ||
          !Number.isFinite(slab.minQuantity) ||
          slab.minQuantity < 1 ||
          typeof slab.price !== 'number' ||
          !Number.isFinite(slab.price) ||
          slab.price < 0
        ) {
          res.status(400).json({
            success: false,
            message: 'Each retailerPricing slab requires minQuantity >= 1 and price >= 0',
          });
          return;
        }
      }
    }

    if (!hasAdminPermission(req.user, 'OWNER')) {
      res.status(403).json({
        success: false,
        message: 'Bulk pricing changes require OWNER permission',
      });
      return;
    }

    const result = await ProductService.bulkUpdatePricing({
      categoryId,
      skuPrefix: typeof skuPrefix === 'string' ? skuPrefix.trim() : undefined,
      price,
      normalUserPricing,
      retailerPricing,
    });

    res.status(200).json({
      success: true,
      message: 'Bulk product pricing updated successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Error bulk updating product pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update product pricing',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      features,
      price,
      sku,
      images,
      holographicImages,
      category,
      subCategories,
      tags,
      stock,
      isActive,
      isFeatured,
      isHomepageSticker,
      homepageStickerOrder,
      customFields,
      normalUserPricing,
      retailerPricing,
      retailerSpecialPricing,
      weight,
      length,
      breadth,
      height,
    } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (features !== undefined) updateData.features = features || [];
    if (holographicImages !== undefined) updateData.holographicImages = holographicImages || [];
    if (price !== undefined) updateData.price = price;
    if (sku) updateData.sku = sku;
    if (images !== undefined) updateData.images = images;
    if (category) updateData.category = category;
    if (subCategories !== undefined) updateData.subCategories = subCategories || [];
    if (tags !== undefined) updateData.tags = tags;
    if (stock !== undefined) updateData.stock = stock;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isHomepageSticker !== undefined) updateData.isHomepageSticker = isHomepageSticker;
    if (homepageStickerOrder !== undefined) updateData.homepageStickerOrder = homepageStickerOrder;
    if (customFields !== undefined) updateData.customFields = customFields;
    if (normalUserPricing !== undefined) updateData.normalUserPricing = normalUserPricing;
    if (retailerPricing !== undefined) updateData.retailerPricing = retailerPricing;
    if (retailerSpecialPricing !== undefined) updateData.retailerSpecialPricing = retailerSpecialPricing;
    if (weight !== undefined) updateData.weight = weight;
    if (length !== undefined) updateData.length = length;
    if (breadth !== undefined) updateData.breadth = breadth;
    if (height !== undefined) updateData.height = height;

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('product', 'update', updateData, getActor(req), id);
      res.status(202).json({
        success: true,
        message: 'Product changes submitted for QC approval',
        data: request
      });
      return;
    }

    const product = await ProductService.updateProduct(id, updateData);

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error: any) {
    console.error('Error updating product:', error);

    sendMutationError(res, error, 'Failed to update product');
  }
};

/**
 * Generate mockups for a product from its design image + matching templates.
 * POST /api/v1/products/:id/mockups/generate
 *
 * OWNER: applies the new image set directly.
 * Non-OWNER: routes the resulting image change through QC as a product update.
 */
export const generateProductMockups = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await MockupService.generateForProduct(id);
    const changes = { images: result.images, mockupImages: result.mockupImages };

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('product', 'update', changes, getActor(req), id);
      res.status(202).json({
        success: true,
        message: `Generated ${result.mockupImages.length} mockup(s), submitted for QC approval`,
        data: { request, generated: result.mockupImages },
      });
      return;
    }

    const product = await ProductService.updateProduct(id, changes as any);
    res.status(200).json({
      success: true,
      message: `Generated ${result.mockupImages.length} mockup(s)`,
      data: product,
    });
  } catch (error: any) {
    console.error('Error generating mockups:', error);
    if (error.message === 'product not found') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    // Design missing / no matching templates / ImageMagick unavailable are client-actionable.
    res.status(400).json({ success: false, message: error.message || 'Failed to generate mockups' });
  }
};

/**
 * Delete product
 * DELETE /api/v1/products/:id
 */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('product', 'delete', null, getActor(req), id);
      res.status(202).json({
        success: true,
        message: 'Product deletion submitted for QC approval',
        data: request
      });
      return;
    }

    const deleted = await ProductService.deleteProduct(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    sendMutationError(res, error, 'Failed to delete product');
  }
};
