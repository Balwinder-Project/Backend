import Product, { IProduct } from '../models/product.model';
import Category from '../models/category.model';
import SubCategory from '../models/subCategory.model';

interface ProductQuery {
  category?: string;
  subCategory?: string;
  tags?: { $in: string[] };
  isActive?: boolean;
  isFeatured?: boolean;
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
   * Check if subcategory exists and belongs to the supplied category
   */
  static async checkSubCategoryBelongsToCategory(subCategoryId: string, categoryId: string): Promise<boolean> {
    const subCategory = await SubCategory.findOne({ _id: subCategoryId, category: categoryId });
    return !!subCategory;
  }

  private static async validateProductCategoryPair(data: Partial<IProduct>): Promise<void> {
    if (data.category) {
      const categoryExists = await this.checkCategoryExists(data.category.toString());
      if (!categoryExists) {
        throw new Error('Category not found');
      }
    }

    if (data.subCategory) {
      if (!data.category) {
        throw new Error('Category not found');
      }

      const subCategoryMatches = await this.checkSubCategoryBelongsToCategory(
        data.subCategory.toString(),
        data.category.toString()
      );
      if (!subCategoryMatches) {
        throw new Error('Subcategory not found');
      }
    }
  }

  /**
   * Create a new product
   */
  static async createProduct(data: Partial<IProduct>): Promise<IProduct> {
    await this.validateProductCategoryPair(data);

    const product = await Product.create(data);
    return await product.populate(['category', 'subCategory', 'tags']);
  }

  /**
   * Get all products with pagination and filters
   */
  static async getAllProducts(
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoryId?: string,
    subCategoryId?: string,
    tagIds?: string[],
    featured?: boolean,
    isActive?: boolean
  ): Promise<{ products: IProduct[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    // Build query
    const query: ProductQuery = {};
    
    if (categoryId) {
      query.category = categoryId;
    }

    if (subCategoryId) {
      query.subCategory = subCategoryId;
    }
    
    if (tagIds && tagIds.length > 0) {
      query.tags = { $in: tagIds };
    }

    if (typeof featured === 'boolean') {
      query.isFeatured = featured;
    }

    if (typeof isActive === 'boolean') {
      query.isActive = isActive;
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
        .populate('subCategory')
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
      .populate('subCategory')
      .populate('tags');
  }

  /**
   * Update product
   */
  static async updateProduct(id: string, data: Partial<IProduct>): Promise<IProduct | null> {
    const existing = await Product.findById(id);
    if (!existing) return null;

    const categoryChanged = data.category && data.category.toString() !== existing.category.toString();
    if (categoryChanged && !Object.prototype.hasOwnProperty.call(data, 'subCategory')) {
      data.subCategory = null;
    }

    const validationData = {
      category: data.category || existing.category,
      subCategory: Object.prototype.hasOwnProperty.call(data, 'subCategory')
        ? data.subCategory
        : existing.subCategory,
    } as Partial<IProduct>;

    await this.validateProductCategoryPair(validationData);

    return await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('category')
      .populate('subCategory')
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
