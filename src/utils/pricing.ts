import { IProduct, IPricingSlab } from '../models/product.model';

export type PricingRole = 'retailer' | 'normal';

/** Retailer per-category percentage slabs, passed in from the retailer record. */
export interface RetailerCategoryDiscount {
  category: string;
  /** Present when this discount is limited to a specific subcategory. */
  subCategory?: string;
  slabs: Array<{ minQuantity: number; discountPercentage: number; referencePrice?: number; wholesalerPrice?: number }>;
}

export interface PricingContext {
  role: PricingRole;
  retailerId?: string | null;
  /** The retailer's negotiated per-category discount slabs (retailer role only). */
  retailerCategoryDiscounts?: RetailerCategoryDiscount[];
  retailerProductPrices?: Array<{ productId: string; slabs: IPricingSlab[] }>;
  /** Active category campaign % for THIS product's category (normal role only). */
  categoryCampaignPercent?: number;
  /**
   * Total quantity of THIS product's category across the whole cart/order.
   * The retailer category-discount slab is matched against this (not the line
   * quantity), so e.g. 30 of A + 20 of B in one category counts as 50.
   * Falls back to the line quantity when omitted.
   */
  categoryQuantity?: number;
  /** Total quantity for the matching subcategory across the cart/order. */
  subCategoryQuantity?: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Cheapest slab price that applies at `quantity`. Null if none match. */
const matchingSlabPrice = (slabs: IPricingSlab[] | undefined, quantity: number): number | null => {
  if (!Array.isArray(slabs) || slabs.length === 0) return null;
  const sorted = [...slabs].sort((a, b) => b.minQuantity - a.minQuantity);
  const match = sorted.find((s) => quantity >= s.minQuantity);
  return match ? match.price : null;
};

/** Highest discount % from the matching quantity slab. Null if none match. */
const matchingDiscountPercent = (
  slabs: Array<{ minQuantity: number; discountPercentage: number; referencePrice?: number; wholesalerPrice?: number }> | undefined,
  quantity: number
): number | null => {
  if (!Array.isArray(slabs) || slabs.length === 0) return null;
  const sorted = [...slabs].sort((a, b) => b.minQuantity - a.minQuantity);
  const match = sorted.find((s) => quantity >= s.minQuantity);
  if (!match) return null;
  if (match.referencePrice != null && match.wholesalerPrice != null && match.referencePrice > 0) {
    return round2(Math.max(0, Math.min(100, ((match.referencePrice - match.wholesalerPrice) / match.referencePrice) * 100)));
  }
  return match.discountPercentage;
};

/**
 * Authoritative per-unit price for an order line — computed from the product and
 * buyer context, never trusting a client-sent price.
 *
 * Retailer precedence: per-product special slabs → the retailer's per-category
 * % slab (off base price) → global wholesale slabs → base price.
 * Normal precedence: normal-user slab (or base) → minus any active category
 * campaign %.
 */
export const getEffectiveUnitPrice = (
  product: IProduct,
  quantity: number,
  ctx: PricingContext
): number => {
  if (ctx.role === 'retailer') {
    // 1. Explicit SKU-specific price slabs saved on the retailer record.
    const skuPrices = ctx.retailerProductPrices?.find((entry) => String(entry.productId) === String(product._id));
    const skuPrice = matchingSlabPrice(skuPrices?.slabs, quantity);
    if (skuPrice !== null) return skuPrice;

    // 2. Per-product special pricing for this retailer.
    if (ctx.retailerId && Array.isArray(product.retailerSpecialPricing)) {
      const special = product.retailerSpecialPricing.find(
        (s) => String(s.retailer) === String(ctx.retailerId)
      );
      const specialPrice = special ? matchingSlabPrice(special.slabs, quantity) : null;
      if (specialPrice !== null) return specialPrice;
    }

    // 3. Subcategory-specific percentage discount takes priority over the
    //    broader category rule. Match whole-cart quantity for that subcategory.
    const productSubcategories = (product.subCategories || []).map((id: any) => String(id));
    const subCategoryDiscount = ctx.retailerCategoryDiscounts?.find(
      (d) => Boolean(d.subCategory) && String(d.category) === String(product.category) && productSubcategories.includes(String(d.subCategory))
    );
    const subCategoryQty = ctx.subCategoryQuantity ?? quantity;
    const subCategoryPct = subCategoryDiscount ? matchingDiscountPercent(subCategoryDiscount.slabs, subCategoryQty) : null;
    if (subCategoryPct !== null && subCategoryPct > 0) {
      return round2(product.price * (1 - subCategoryPct / 100));
    }

    // 4. Retailer's negotiated category-wide percentage slab (off base price).
    //    Matched against the whole-cart category quantity, not the line qty.
    const catDiscount = ctx.retailerCategoryDiscounts?.find(
      (d) => !d.subCategory && String(d.category) === String(product.category)
    );
    const categoryQty = ctx.categoryQuantity ?? quantity;
    const discountPct = catDiscount ? matchingDiscountPercent(catDiscount.slabs, categoryQty) : null;
    if (discountPct !== null && discountPct > 0) {
      return round2(product.price * (1 - discountPct / 100));
    }

    // 5. Global wholesale slabs.
    const wholesale = matchingSlabPrice(product.retailerPricing?.slabs, quantity);
    if (wholesale !== null) return wholesale;

    return product.price;
  }

  // Normal customer: slab (or base), then apply the active category campaign.
  const base = matchingSlabPrice(product.normalUserPricing, quantity) ?? product.price;
  const campaign = ctx.categoryCampaignPercent && ctx.categoryCampaignPercent > 0 ? ctx.categoryCampaignPercent : 0;
  return campaign > 0 ? round2(base * (1 - campaign / 100)) : base;
};

/** Minimum order quantity for the buyer's role. */
export const getMinOrderQuantity = (
  product: IProduct,
  role: PricingRole,
  retailerId?: string | null
): number => {
  if (role !== 'retailer') return 1;

  if (retailerId && Array.isArray(product.retailerSpecialPricing)) {
    const special = product.retailerSpecialPricing.find((s) => String(s.retailer) === String(retailerId));
    if (special && (special.minimumOrderQuantity ?? 0) > 0) return special.minimumOrderQuantity;
  }
  return product.retailerPricing?.minimumOrderQuantity && product.retailerPricing.minimumOrderQuantity > 0
    ? product.retailerPricing.minimumOrderQuantity
    : 1;
};

/**
 * Convert a retailer's per-category % slabs into absolute price slabs for a
 * product, so the storefront's slab-based pricing can display them uniformly.
 */
export const retailerCategorySlabsToPrices = (
  basePrice: number,
  slabs: Array<{ minQuantity: number; discountPercentage: number; referencePrice?: number; wholesalerPrice?: number }>
): IPricingSlab[] =>
  (slabs || []).map((s) => ({
    minQuantity: s.minQuantity,
    price: round2(basePrice * (1 - (s.discountPercentage || 0) / 100)),
  }));
