import sharp from 'sharp';
import path from 'path';

/**
 * Watermarking for public product images.
 *
 * A pre-baked, white, semi-transparent version of the brand logo lives at
 * `backend/assets/watermark.png`. It is resolved relative to `process.cwd()`
 * (the backend/ directory in both `npm run dev` and `npm start`) so it survives
 * the `tsc` build without needing to be copied into `dist/`.
 *
 * The watermark is centered and scaled to a fraction of the base image width.
 */
const WATERMARK_PATH = path.join(process.cwd(), 'assets', 'watermark.png');

// Watermark spans this fraction of the base image's width.
const WATERMARK_WIDTH_RATIO = 0.65;

/**
 * Composite the brand watermark onto an image and return a webp buffer.
 * @param fileBuffer Raw source image bytes (any format sharp can read).
 */
export const applyWatermark = async (fileBuffer: Buffer): Promise<Buffer> => {
  const meta = await sharp(fileBuffer).metadata();
  const baseWidth = meta.width || 800;

  // Never let the watermark exceed the base width (keeps small images intact).
  const targetWidth = Math.max(1, Math.min(baseWidth, Math.round(baseWidth * WATERMARK_WIDTH_RATIO)));

  const watermark = await sharp(WATERMARK_PATH)
    .resize({ width: targetWidth })
    .toBuffer();

  return sharp(fileBuffer)
    .composite([{ input: watermark, gravity: 'center' }])
    .webp({ quality: 80 })
    .toBuffer();
};
