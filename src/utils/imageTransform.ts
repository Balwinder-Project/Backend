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
  return url.replace(/\.webp$/, '-wm.webp');
}

/**
 * Transform an array of image URLs
 */
export function transformProductImages(images: string[], type: 'thumbnail' | 'watermarked'): string[] {
  const transformFn = type === 'thumbnail' ? getThumbnailUrl : getWatermarkedUrl;
  return images.map(transformFn);
}
