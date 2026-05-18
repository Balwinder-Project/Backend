import { Request, Response } from 'express';
import { hasAdminPermission } from '../constants/adminRoles';
import { CatalogueQcService } from '../services/catalogueQc.service';
import { SubCategoryService } from '../services/subCategory.service';

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

const sendSubCategoryMutationError = (res: Response, error: any, fallbackMessage: string): void => {
  if (error.message === 'subCategory not found') {
    res.status(404).json({
      success: false,
      message: 'Subcategory not found',
    });
    return;
  }

  if (error.message === 'Category not found') {
    res.status(400).json({
      success: false,
      message: error.message,
    });
    return;
  }

  if (error.message === 'A subcategory with this name or slug already exists' || error.code === 11000) {
    res.status(409).json({
      success: false,
      message: 'A subcategory with this name or slug already exists',
    });
    return;
  }

  if (
    error.message?.startsWith('Cannot change subcategory category.') ||
    error.message === 'Parent subcategory not found' ||
    error.message === 'Parent subcategory must belong to the same category' ||
    error.message === 'Subcategory cannot be its own parent'
  ) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
    return;
  }

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: fallbackMessage,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
};

export const createSubCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, category, isActive, fieldTemplate, parent } = req.body;

    const subCategoryData = {
      name,
      description,
      slug: req.body.slug,
      category,
      parent: parent || null,
      isActive: isActive !== undefined ? isActive : true,
      fieldTemplate: fieldTemplate || null,
    };

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('subCategory', 'create', subCategoryData, getActor(req));
      res.status(202).json({
        success: true,
        message: 'Subcategory submitted for QC approval',
        data: request,
      });
      return;
    }

    const subCategory = await SubCategoryService.createSubCategory(subCategoryData as any);

    res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      data: subCategory,
    });
  } catch (error: any) {
    console.error('Error creating subcategory:', error);
    sendSubCategoryMutationError(res, error, 'Failed to create subcategory');
  }
};

export const getAllSubCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const category = req.query.category as string;
    const active = parseBooleanQuery(req.query.active);

    const parent = req.query.parent as string | undefined;
    const parentFilter = parent === 'null' ? null : parent;

    const result = await SubCategoryService.getAllSubCategories(page, limit, search, category, active, parentFilter);

    res.status(200).json({
      success: true,
      data: result.subCategories,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getSubCategoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const subCategory = await SubCategoryService.getSubCategoryById(id);

    if (!subCategory) {
      res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: subCategory,
    });
  } catch (error: any) {
    console.error('Error fetching subcategory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategory',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getSubCategoryBySlugs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categorySlug, subCategorySlug } = req.params;

    const subCategory = await SubCategoryService.getSubCategoryBySlugs(categorySlug, subCategorySlug);

    if (!subCategory) {
      res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: subCategory,
    });
  } catch (error: any) {
    console.error('Error fetching subcategory by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategory',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateSubCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, category, isActive, fieldTemplate, parent } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (parent !== undefined) updateData.parent = parent || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (fieldTemplate !== undefined) updateData.fieldTemplate = fieldTemplate;
    if (req.body.slug) updateData.slug = req.body.slug;

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('subCategory', 'update', updateData, getActor(req), id);
      res.status(202).json({
        success: true,
        message: 'Subcategory changes submitted for QC approval',
        data: request,
      });
      return;
    }

    const subCategory = await SubCategoryService.updateSubCategory(id, updateData);

    if (!subCategory) {
      res.status(404).json({
        success: false,
        message: 'Subcategory not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Subcategory updated successfully',
      data: subCategory,
    });
  } catch (error: any) {
    console.error('Error updating subcategory:', error);
    sendSubCategoryMutationError(res, error, 'Failed to update subcategory');
  }
};

export const deleteSubCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('subCategory', 'delete', null, getActor(req), id);
      res.status(202).json({
        success: true,
        message: 'Subcategory deletion submitted for QC approval',
        data: request,
      });
      return;
    }

    const result = await SubCategoryService.deleteSubCategory(id);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting subcategory:', error);
    sendSubCategoryMutationError(res, error, 'Failed to delete subcategory');
  }
};
