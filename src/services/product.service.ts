import Product, { IProduct } from '../models/product.model';
import Category from '../models/category.model';
import SubCategory from '../models/subCategory.model';

interface ProductQuery {
  category?: string;
  subCategories?: string;
  tags?: { $in: string[] };
  isActive?: boolean;
  isFeatured?: boolean;
  $or?: any[];
}

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export class ProductService {
  /**
   * Check if category exists
   */
  static async checkCategoryExists(categoryId: string): Promise<boolean> {
    const category = await Category.findById(categoryId);
    return !!category;
  }

  private static async validateProductRelationships(data: Partial<IProduct>): Promise<void> {
    if (data.category) {
      const categoryExists = await this.checkCategoryExists(data.category.toString());
      if (!categoryExists) {
        throw new Error('Category not found');
      }
    }

    if (data.subCategories && data.subCategories.length > 0) {
      if (!data.category) {
        throw new Error('Category not found');
      }

      const subCategoryIds = data.subCategories.map(id => id.toString());
      const count = await SubCategory.countDocuments({
        _id: { $in: subCategoryIds },
        category: data.category,
      });
      if (count !== subCategoryIds.length) {
        throw new Error('One or more subcategories not found or do not belong to the selected category');
      }
    }
  }

  /**
   * Create a new product
   */
  static async createProduct(data: Partial<IProduct>): Promise<IProduct> {
    await this.validateProductRelationships(data);

    const product = await Product.create(data);
    return await product.populate(['category', 'subCategories', 'tags']);
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
      query.subCategories = subCategoryId;
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

    const searchTerm = search?.trim();
    if (searchTerm) {
      const safeSearch = escapeRegex(searchTerm);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { sku: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category')
        .populate('subCategories')
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
      .populate('subCategories')
      .populate('tags');
  }

  /**
   * Update product
   */
  static async updateProduct(id: string, data: Partial<IProduct>): Promise<IProduct | null> {
    const existing = await Product.findById(id);
    if (!existing) return null;

    const categoryChanged = data.category && data.category.toString() !== existing.category.toString();
    if (categoryChanged && !Object.prototype.hasOwnProperty.call(data, 'subCategories')) {
      data.subCategories = [];
    }

    const validationData = {
      category: data.category || existing.category,
      subCategories: Object.prototype.hasOwnProperty.call(data, 'subCategories')
        ? data.subCategories
        : existing.subCategories,
    } as Partial<IProduct>;

    await this.validateProductRelationships(validationData);

    return await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('category')
      .populate('subCategories')
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
