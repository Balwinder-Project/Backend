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
   * Preview the products that a bulk pricing filter would affect.
   * This is read-only and is used by the admin UI before applying changes.
   */
  static async previewBulkPricing(data: {
    categoryId?: string;
    skuPrefix?: string;
    limit?: number;
  }): Promise<{
    matchedCount: number;
    sample: { id: string; name: string; sku: string; price: number; normalUserPrice?: number; image?: string }[];
    filter: Record<string, unknown>;
  }> {
    const filter: Record<string, unknown> = {};

    if (data.categoryId) {
      const categoryExists = await this.checkCategoryExists(data.categoryId);
      if (!categoryExists) {
        throw new Error('Category not found');
      }
      filter.category = data.categoryId;
    }

    if (data.skuPrefix) {
      const safePrefix = escapeRegex(data.skuPrefix);
      filter.$or = [
        { name: { $regex: safePrefix, $options: 'i' } },
        { description: { $regex: safePrefix, $options: 'i' } },
        { sku: { $regex: safePrefix, $options: 'i' } },
      ];
    }

    const limit = Math.min(Math.max(data.limit || 10000, 1), 10000);
    const [matchedCount, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .select({ name: 1, sku: 1, price: 1, normalUserPricing: 1, images: 1, designImage: 1 })
        .sort({ sku: 1 })
        .limit(limit)
        .lean(),
    ]);

    return {
      matchedCount,
      sample: products.map((p: any) => ({
        id: String(p._id),
        name: p.name,
        sku: p.sku,
        price: p.price,
        normalUserPrice: p.normalUserPricing?.find((slab: any) => slab.minQuantity === 1)?.price ?? p.normalUserPricing?.[0]?.price,
        image: p.designImage || p.images?.[0],
      })),
      filter,
    };
  }

  /**
   * Bulk update pricing for an explicitly targeted product group.
   * Supports categoryId and/or SKU prefix. Both are combined with AND
   * when supplied, so callers can safely narrow the scope.
   */
  static async bulkUpdatePricing(data: {
    categoryId?: string;
    skuPrefix?: string;
    price?: number;
    normalUserPricing?: { minQuantity: number; price: number }[];
    retailerPricing?: {
      minimumOrderQuantity?: number;
      slabs: { minQuantity: number; price: number }[];
    };
  }): Promise<{
    matchedCount: number;
    modifiedCount: number;
    filter: Record<string, unknown>;
  }> {
    const filter: Record<string, unknown> = {};

    if (data.categoryId) {
      const categoryExists = await this.checkCategoryExists(data.categoryId);
      if (!categoryExists) {
        throw new Error('Category not found');
      }
      filter.category = data.categoryId;
    }

    if (data.skuPrefix) {
      const safePrefix = escapeRegex(data.skuPrefix);
      filter.$or = [
        { name: { $regex: safePrefix, $options: 'i' } },
        { description: { $regex: safePrefix, $options: 'i' } },
        { sku: { $regex: safePrefix, $options: 'i' } },
      ];
    }

    const update: Record<string, unknown> = {};
    if (data.price !== undefined) update.price = data.price;
    if (data.normalUserPricing !== undefined) update.normalUserPricing = data.normalUserPricing;
    if (data.retailerPricing !== undefined) update.retailerPricing = data.retailerPricing;

    const result = await Product.updateMany(
      filter,
      { $set: update },
      { runValidators: true }
    );

    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      filter,
    };
  }

  /**
   * Preview products that will be assigned to a subcategory using an optional SKU prefix.
   */
  static async previewBulkSubcategoryAssignment(data: {
    categoryId: string;
    subCategoryId: string;
    skuPrefix?: string;
    limit?: number;
  }): Promise<{
    matchedCount: number;
    alreadyAssignedCount: number;
    sample: { id: string; name: string; sku: string; image?: string; alreadyAssigned: boolean }[];
  }> {
    await this.checkCategoryExistsOrThrow(data.categoryId);
    const subCategory = await SubCategory.findOne({ _id: data.subCategoryId, category: data.categoryId });
    if (!subCategory) throw new Error('Subcategory not found or does not belong to the selected category');

    const filter: Record<string, unknown> = { category: data.categoryId };
    if (data.skuPrefix?.trim()) {
      filter.sku = { $regex: '^' + escapeRegex(data.skuPrefix.trim()), $options: 'i' };
    }

    const limit = Math.min(Math.max(data.limit || 10000, 1), 10000);
    const [matchedCount, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .select({ name: 1, sku: 1, images: 1, designImage: 1, subCategories: 1 })
        .sort({ sku: 1 })
        .limit(limit)
        .lean(),
    ]);

    const subId = String(data.subCategoryId);
    const alreadyAssignedCount = products.filter((p: any) => (p.subCategories || []).some((id: any) => String(id) === subId)).length;
    return {
      matchedCount,
      alreadyAssignedCount,
      sample: products.map((p: any) => ({
        id: String(p._id),
        name: p.name,
        sku: p.sku,
        image: p.designImage || p.images?.[0],
        alreadyAssigned: (p.subCategories || []).some((id: any) => String(id) === subId),
      })),
    };
  }

  /**
   * Assign all products matching category + optional SKU prefix to a subcategory.
   * Existing subcategory assignments are preserved.
   */
  static async bulkAssignSubcategory(data: {
    categoryId: string;
    subCategoryId: string;
    skuPrefix?: string;
  }): Promise<{ matchedCount: number; modifiedCount: number; filter: Record<string, unknown> }> {
    await this.checkCategoryExistsOrThrow(data.categoryId);
    const subCategory = await SubCategory.findOne({ _id: data.subCategoryId, category: data.categoryId });
    if (!subCategory) throw new Error('Subcategory not found or does not belong to the selected category');

    const filter: Record<string, unknown> = { category: data.categoryId };
    if (data.skuPrefix?.trim()) {
      filter.sku = { $regex: '^' + escapeRegex(data.skuPrefix.trim()), $options: 'i' };
    }

    const result = await Product.updateMany(
      filter,
      { $addToSet: { subCategories: data.subCategoryId } },
      { runValidators: true }
    );

    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, filter };
  }

  private static async checkCategoryExistsOrThrow(categoryId: string): Promise<void> {
    if (!(await this.checkCategoryExists(categoryId))) throw new Error('Category not found');
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
