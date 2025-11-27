import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';

/**
 * Create a new product
 * POST /api/v1/products
 */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, price, sku, images, category, tags, stock, isActive } = req.body;

    const product = await ProductService.createProduct({
      name,
      description,
      price,
      sku,
      images: images || [],
      category,
      tags: tags || [],
      stock: stock !== undefined ? stock : 0,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error: any) {
    console.error('Error creating product:', error);

    if (error.message === 'Category not found') {
      res.status(400).json({
        success: false,
        message: 'Category not found. Please create categories first.'
      });
      return;
    }

    if (error.code === 11000) {
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
      message: 'Failed to create product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;

    const result = await ProductService.getAllProducts(page, limit, search, category, tags);

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
    const { name, description, price, sku, images, category, tags, stock, isActive } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (sku) updateData.sku = sku;
    if (images !== undefined) updateData.images = images;
    if (category) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (stock !== undefined) updateData.stock = stock;
    if (isActive !== undefined) updateData.isActive = isActive;

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

    if (error.message === 'Category not found') {
      res.status(400).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    if (error.code === 11000) {
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
      message: 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete product
 * DELETE /api/v1/products/:id
 */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

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
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

