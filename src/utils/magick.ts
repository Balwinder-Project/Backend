import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { IMockupCorners } from '../models/mockupTemplate.model';

/**
 * ImageMagick helpers for perspective + curved mockup rendering.
 *
 * `sharp` handles flat compositing on its own. Perspective warping and
 * displacement mapping are not available in sharp, so these functions shell out
 * to the ImageMagick `magick` (or legacy `convert`) binary when it is installed.
 * Each function produces a base-sized, transparent PNG "sticker layer" that the
 * caller composites onto the base scene with sharp.
 */

let binaryCache: string | null | undefined;

const detectBinary = async (): Promise<string | null> => {
  if (binaryCache !== undefined) return binaryCache;
  for (const bin of ['magick', 'convert']) {
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn(bin, ['-version']);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
    if (ok) {
      binaryCache = bin;
      return bin;
    }
  }
  binaryCache = null;
  return null;
};

export const isMagickAvailable = async (): Promise<boolean> => {
  return (await detectBinary()) !== null;
};

const run = (bin: string, args: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ImageMagick failed (${code}): ${stderr.trim()}`))
    );
  });
};

/** Map percent-based template corners onto absolute base-pixel coordinates. */
const cornersToPixels = (corners: IMockupCorners, width: number, height: number) => ({
  tl: [(corners.tl[0] / 100) * width, (corners.tl[1] / 100) * height],
  tr: [(corners.tr[0] / 100) * width, (corners.tr[1] / 100) * height],
  br: [(corners.br[0] / 100) * width, (corners.br[1] / 100) * height],
  bl: [(corners.bl[0] / 100) * width, (corners.bl[1] / 100) * height],
});

/**
 * Warp the design onto the target quad and return a base-sized transparent PNG.
 */
export const renderPerspectiveLayer = async (
  designBuffer: Buffer,
  corners: IMockupCorners,
  baseWidth: number,
  baseHeight: number
): Promise<Buffer> => {
  const bin = await detectBinary();
  if (!bin) throw new Error('ImageMagick is not installed on the server');

  const meta = await sharp(designBuffer).metadata();
  const dw = meta.width || 1;
  const dh = meta.height || 1;
  const px = cornersToPixels(corners, baseWidth, baseHeight);

  // Control points map the design's own four corners -> the target quad.
  const controlPoints = [
    `0,0 ${px.tl[0]},${px.tl[1]}`,
    `${dw},0 ${px.tr[0]},${px.tr[1]}`,
    `${dw},${dh} ${px.br[0]},${px.br[1]}`,
    `0,${dh} ${px.bl[0]},${px.bl[1]}`,
  ].join('  ');

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mockup-'));
  try {
    const designPath = path.join(dir, 'design.png');
    const outPath = path.join(dir, 'layer.png');
    await fs.writeFile(designPath, await sharp(designBuffer).ensureAlpha().png().toBuffer());

    await run(bin, [
      designPath,
      '-background',
      'none',
      '-alpha',
      'set',
      '-virtual-pixel',
      'transparent',
      '-extent',
      `${baseWidth}x${baseHeight}`,
      '-distort',
      'Perspective',
      controlPoints,
      outPath,
    ]);

    return await fs.readFile(outPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

/**
 * Warp the design onto the target quad, then bend it along a displacement map
 * (for curved surfaces such as mugs and bottles). Returns a base-sized PNG.
 */
export const renderCurvedLayer = async (
  designBuffer: Buffer,
  corners: IMockupCorners,
  baseWidth: number,
  baseHeight: number,
  displacementMap: Buffer,
  strength: number
): Promise<Buffer> => {
  const bin = await detectBinary();
  if (!bin) throw new Error('ImageMagick is not installed on the server');

  const perspectiveLayer = await renderPerspectiveLayer(designBuffer, corners, baseWidth, baseHeight);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mockup-'));
  try {
    const layerPath = path.join(dir, 'layer.png');
    const mapPath = path.join(dir, 'map.png');
    const outPath = path.join(dir, 'curved.png');

    await fs.writeFile(layerPath, perspectiveLayer);
    // Normalize the displacement map to the base dimensions.
    await fs.writeFile(
      mapPath,
      await sharp(displacementMap).resize(baseWidth, baseHeight, { fit: 'fill' }).png().toBuffer()
    );

    await run(bin, [
      layerPath,
      mapPath,
      '-compose',
      'Displace',
      '-define',
      `compose:args=${strength}x${strength}`,
      '-composite',
      outPath,
    ]);

    return await fs.readFile(outPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
