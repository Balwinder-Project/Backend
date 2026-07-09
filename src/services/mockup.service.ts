import sharp from 'sharp';
import mongoose from 'mongoose';
import MockupTemplate, {
  IMockupTemplate,
  IMockupPlacement,
  IMockupCorners,
} from '../models/mockupTemplate.model';
import Product, { IProduct } from '../models/product.model';
import SubCategory from '../models/subCategory.model';
import { uploadImageToB2 } from '../utils/imageUpload';
import { downloadToBuffer } from '../utils/imageDownload';
import { isMagickAvailable, renderPerspectiveLayer, renderCurvedLayer } from '../utils/magick';

export interface GeneratedMockup {
  templateId: mongoose.Types.ObjectId;
  url: string;
  generatedAt: Date;
}

export interface MockupGenerationResult {
  images: string[];
  mockupImages: GeneratedMockup[];
}

const SUBCATEGORY_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const validateTemplateRelationships = async (payload: Record<string, any>): Promise<void> => {
  if (Array.isArray(payload.subCategories) && payload.subCategories.length > 0) {
    const ids = payload.subCategories.filter((id: any) => id && SUBCATEGORY_ID_REGEX.test(String(id)));
    if (ids.length !== payload.subCategories.length) {
      throw new Error('One or more subcategories have an invalid ID format');
    }
    const count = await SubCategory.countDocuments({ _id: { $in: ids } });
    if (count !== ids.length) {
      throw new Error('One or more subcategories were not found');
    }
  }
};

/**
 * Resolve the flat placement areas for a template, falling back to the legacy
 * single `placement` field (and finally a sensible default) so older templates
 * keep rendering after the multi-area migration.
 */
const resolvePlacements = (template: IMockupTemplate): IMockupPlacement[] => {
  if (Array.isArray(template.placements) && template.placements.length > 0) {
    return template.placements;
  }
  if (template.placement) return [template.placement];
  return [];
};

/** Resolve the perspective/curved corner sets, falling back to legacy `corners`. */
const resolveCornersList = (template: IMockupTemplate): IMockupCorners[] => {
  if (Array.isArray(template.cornersList) && template.cornersList.length > 0) {
    return template.cornersList;
  }
  if (template.corners) return [template.corners];
  return [];
};

/**
 * Build a default cylindrical displacement map so `curved` mode works without
 * the admin hand-crafting one. Models a vertical cylinder (curving left↔right):
 * the red channel encodes a smooth horizontal barrel profile (X displacement)
 * while green/blue stay neutral (128) so vertical position is untouched.
 * A 256×1 strip is enough — magick resizes it to the base dimensions.
 */
const buildCylindricalDisplacementMap = async (): Promise<Buffer> => {
  const cols = 256;
  const channels = 3;
  const strip = Buffer.alloc(cols * channels);
  for (let x = 0; x < cols; x++) {
    const u = (x / (cols - 1)) * 2 - 1; // -1 (left) .. 1 (right)
    const profile = Math.round(128 + 127 * Math.sin((u * Math.PI) / 2));
    const i = x * channels;
    strip[i] = profile; // R → horizontal displacement
    strip[i + 1] = 128; // G → vertical (neutral)
    strip[i + 2] = 128; // B
  }
  return sharp(strip, { raw: { width: cols, height: 1, channels } }).png().toBuffer();
};

/** Reduce a processed sticker PNG's alpha uniformly to apply opacity < 1. */
const applyOpacity = async (buffer: Buffer, opacity: number): Promise<Buffer> => {
  const meta = await sharp(buffer).metadata();
  const mask = await sharp({
    create: {
      width: meta.width || 1,
      height: meta.height || 1,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: opacity },
    },
  })
    .png()
    .toBuffer();
  return sharp(buffer).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
};

export class MockupService {
  // ---- Template CRUD -------------------------------------------------------

  static async createTemplate(data: Record<string, any>): Promise<IMockupTemplate> {
    await validateTemplateRelationships(data);
    return MockupTemplate.create(data);
  }

  static async getTemplates(filters: { subCategory?: string; active?: boolean } = {}) {
    const query: Record<string, any> = {};
    if (filters.subCategory) query.subCategories = filters.subCategory;
    if (typeof filters.active === 'boolean') query.isActive = filters.active;
    return MockupTemplate.find(query).sort({ sortOrder: 1, createdAt: -1 });
  }

  static async getTemplateById(id: string): Promise<IMockupTemplate | null> {
    return MockupTemplate.findById(id);
  }

  static async updateTemplate(id: string, data: Record<string, any>): Promise<IMockupTemplate | null> {
    await validateTemplateRelationships(data);
    return MockupTemplate.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  static async deleteTemplate(id: string): Promise<boolean> {
    const result = await MockupTemplate.findByIdAndDelete(id);
    return !!result;
  }

  // ---- Rendering -----------------------------------------------------------

  /** Find every active template whose subcategories overlap the product's. */
  static async resolveTemplates(product: IProduct): Promise<IMockupTemplate[]> {
    const subIds = (product.subCategories || []).map((s: any) => (s && s._id ? s._id : s));
    if (!subIds.length) return [];
    return MockupTemplate.find({ isActive: true, subCategories: { $in: subIds } }).sort({ sortOrder: 1 });
  }

  /** Render a single template with the given design artwork. Returns a WebP buffer. */
  static async renderTemplate(template: IMockupTemplate, designBuffer: Buffer): Promise<Buffer> {
    const baseBuffer = await downloadToBuffer(template.baseImage);
    const meta = await sharp(baseBuffer).metadata();
    const W = meta.width || template.baseWidth || 1000;
    const H = meta.height || template.baseHeight || 1000;

    const composites: sharp.OverlayOptions[] = [];

    if (template.renderMode === 'flat') {
      const placements = resolvePlacements(template);
      if (!placements.length) {
        throw new Error('Flat templates require at least one placement area');
      }

      // Composite the sticker into every configured placement area.
      for (const p of placements) {
        const slotW = Math.max(1, Math.round((W * (p.width ?? 50)) / 100));
        const slotH = Math.max(1, Math.round((H * (p.height ?? 50)) / 100));

        let sticker = sharp(designBuffer).ensureAlpha().resize(slotW, slotH, {
          fit: 'inside',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
        if (p.rotation) {
          sticker = sticker.rotate(p.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
        }
        let stickerBuf = await sticker.png().toBuffer();
        if (typeof p.opacity === 'number' && p.opacity < 1) {
          stickerBuf = await applyOpacity(stickerBuf, p.opacity);
        }

        const sMeta = await sharp(stickerBuf).metadata();
        const left = Math.round((W * (p.x ?? 25)) / 100 + (slotW - (sMeta.width || slotW)) / 2);
        const top = Math.round((H * (p.y ?? 25)) / 100 + (slotH - (sMeta.height || slotH)) / 2);
        composites.push({ input: stickerBuf, left, top, blend: (p.blendMode || 'over') as sharp.Blend });
      }
    } else {
      // perspective / curved require ImageMagick
      if (!(await isMagickAvailable())) {
        throw new Error(
          'ImageMagick is required for perspective/curved mockups but is not installed on the server'
        );
      }
      const cornersList = resolveCornersList(template);
      if (!cornersList.length) {
        throw new Error('Perspective/curved templates require four corner points');
      }

      let dispBuffer: Buffer | undefined;
      if (template.renderMode === 'curved') {
        // Use the uploaded map when present; otherwise fall back to a built-in
        // cylindrical map so curved mode works with no extra setup.
        dispBuffer = template.displacementMap
          ? await downloadToBuffer(template.displacementMap)
          : await buildCylindricalDisplacementMap();
      }

      // Warp the sticker onto every configured surface.
      for (const corners of cornersList) {
        let layerBuf: Buffer;
        if (template.renderMode === 'curved') {
          layerBuf = await renderCurvedLayer(
            designBuffer,
            corners,
            W,
            H,
            dispBuffer as Buffer,
            template.displacementStrength ?? 12
          );
        } else {
          layerBuf = await renderPerspectiveLayer(designBuffer, corners, W, H);
        }
        composites.push({ input: layerBuf, left: 0, top: 0, blend: 'over' });
      }
    }

    // Optional lighting/shadow overlay for realism.
    if (template.lightingMap) {
      const lightingBuffer = await downloadToBuffer(template.lightingMap);
      const lightingResized = await sharp(lightingBuffer)
        .resize(W, H, { fit: 'fill' })
        .png()
        .toBuffer();
      composites.push({ input: lightingResized, blend: 'multiply' });
    }

    return sharp(baseBuffer).composite(composites).webp({ quality: 85 }).toBuffer();
  }

  /**
   * Render every matching template for a product and return the new image set.
   * Does NOT persist — the caller decides whether to apply directly (OWNER) or
   * route through QC. Mockup URLs are placed first so a mockup becomes the hero.
   */
  static async generateForProduct(productId: string): Promise<MockupGenerationResult> {
    const product = await Product.findById(productId).populate('subCategories');
    if (!product) throw new Error('product not found');
    if (!product.designImage) {
      throw new Error('Product has no design image. Upload a sticker design before generating mockups.');
    }

    const templates = await this.resolveTemplates(product);
    if (!templates.length) {
      throw new Error("No active mockup templates match this product's subcategories");
    }

    const designBuffer = await downloadToBuffer(product.designImage);

    const generated: GeneratedMockup[] = [];
    // Render sequentially to bound memory use from sharp/ImageMagick.
    for (const template of templates) {
      const buffer = await this.renderTemplate(template, designBuffer);
      const url = await uploadImageToB2(buffer, `mockup-${template.name}.webp`, 'mockups');
      generated.push({
        templateId: template._id as mongoose.Types.ObjectId,
        url,
        generatedAt: new Date(),
      });
    }

    // Preserve manually-uploaded images; drop the previous generation's mockups.
    const previousMockupUrls = new Set((product.mockupImages || []).map((m) => m.url));
    const manualImages = (product.images || []).filter((url) => !previousMockupUrls.has(url));
    const images = [...generated.map((m) => m.url), ...manualImages];

    return { images, mockupImages: generated };
  }

  /**
   * Render mockups for an arbitrary design + set of subcategories, WITHOUT a
   * saved product. Powers the inline "Preview Mockups" button on the product
   * form. Results are uploaded to a previews folder and not persisted anywhere.
   */
  static async previewForSelection(
    designUrl: string,
    subCategoryIds: string[]
  ): Promise<{ templateId: string; name: string; url: string }[]> {
    if (!designUrl) throw new Error('Upload a sticker design to preview mockups');
    const ids = (subCategoryIds || []).filter((id) => /^[0-9a-fA-F]{24}$/.test(String(id)));
    if (!ids.length) throw new Error('Select at least one subcategory to preview mockups');

    const templates = await MockupTemplate.find({ isActive: true, subCategories: { $in: ids } }).sort({
      sortOrder: 1,
    });
    if (!templates.length) {
      throw new Error('No active mockup templates match the selected subcategories');
    }

    const designBuffer = await downloadToBuffer(designUrl);
    const results: { templateId: string; name: string; url: string }[] = [];
    for (const template of templates) {
      const buffer = await this.renderTemplate(template, designBuffer);
      const url = await uploadImageToB2(buffer, `preview-${template.name}.webp`, 'mockups/previews');
      results.push({ templateId: String(template._id), name: template.name, url });
    }
    return results;
  }

  /**
   * Render a single template with a sample design and upload it, for the admin
   * placement-editor preview. Falls back to a generated placeholder sticker.
   */
  static async previewTemplate(id: string, designUrl?: string): Promise<string> {
    const template = await MockupTemplate.findById(id);
    if (!template) throw new Error('Mockup template not found');

    const designBuffer = designUrl
      ? await downloadToBuffer(designUrl)
      : await this.placeholderSticker();

    const buffer = await this.renderTemplate(template, designBuffer);
    return uploadImageToB2(buffer, `preview-${template.name}.webp`, 'mockups/previews');
  }

  private static async placeholderSticker(): Promise<Buffer> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <rect x="20" y="20" width="560" height="560" rx="48" fill="#fbbf24" stroke="#111" stroke-width="12"/>
      <text x="300" y="320" font-family="Arial, sans-serif" font-size="72" font-weight="bold"
            fill="#111" text-anchor="middle">SAMPLE</text>
    </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}
