import Product, { IProduct } from '../models/product.model';
import Category from '../models/category.model';

interface ProductQuery {
  category?: string;
  tags?: { $in: string[] };
  $or?: any[];
}

export class ProductService {
  /**
   * Check if category exists
   */
  static async checkCategoryExists(categoryId: string): Promise<boolean> {
    const category = await Category.findById(categoryId);
    return !!category;
  }

  /**
   * Create a new product
   */
  static async createProduct(data: Partial<IProduct>): Promise<IProduct> {
    // Validate category exists
    if (data.category) {
      const categoryExists = await this.checkCategoryExists(data.category.toString());
      if (!categoryExists) {
        throw new Error('Category not found');
      }
    }

    const product = await Product.create(data);
    return await product.populate(['category', 'tags']);
  }

  /**
   * Get all products with pagination and filters
   */
  static async getAllProducts(
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoryId?: string,
    tagIds?: string[]
  ): Promise<{ products: IProduct[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    // Build query
    const query: ProductQuery = {};
    
    if (categoryId) {
      query.category = categoryId;
    }
    
    if (tagIds && tagIds.length > 0) {
      query.tags = { $in: tagIds };
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category')
        .populate('tags')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query)
    ]);

    return {
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get product by ID
   */
  static async getProductById(id: string): Promise<IProduct | null> {
    return await Product.findById(id)
      .populate('category')
      .populate('tags');
  }

  /**
   * Update product
   */
  static async updateProduct(id: string, data: Partial<IProduct>): Promise<IProduct | null> {
    // Validate category exists if it's being updated
    if (data.category) {
      const categoryExists = await this.checkCategoryExists(data.category.toString());
      if (!categoryExists) {
        throw new Error('Category not found');
      }
    }

    return await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('category')
      .populate('tags');
  }

  /**
   * Delete product
   */
  static async deleteProduct(id: string): Promise<boolean> {
    const result = await Product.findByIdAndDelete(id);
    return !!result;
  }
}

