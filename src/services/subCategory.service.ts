import Category from '../models/category.model';
import Product from '../models/product.model';
import SubCategory, { ISubCategory } from '../models/subCategory.model';

interface SubCategoryQuery {
  category?: string;
  isActive?: boolean;
  $or?: any[];
}

export class SubCategoryService {
  static async createSubCategory(data: Partial<ISubCategory>): Promise<ISubCategory> {
    await this.validateCategoryExists(data.category?.toString());

    const subCategory = await SubCategory.create(data);
    return await subCategory.populate('category');
  }

  static async getAllSubCategories(
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoryId?: string,
    isActive?: boolean
  ): Promise<{ subCategories: ISubCategory[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const query: SubCategoryQuery = {};

    if (categoryId) query.category = categoryId;
    if (typeof isActive === 'boolean') query.isActive = isActive;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [subCategories, total] = await Promise.all([
      SubCategory.find(query)
        .populate('category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SubCategory.countDocuments(query),
    ]);

    return {
      subCategories,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getSubCategoryById(id: string): Promise<ISubCategory | null> {
    return await SubCategory.findById(id).populate('category');
  }

  static async getSubCategoryBySlugs(
    categorySlug: string,
    subCategorySlug: string
  ): Promise<ISubCategory | null> {
    const category = await Category.findOne({ slug: categorySlug });
    if (!category) return null;

    return await SubCategory.findOne({
      category: category._id,
      slug: subCategorySlug,
    }).populate('category');
  }

  static async updateSubCategory(
    id: string,
    data: Partial<ISubCategory>
  ): Promise<ISubCategory | null> {
    if (data.category) {
      await this.validateCategoryExists(data.category.toString());

      const existing = await SubCategory.findById(id);
      if (!existing) return null;

      if (existing.category.toString() !== data.category.toString()) {
        const productCount = await Product.countDocuments({ subCategory: id });
        if (productCount > 0) {
          throw new Error(`Cannot change subcategory category. ${productCount} product(s) are using this subcategory.`);
        }
      }
    }

    return await SubCategory.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('category');
  }

  static async deleteSubCategory(id: string): Promise<{ success: boolean; message?: string }> {
    const productCount = await Product.countDocuments({ subCategory: id });

    if (productCount > 0) {
      return {
        success: false,
        message: `Cannot delete subcategory. ${productCount} product(s) are using this subcategory.`,
      };
    }

    const deleted = await SubCategory.findByIdAndDelete(id);
    if (!deleted) {
      throw new Error('subCategory not found');
    }

    return { success: true };
  }

  private static async validateCategoryExists(categoryId?: string): Promise<void> {
    if (!categoryId) {
      throw new Error('Category not found');
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }
  }
}
