import Category from '../models/category.model';
import Product from '../models/product.model';
import SubCategory, { ISubCategory } from '../models/subCategory.model';

interface SubCategoryQuery {
  category?: string;
  parent?: string | null;
  isActive?: boolean;
  showOnHomepage?: boolean;
  $or?: any[];
}

export class SubCategoryService {
  static async createSubCategory(data: Partial<ISubCategory>): Promise<ISubCategory> {
    await this.validateCategoryExists(data.category?.toString());
    await this.validateParent(data.parent?.toString(), data.category?.toString());

    const subCategory = await SubCategory.create(data);
    return await subCategory.populate(['category', 'parent']);
  }

  static async getAllSubCategories(
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoryId?: string,
    isActive?: boolean,
    parentId?: string | null,
    showOnHomepage?: boolean
  ): Promise<{ subCategories: ISubCategory[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const query: SubCategoryQuery = {};

    if (categoryId) query.category = categoryId;
    if (typeof isActive === 'boolean') query.isActive = isActive;
    if (parentId !== undefined) query.parent = parentId;
    if (typeof showOnHomepage === 'boolean') query.showOnHomepage = showOnHomepage;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [subCategories, total] = await Promise.all([
      SubCategory.find(query)
        .populate('category')
        .populate('parent')
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
    return await SubCategory.findById(id).populate(['category', 'parent']);
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
    }).populate(['category', 'parent']);
  }

  static async updateSubCategory(
    id: string,
    data: Partial<ISubCategory>
  ): Promise<ISubCategory | null> {
    const existing = await SubCategory.findById(id);
    if (!existing) return null;

    if (data.category) {
      await this.validateCategoryExists(data.category.toString());

      if (existing.category.toString() !== data.category.toString()) {
        const productCount = await Product.countDocuments({ subCategories: id });
        if (productCount > 0) {
          throw new Error(`Cannot change subcategory category. ${productCount} product(s) are using this subcategory.`);
        }
        const childCount = await SubCategory.countDocuments({ parent: id });
        if (childCount > 0) {
          throw new Error(`Cannot change subcategory category. ${childCount} child subcategory/subcategories exist.`);
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'parent')) {
      const categoryId = data.category?.toString() || existing.category.toString();
      await this.validateParent(data.parent?.toString(), categoryId, id);
    }

    return await SubCategory.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate(['category', 'parent']);
  }

  static async deleteSubCategory(id: string): Promise<{ success: boolean; message?: string }> {
    const [productCount, childCount] = await Promise.all([
      Product.countDocuments({ subCategories: id }),
      SubCategory.countDocuments({ parent: id }),
    ]);

    if (childCount > 0) {
      return {
        success: false,
        message: `Cannot delete subcategory. ${childCount} child subcategory/subcategories exist.`,
      };
    }

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

  static async getSubCategoryTree(categoryId: string): Promise<any[]> {
    const subCategories = await SubCategory.find({ category: categoryId, isActive: true })
      .sort({ name: 1 })
      .lean();

    const buildTree = (parentId: string | null): any[] => {
      return subCategories
        .filter(sc => {
          const scParent = sc.parent ? sc.parent.toString() : null;
          return scParent === parentId;
        })
        .map(sc => ({
          id: sc._id,
          name: sc.name,
          slug: sc.slug,
          children: buildTree(sc._id.toString()),
        }));
    };

    return buildTree(null);
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

  private static async validateParent(
    parentId?: string,
    categoryId?: string,
    selfId?: string
  ): Promise<void> {
    if (!parentId) return;

    if (selfId && parentId === selfId) {
      throw new Error('Subcategory cannot be its own parent');
    }

    const parent = await SubCategory.findById(parentId);
    if (!parent) {
      throw new Error('Parent subcategory not found');
    }

    if (categoryId && parent.category.toString() !== categoryId) {
      throw new Error('Parent subcategory must belong to the same category');
    }
  }
}
