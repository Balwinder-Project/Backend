import mongoose from 'mongoose';
import Product from '../models/product.model';
import Category from '../models/category.model';
import SubCategory from '../models/subCategory.model';
import Tag from '../models/tag.model';
import HeroSlide from '../models/heroSlide.model';
import CatalogueChangeRequest, {
  CatalogueAction,
  CatalogueEntityType,
  ICatalogueChangeRequest,
} from '../models/catalogueChangeRequest.model';

type Actor = {
  uid: string;
  email?: string;
};

const MODEL_BY_ENTITY = {
  product: Product,
  category: Category,
  subCategory: SubCategory,
  tag: Tag,
  heroSlide: HeroSlide,
};

const toPlainObject = (doc: any): Record<string, any> | null => {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  const { _id, id, __v, createdAt, updatedAt, ...rest } = plain;
  return rest;
};

const normalizeSku = (payload: Record<string, any>): Record<string, any> => {
  if (typeof payload.sku !== 'string') return payload;
  return { ...payload, sku: payload.sku.trim().toUpperCase() };
};

const normalizeProductPayload = (payload: Record<string, any>): Record<string, any> => {
  const normalized = normalizeSku(payload);
  if (normalized.subCategory === '') {
    return { ...normalized, subCategory: null };
  }
  return normalized;
};

const assertObjectId = (id: string, entityType: CatalogueEntityType) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${entityType} ID`);
  }
};

export class CatalogueQcService {
  static async listByStatus(status: 'pending_qc1' | 'pending_qc2') {
    return CatalogueChangeRequest.find({ status }).sort({ createdAt: 1 });
  }

  static async listBySubmitter(uid: string) {
    return CatalogueChangeRequest.find({ submittedBy: uid }).sort({ createdAt: -1 });
  }

  static async getRequest(id: string) {
    return CatalogueChangeRequest.findById(id);
  }

  static async createRequest(
    entityType: CatalogueEntityType,
    action: CatalogueAction,
    payload: Record<string, any> | null,
    actor: Actor,
    targetId?: string
  ): Promise<ICatalogueChangeRequest> {
    if ((action === 'update' || action === 'delete') && !targetId) {
      throw new Error('Target ID is required');
    }

    const Model = MODEL_BY_ENTITY[entityType] as any;
    let originalSnapshot: Record<string, any> | null = null;
    let finalPayload = payload ? { ...payload } : null;

    if (targetId) {
      assertObjectId(targetId, entityType);
      const original = await Model.findById(targetId);
      if (!original) {
        throw new Error(`${entityType} not found`);
      }
      originalSnapshot = toPlainObject(original);
      if (action === 'update') {
        finalPayload = { ...originalSnapshot, ...(payload || {}) };
        if (
          entityType === 'product' &&
          payload?.category &&
          !Object.prototype.hasOwnProperty.call(payload, 'subCategory') &&
          originalSnapshot?.category?.toString() !== payload.category.toString()
        ) {
          finalPayload.subCategory = null;
        }
      }
    }

    if (finalPayload && entityType === 'product') {
      finalPayload = normalizeProductPayload(finalPayload);
    }

    if (action !== 'delete' && finalPayload) {
      await this.validatePayload(entityType, action, finalPayload, targetId);
    }

    return CatalogueChangeRequest.create({
      entityType,
      action,
      targetId,
      payload: finalPayload,
      originalSnapshot,
      status: 'pending_qc1',
      submittedBy: actor.uid,
      submittedByEmail: actor.email,
    });
  }

  static async approveQc1(
    id: string,
    actor: Actor,
    payload?: Record<string, any>
  ): Promise<ICatalogueChangeRequest> {
    const request = await CatalogueChangeRequest.findById(id);
    if (!request) throw new Error('QC request not found');
    if (request.status !== 'pending_qc1') throw new Error('Request is not pending QC check 1');

    if (payload && request.action !== 'delete') {
      const finalPayload = request.entityType === 'product' ? normalizeProductPayload(payload) : payload;
      await this.validatePayload(request.entityType, request.action, finalPayload, request.targetId?.toString());
      request.payload = finalPayload;
    }

    request.status = 'pending_qc2';
    request.qc1ReviewedBy = actor.uid;
    request.qc1ReviewedByEmail = actor.email;
    request.qc1Feedback = undefined;
    request.qc1ReviewedAt = new Date();
    await request.save();
    return request;
  }

  static async rejectQc1(id: string, actor: Actor, feedback: string): Promise<ICatalogueChangeRequest> {
    if (!feedback?.trim()) throw new Error('Feedback is required');

    const request = await CatalogueChangeRequest.findById(id);
    if (!request) throw new Error('QC request not found');
    if (request.status !== 'pending_qc1') throw new Error('Request is not pending QC check 1');

    request.status = 'rejected_qc1';
    request.qc1ReviewedBy = actor.uid;
    request.qc1ReviewedByEmail = actor.email;
    request.qc1Feedback = feedback.trim();
    request.qc1ReviewedAt = new Date();
    await request.save();
    return request;
  }

  static async approveQc2(
    id: string,
    actor: Actor,
    payload?: Record<string, any>
  ): Promise<ICatalogueChangeRequest> {
    const request = await CatalogueChangeRequest.findById(id);
    if (!request) throw new Error('QC request not found');
    if (request.status !== 'pending_qc2') throw new Error('Request is not pending QC check 2');

    if (payload && request.action !== 'delete') {
      request.payload = request.entityType === 'product' ? normalizeProductPayload(payload) : payload;
    }

    if (request.action !== 'delete') {
      await this.validatePayload(
        request.entityType,
        request.action,
        request.payload || {},
        request.targetId?.toString()
      );
    }

    request.status = 'approved';
    request.qc2ReviewedBy = actor.uid;
    request.qc2ReviewedByEmail = actor.email;
    request.qc2Feedback = undefined;
    request.qc2ReviewedAt = new Date();
    await this.applyRequest(request);
    request.status = 'applied';
    request.appliedAt = new Date();
    await request.save();
    return request;
  }

  static async rejectQc2(id: string, actor: Actor, feedback: string): Promise<ICatalogueChangeRequest> {
    if (!feedback?.trim()) throw new Error('Feedback is required');

    const request = await CatalogueChangeRequest.findById(id);
    if (!request) throw new Error('QC request not found');
    if (request.status !== 'pending_qc2') throw new Error('Request is not pending QC check 2');

    request.status = 'rejected_qc2';
    request.qc2ReviewedBy = actor.uid;
    request.qc2ReviewedByEmail = actor.email;
    request.qc2Feedback = feedback.trim();
    request.qc2ReviewedAt = new Date();
    await request.save();
    return request;
  }

  private static async applyRequest(request: ICatalogueChangeRequest) {
    const Model = MODEL_BY_ENTITY[request.entityType] as any;

    if (request.action === 'create') {
      await Model.create(request.payload);
      return;
    }

    if (!request.targetId) {
      throw new Error('Target ID is required');
    }

    if (request.action === 'update') {
      const updated = await Model.findByIdAndUpdate(request.targetId, request.payload, {
        new: true,
        runValidators: true,
      });
      if (!updated) throw new Error(`${request.entityType} not found`);
      return;
    }

    if (request.entityType === 'category') {
      const productCount = await Product.countDocuments({ category: request.targetId });
      if (productCount > 0) {
        throw new Error(`Cannot delete category. ${productCount} product(s) are using this category.`);
      }

      const subCategoryCount = await SubCategory.countDocuments({ category: request.targetId });
      if (subCategoryCount > 0) {
        throw new Error(`Cannot delete category. ${subCategoryCount} subcategory/subcategories are using this category.`);
      }
    }

    if (request.entityType === 'subCategory') {
      const productCount = await Product.countDocuments({ subCategory: request.targetId });
      if (productCount > 0) {
        throw new Error(`Cannot delete subcategory. ${productCount} product(s) are using this subcategory.`);
      }
    }

    const deleted = await Model.findByIdAndDelete(request.targetId);
    if (!deleted) throw new Error(`${request.entityType} not found`);
  }

  private static async validatePayload(
    entityType: CatalogueEntityType,
    action: CatalogueAction,
    payload: Record<string, any>,
    targetId?: string
  ) {
    if (entityType === 'product') {
      await this.validateProductPayload(action, payload, targetId);
      return;
    }

    if (entityType === 'category') {
      await this.validateCategoryPayload(action, payload, targetId);
      return;
    }

    if (entityType === 'subCategory') {
      await this.validateSubCategoryPayload(action, payload, targetId);
      return;
    }

    if (entityType === 'tag') {
      await this.validateTagPayload(action, payload, targetId);
      return;
    }

    await this.validateHeroSlidePayload(payload);
  }

  private static async validateProductPayload(
    _action: CatalogueAction,
    payload: Record<string, any>,
    targetId?: string
  ) {
    if (payload.category) {
      const category = await Category.findById(payload.category);
      if (!category) throw new Error('Category not found');
    }

    if (payload.subCategory) {
      if (!payload.category) throw new Error('Category not found');

      const subCategory = await SubCategory.findOne({
        _id: payload.subCategory,
        category: payload.category,
      });
      if (!subCategory) throw new Error('Subcategory not found');
    }

    if (Array.isArray(payload.tags) && payload.tags.length > 0) {
      const tagCount = await Tag.countDocuments({ _id: { $in: payload.tags } });
      if (tagCount !== payload.tags.length) throw new Error('One or more tags were not found');
    }

    if (payload.sku) {
      const duplicate = await Product.findOne({
        sku: String(payload.sku).trim().toUpperCase(),
        ...(targetId ? { _id: { $ne: targetId } } : {}),
      });
      if (duplicate) throw new Error('A product with this SKU already exists');
    }

    const product = new Product(payload);
    await product.validate();
  }

  private static async validateCategoryPayload(
    _action: CatalogueAction,
    payload: Record<string, any>,
    targetId?: string
  ) {
    const duplicate = await Category.findOne({
      $or: [{ name: payload.name }, { slug: payload.slug }],
      ...(targetId ? { _id: { $ne: targetId } } : {}),
    });
    if (duplicate) throw new Error('A category with this name or slug already exists');

    const category = new Category(payload);
    await category.validate();
  }

  private static async validateSubCategoryPayload(
    _action: CatalogueAction,
    payload: Record<string, any>,
    targetId?: string
  ) {
    const category = await Category.findById(payload.category);
    if (!category) throw new Error('Category not found');

    if (targetId) {
      const existing = await SubCategory.findById(targetId);
      if (!existing) throw new Error('subCategory not found');

      if (existing.category.toString() !== payload.category?.toString()) {
        const productCount = await Product.countDocuments({ subCategory: targetId });
        if (productCount > 0) {
          throw new Error(`Cannot change subcategory category. ${productCount} product(s) are using this subcategory.`);
        }
      }
    }

    const duplicate = await SubCategory.findOne({
      category: payload.category,
      $or: [{ name: payload.name }, { slug: payload.slug }],
      ...(targetId ? { _id: { $ne: targetId } } : {}),
    });
    if (duplicate) throw new Error('A subcategory with this name or slug already exists');

    const subCategory = new SubCategory(payload);
    await subCategory.validate();
  }

  private static async validateTagPayload(
    _action: CatalogueAction,
    payload: Record<string, any>,
    targetId?: string
  ) {
    const duplicate = await Tag.findOne({
      $or: [{ name: payload.name }, { slug: payload.slug }],
      ...(targetId ? { _id: { $ne: targetId } } : {}),
    });
    if (duplicate) throw new Error('A tag with this name or slug already exists');

    const tag = new Tag(payload);
    await tag.validate();
  }

  private static async validateHeroSlidePayload(payload: Record<string, any>) {
    const heroSlide = new HeroSlide(payload);
    await heroSlide.validate();
  }
}
