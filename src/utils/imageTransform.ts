/**
 * Get low-res thumbnail URL (for listings, cards, search)
 * Derives thumbnail path from original: file.webp -> file-thumb.webp
 */
export function getThumbnailUrl(url: string): string {
  return url.replace(/\.webp$/, '-thumb.webp');
}

/**
 * Get high-res URL (for product detail page)
 * With B2, the original is served as-is (watermark applied at upload time if needed)
 */
export function getWatermarkedUrl(url: string): string {
  return url;
}

/**
 * Transform an array of image URLs
 */
export function transformProductImages(images: string[], type: 'thumbnail' | 'watermarked'): string[] {
  const transformFn = type === 'thumbnail' ? getThumbnailUrl : getWatermarkedUrl;
  return images.map(transformFn);
}
