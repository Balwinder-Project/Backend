import Category, { ICategory } from '../models/category.model';
import Product from '../models/product.model';

export class CategoryService {
  /**
   * Create a new category
   */
  static async createCategory(data: Partial<ICategory>): Promise<ICategory> {
    const category = await Category.create(data);
    return category;
  }

  /**
   * Get all categories with pagination
   */
  static async getAllCategories(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ categories: ICategory[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    // Build search query
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const [categories, total] = await Promise.all([
      Category.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Category.countDocuments(query)
    ]);

    return {
      categories,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get category by ID
   */
  static async getCategoryById(id: string): Promise<ICategory | null> {
    return await Category.findById(id);
  }

  /**
   * Update category
   */
  static async updateCategory(id: string, data: Partial<ICategory>): Promise<ICategory | null> {
    return await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  /**
   * Delete category (with validation)
   */
  static async deleteCategory(id: string): Promise<{ success: boolean; message?: string }> {
    // Check if any products use this category
    const productCount = await Product.countDocuments({ category: id });
    
    if (productCount > 0) {
      return {
        success: false,
        message: `Cannot delete category. ${productCount} product(s) are using this category.`
      };
    }

    await Category.findByIdAndDelete(id);
    return { success: true };
  }
}

