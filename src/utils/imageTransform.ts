/**
 * Get low-res thumbnail URL (for listings, cards, search)
 * Derives thumbnail path from original: file.webp -> file-thumb.webp
 */
export function getThumbnailUrl(url: string): string {
  return url.replace(/\.webp$/, '-thumb.webp');
}

/**
 * Get watermarked high-res URL (for the public product detail page)
 * Derives the watermarked variant from the original: file.webp -> file-wm.webp
 * The watermarked variant is generated at upload time (see imageUpload.ts).
 */
export function getWatermarkedUrl(url: string): string {
  // Mockup scenes are marketing assets and are uploaded without a watermarked
  // variant, so serve them unchanged (rewriting would 404 on a missing -wm file).
  if (url.includes('/mockups/')) return url;
  return url.replace(/\.webp$/, '-wm.webp');
}

/**
 * Whether a product's top-level category is Name Plates.
 * Those products are served without the brand watermark on the public PDP.
 * Matches slug `name-plates` and common name variants (Name Plate / Name Plates).
 */
export function isNamePlateCategory(category: unknown): boolean {
  if (!category || typeof category !== 'object') return false;
  const c = category as { slug?: string; name?: string };
  const slug = (c.slug || '').toLowerCase().trim();
  if (slug === 'name-plates' || slug === 'name-plate') return true;

  const normalizedName = (c.name || '').toLowerCase().replace(/[\s_-]+/g, '');
  return normalizedName === 'nameplates' || normalizedName === 'nameplate';
}

/**
 * Transform an array of image URLs
 */
export function transformProductImages(images: string[], type: 'thumbnail' | 'watermarked'): string[] {
  const transformFn = type === 'thumbnail' ? getThumbnailUrl : getWatermarkedUrl;
  return images.map(transformFn);
}
