import sharp from 'sharp';
import path from 'path';

/**
 * Watermarking for public product images.
 * The logo is tiled diagonally over the source image.
 */
const WATERMARK_PATH = path.join(process.cwd(), 'assets', 'watermark.png');
const WATERMARK_OPACITY = 0.65;
// Denser diagonal logo tiling to match the approved reference artwork.
const TILE_WIDTH_RATIO = 0.28;
const GAP_X_RATIO = 0.15;
const GAP_Y_RATIO = 0.7;
const ANGLE_DEG = -30;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
// Allows high-resolution print artwork while retaining a defined safety limit.
const MAX_INPUT_PIXELS = 100_000_000;

const buildTile = async (
  baseWidth: number
): Promise<{ buffer: Buffer; width: number; height: number }> => {
  const tileWidth = Math.max(1, Math.round(baseWidth * TILE_WIDTH_RATIO));
  const resized = await sharp(WATERMARK_PATH)
    .resize({ width: tileWidth })
    .ensureAlpha()
    .png()
    .toBuffer();
  const { width = tileWidth, height = tileWidth } = await sharp(resized).metadata();

  const faded = await sharp(resized)
    .composite([{
      input: Buffer.from([255, 255, 255, Math.round(255 * WATERMARK_OPACITY)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();

  // Rotate one small tile instead of rotating a huge diagonal canvas. The old
  // diagonal-canvas approach could exceed Sharp's pixel limit even when the
  // uploaded source image itself was within the configured limit.
  const rotated = await sharp(faded)
    .rotate(ANGLE_DEG, { background: TRANSPARENT })
    .png()
    .toBuffer();
  const rotatedMeta = await sharp(rotated).metadata();

  return {
    buffer: rotated,
    width: rotatedMeta.width || width,
    height: rotatedMeta.height || height,
  };
};

/**
 * Composite a tiled diagonal brand watermark onto an image and return WebP.
 * The watermark canvas is exactly the source image dimensions, avoiding a
 * temporary square canvas that could be several times larger than the source.
 */
export const applyWatermark = async (fileBuffer: Buffer): Promise<Buffer> => {
  const meta = await sharp(fileBuffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  const baseWidth = meta.width || 800;
  const baseHeight = meta.height || 800;
  const tile = await buildTile(baseWidth);

  const stepX = Math.max(1, Math.round(tile.width * (1 + GAP_X_RATIO)));
  const stepY = Math.max(1, Math.round(tile.height * (1 + GAP_Y_RATIO)));
  const composites: sharp.OverlayOptions[] = [];

  // Every overlay is kept within the source bounds. This keeps intermediate
  // image dimensions bounded by the original image rather than its diagonal.
  let row = 0;
  for (let top = 0; top + tile.height <= baseHeight; top += stepY, row++) {
    const offset = row % 2 === 0 ? 0 : Math.round(stepX / 2);
    for (let left = offset; left + tile.width <= baseWidth; left += stepX) {
      composites.push({ input: tile.buffer, top, left });
    }
  }

  const watermarkLayer = await sharp({
    create: {
      width: baseWidth,
      height: baseHeight,
      channels: 4,
      background: TRANSPARENT,
    },
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .composite(composites)
    .png()
    .toBuffer();

  return sharp(fileBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .composite([{ input: watermarkLayer, top: 0, left: 0 }])
    .webp({ quality: 80 })
    .toBuffer();
};
