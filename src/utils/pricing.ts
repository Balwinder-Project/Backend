import { IProduct, IPricingSlab } from '../models/product.model';

export type PricingRole = 'retailer' | 'normal';

/** Retailer per-category percentage slabs, passed in from the retailer record. */
export interface RetailerCategoryDiscount {
  category: string;
  slabs: Array<{ minQuantity: number; discountPercentage: number }>;
}

export interface PricingContext {
  role: PricingRole;
  retailerId?: string | null;
  /** The retailer's negotiated per-category discount slabs (retailer role only). */
  retailerCategoryDiscounts?: RetailerCategoryDiscount[];
  /** Active category campaign % for THIS product's category (normal role only). */
  categoryCampaignPercent?: number;
  /**
   * Total quantity of THIS product's category across the whole cart/order.
   * The retailer category-discount slab is matched against this (not the line
   * quantity), so e.g. 30 of A + 20 of B in one category counts as 50.
   * Falls back to the line quantity when omitted.
   */
  categoryQuantity?: number;
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
  slabs: Array<{ minQuantity: number; discountPercentage: number }> | undefined,
  quantity: number
): number | null => {
  if (!Array.isArray(slabs) || slabs.length === 0) return null;
  const sorted = [...slabs].sort((a, b) => b.minQuantity - a.minQuantity);
  const match = sorted.find((s) => quantity >= s.minQuantity);
  return match ? match.discountPercentage : null;
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
    // 1. Per-product special pricing for this retailer.
    if (ctx.retailerId && Array.isArray(product.retailerSpecialPricing)) {
      const special = product.retailerSpecialPricing.find(
        (s) => String(s.retailer) === String(ctx.retailerId)
      );
      const specialPrice = special ? matchingSlabPrice(special.slabs, quantity) : null;
      if (specialPrice !== null) return specialPrice;
    }

    // 2. Retailer's negotiated per-category percentage slab (off base price).
    //    Matched against the whole-cart category quantity, not the line qty.
    const catDiscount = ctx.retailerCategoryDiscounts?.find(
      (d) => String(d.category) === String(product.category)
    );
    const categoryQty = ctx.categoryQuantity ?? quantity;
    const discountPct = catDiscount ? matchingDiscountPercent(catDiscount.slabs, categoryQty) : null;
    if (discountPct !== null && discountPct > 0) {
      return round2(product.price * (1 - discountPct / 100));
    }

    // 3. Global wholesale slabs.
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
  slabs: Array<{ minQuantity: number; discountPercentage: number }>
): IPricingSlab[] =>
  (slabs || []).map((s) => ({
    minQuantity: s.minQuantity,
    price: round2(basePrice * (1 - (s.discountPercentage || 0) / 100)),
  }));
