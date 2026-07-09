import sharp from 'sharp';
import path from 'path';

/**
 * Watermarking for public product images.
 *
 * The brand logo lives at `backend/assets/watermark.png` (a transparent PNG —
 * its own colours/outline are preserved). It is resolved relative to
 * `process.cwd()` (the backend/ directory in both `npm run dev` and
 * `npm start`) so it survives the `tsc` build without being copied into `dist/`.
 *
 * The logo is tiled in a repeating grid, rotated diagonally, and composited
 * across the whole image so the mark can't be cropped out of a corner.
 */
const WATERMARK_PATH = path.join(process.cwd(), 'assets', 'watermark.png');

// Opacity of the mark (0..1).
const WATERMARK_OPACITY = 0.65;
// Each logo tile spans this fraction of the base image width.
const TILE_WIDTH_RATIO = 0.32;
// Gaps between tiles, as a fraction of tile width/height.
const GAP_X_RATIO = 0.6;
const GAP_Y_RATIO = 2.2;
// Diagonal angle of the tiled pattern, in degrees.
const ANGLE_DEG = -30;

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Build one logo tile (colours preserved) sized to the base width, faded to the
 * target opacity.
 * @returns tile PNG buffer plus its pixel dimensions.
 */
const buildTile = async (
  baseWidth: number
): Promise<{ buffer: Buffer; width: number; height: number }> => {
  const tileWidth = Math.max(1, Math.round(baseWidth * TILE_WIDTH_RATIO));

  const resized = await sharp(WATERMARK_PATH).resize({ width: tileWidth }).ensureAlpha().png().toBuffer();
  const { width = tileWidth, height = tileWidth } = await sharp(resized).metadata();

  // Fade to target opacity by multiplying the logo's alpha with a uniform mask
  // (dest-in keeps the logo's RGB, scaling only its alpha).
  const buffer = await sharp(resized)
    .composite([
      {
        input: Buffer.from([255, 255, 255, Math.round(255 * WATERMARK_OPACITY)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  return { buffer, width, height };
};

/**
 * Composite the diagonal tiled brand watermark onto an image and return webp.
 * @param fileBuffer Raw source image bytes (any format sharp can read).
 */
export const applyWatermark = async (fileBuffer: Buffer): Promise<Buffer> => {
  const meta = await sharp(fileBuffer).metadata();
  const baseWidth = meta.width || 800;
  const baseHeight = meta.height || 800;

  const tile = await buildTile(baseWidth);

  const stepX = Math.max(1, Math.round(tile.width * (1 + GAP_X_RATIO)));
  const stepY = Math.max(1, Math.round(tile.height * (1 + GAP_Y_RATIO)));

  // Square canvas big enough that, once rotated, it still covers the whole
  // base rectangle (diagonal + one tile of margin on each side).
  const diagonal = Math.ceil(Math.sqrt(baseWidth ** 2 + baseHeight ** 2));
  const canvasSize = diagonal + Math.max(tile.width, tile.height) * 2;

  // Lay tiles in a brick pattern (every other row shifted half a step).
  const composites: sharp.OverlayOptions[] = [];
  let row = 0;
  for (let top = 0; top < canvasSize; top += stepY, row++) {
    const offset = row % 2 === 0 ? 0 : Math.round(stepX / 2);
    for (let left = -offset; left < canvasSize; left += stepX) {
      if (left < 0) continue;
      composites.push({ input: tile.buffer, top, left });
    }
  }

  const tiledLayer = await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: TRANSPARENT },
  })
    .composite(composites)
    .png()
    .toBuffer();

  // Rotate the whole pattern, then crop the base-sized region from the center.
  const rotated = await sharp(tiledLayer)
    .rotate(ANGLE_DEG, { background: TRANSPARENT })
    .png()
    .toBuffer();
  const rotatedMeta = await sharp(rotated).metadata();
  const rotatedWidth = rotatedMeta.width || canvasSize;
  const rotatedHeight = rotatedMeta.height || canvasSize;

  const watermarkLayer = await sharp(rotated)
    .extract({
      left: Math.max(0, Math.round((rotatedWidth - baseWidth) / 2)),
      top: Math.max(0, Math.round((rotatedHeight - baseHeight) / 2)),
      width: baseWidth,
      height: baseHeight,
    })
    .png()
    .toBuffer();

  return sharp(fileBuffer)
    .composite([{ input: watermarkLayer, top: 0, left: 0 }])
    .webp({ quality: 80 })
    .toBuffer();
};
