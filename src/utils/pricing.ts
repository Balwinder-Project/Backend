import { IProduct, IPricingSlab } from '../models/product.model';

export type PricingRole = 'retailer' | 'normal';

/**
 * Cheapest slab price that applies at `quantity` (slab with the highest
 * minQuantity <= quantity wins). Returns null when no slab matches.
 */
const matchingSlabPrice = (slabs: IPricingSlab[] | undefined, quantity: number): number | null => {
  if (!Array.isArray(slabs) || slabs.length === 0) return null;
  const sorted = [...slabs].sort((a, b) => b.minQuantity - a.minQuantity);
  const match = sorted.find((s) => quantity >= s.minQuantity);
  return match ? match.price : null;
};

/**
 * Authoritative per-unit price for an order line, computed from the product and
 * the buyer's role — never trust a price sent by the client. Mirrors the
 * storefront's getEffectivePrice, including per-retailer special pricing.
 *
 * @param retailerId the buyer's retailer id (only when role === 'retailer').
 */
export const getEffectiveUnitPrice = (
  product: IProduct,
  quantity: number,
  role: PricingRole,
  retailerId?: string | null
): number => {
  if (role === 'retailer') {
    // Per-retailer special pricing overrides the product-wide wholesale slabs.
    if (retailerId && Array.isArray(product.retailerSpecialPricing)) {
      const special = product.retailerSpecialPricing.find(
        (s) => String(s.retailer) === String(retailerId)
      );
      const specialPrice = special ? matchingSlabPrice(special.slabs, quantity) : null;
      if (specialPrice !== null) return specialPrice;
    }
    const wholesale = matchingSlabPrice(product.retailerPricing?.slabs, quantity);
    if (wholesale !== null) return wholesale;
    return product.price;
  }

  const normal = matchingSlabPrice(product.normalUserPricing, quantity);
  if (normal !== null) return normal;
  return product.price;
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
