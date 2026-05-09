import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { CatalogueQcService } from '../services/catalogueQc.service';
import { hasAdminPermission } from '../constants/adminRoles';

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const getActor = (req: Request) => ({
  uid: req.user?.uid || 'unknown',
  email: req.user?.email,
});

const sendMutationError = (res: Response, error: any, fallbackMessage: string): void => {
  if (
    error.message === 'Category not found' ||
    error.message === 'Subcategory not found' ||
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
      price,
      sku,
      images,
      category,
      subCategory,
      tags,
      stock,
      isActive,
      isFeatured,
      customFields,
      normalUserPricing,
      retailerPricing,
      weight,
      length,
      breadth,
      height,
    } = req.body;

    const productData = {
      name,
      description,
      price,
      sku,
      images: images || [],
      category,
      subCategory: subCategory || null,
      tags: tags || [],
      stock: stock !== undefined ? stock : 0,
      isActive: isActive !== undefined ? isActive : true,
      isFeatured: isFeatured !== undefined ? isFeatured : false,
      customFields: customFields || null,
      normalUserPricing: normalUserPricing || [],
      retailerPricing: retailerPricing || { minimumOrderQuantity: 1, slabs: [] },
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

    const result = await ProductService.getAllProducts(page, limit, search, category, subCategory, tags, featured, active);

    res.status(200).json({
      success: true,
      data: result.products,
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

    res.status(200).json({
      success: true,
      data: product
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
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      sku,
      images,
      category,
      subCategory,
      tags,
      stock,
      isActive,
      isFeatured,
      customFields,
      normalUserPricing,
      retailerPricing,
      weight,
      length,
      breadth,
      height,
    } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (sku) updateData.sku = sku;
    if (images !== undefined) updateData.images = images;
    if (category) updateData.category = category;
    if (subCategory !== undefined) updateData.subCategory = subCategory || null;
    if (tags !== undefined) updateData.tags = tags;
    if (stock !== undefined) updateData.stock = stock;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (customFields !== undefined) updateData.customFields = customFields;
    if (normalUserPricing !== undefined) updateData.normalUserPricing = normalUserPricing;
    if (retailerPricing !== undefined) updateData.retailerPricing = retailerPricing;
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
