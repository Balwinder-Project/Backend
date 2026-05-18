import Category, { ICategory } from '../models/category.model';
import Product from '../models/product.model';
import SubCategory from '../models/subCategory.model';

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
   * Get category by slug
   */
  static async getCategoryBySlug(slug: string): Promise<ICategory | null> {
    return await Category.findOne({ slug });
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

    const subCategoryCount = await SubCategory.countDocuments({ category: id });

    if (subCategoryCount > 0) {
      return {
        success: false,
        message: `Cannot delete category. ${subCategoryCount} subcategory/subcategories are using this category.`
      };
    }

    await Category.findByIdAndDelete(id);
    return { success: true };
  }

  static async getNavigationTree(): Promise<any[]> {
    const [categories, subCategories] = await Promise.all([
      Category.find({ isActive: true }).sort({ name: 1 }).lean(),
      SubCategory.find({ isActive: true }).sort({ name: 1 }).lean(),
    ]);

    const buildSubTree = (categoryId: string, parentId: string | null): any[] => {
      return subCategories
        .filter(sc => {
          const scParent = sc.parent ? sc.parent.toString() : null;
          return sc.category.toString() === categoryId && scParent === parentId;
        })
        .map(sc => ({
          id: sc._id,
          name: sc.name,
          slug: sc.slug,
          children: buildSubTree(categoryId, sc._id.toString()),
        }));
    };

    return categories.map(cat => ({
      id: cat._id,
      name: cat.name,
      slug: cat.slug,
      children: buildSubTree(cat._id.toString(), null),
    }));
  }
}

