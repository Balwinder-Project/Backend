const WATERMARK_PUBLIC_ID = process.env.WATERMARK_LOGO_PUBLIC_ID || 'balwinder:brand:logo-watermark';
const THUMBNAIL_TRANSFORMATION = 'c_fill,w_400,h_400,q_auto:low,f_auto';
const WATERMARK_TRANSFORMATION = `q_auto,f_auto/l_${WATERMARK_PUBLIC_ID},o_30,w_150,a_-30,fl_tiled,fl_layer_apply`;

/**
 * Insert a Cloudinary transformation segment into a URL after "/upload/"
 */
function insertTransformation(url: string, transformation: string): string {
  const uploadSegment = '/upload/';
  const idx = url.indexOf(uploadSegment);
  if (idx === -1) return url;
  const insertPoint = idx + uploadSegment.length;
  return url.slice(0, insertPoint) + transformation + '/' + url.slice(insertPoint);
}

/**
 * Get low-res thumbnail URL (for listings, cards, search)
 */
export function getThumbnailUrl(url: string): string {
  return insertTransformation(url, THUMBNAIL_TRANSFORMATION);
}

/**
 * Get high-res watermarked URL (for product detail page)
 */
export function getWatermarkedUrl(url: string): string {
  return insertTransformation(url, WATERMARK_TRANSFORMATION);
}

/**
 * Transform an array of image URLs
 */
export function transformProductImages(images: string[], type: 'thumbnail' | 'watermarked'): string[] {
  const transformFn = type === 'thumbnail' ? getThumbnailUrl : getWatermarkedUrl;
  return images.map(transformFn);
}
