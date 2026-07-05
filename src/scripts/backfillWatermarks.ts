/**
 * Backfill watermarked variants for existing product images.
 *
 * Older uploads only have `file.webp` + `file-thumb.webp` in B2. Now that the
 * public detail page serves `file-wm.webp`, existing products would 404 on their
 * images until this runs. For every product image, this downloads the original,
 * composites the watermark, and uploads the `-wm.webp` sibling.
 *
 * Usage:
 *   npx ts-node src/scripts/backfillWatermarks.ts          # process all
 *   npx ts-node src/scripts/backfillWatermarks.ts --force  # re-generate even if -wm exists
 */
import 'dotenv/config';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { s3Client, B2_BUCKET_NAME, B2_PUBLIC_URL } from '../config/b2';
import Product from '../models/product.model';
import { downloadToBuffer } from '../utils/imageDownload';
import { applyWatermark } from '../utils/watermark';

const FORCE = process.argv.includes('--force');

const keyFromUrl = (imageUrl: string): string | null => {
  if (!B2_PUBLIC_URL || !imageUrl.startsWith(B2_PUBLIC_URL)) return null;
  return imageUrl.slice(B2_PUBLIC_URL.length + 1); // +1 for the trailing slash
};

const objectExists = async (key: string): Promise<boolean> => {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: B2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
};

const run = async () => {
  await connectDatabase();

  const products = await Product.find({}, { images: 1, name: 1 }).lean();
  console.log(`Found ${products.length} products to scan${FORCE ? ' (force mode)' : ''}.`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    const images: string[] = (product as any).images || [];
    for (const imageUrl of images) {
      // Only process originals; skip anything that already looks like a variant.
      if (!/\.webp$/.test(imageUrl) || /-(thumb|wm)\.webp$/.test(imageUrl)) continue;

      const key = keyFromUrl(imageUrl);
      if (!key) {
        console.warn(`  ! Skipping non-B2 URL: ${imageUrl}`);
        continue;
      }
      const wmKey = key.replace(/\.webp$/, '-wm.webp');

      try {
        if (!FORCE && (await objectExists(wmKey))) {
          skipped++;
          continue;
        }

        const originalBuffer = await downloadToBuffer(imageUrl);
        const watermarkedBuffer = await applyWatermark(originalBuffer);

        await s3Client.send(new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: wmKey,
          Body: watermarkedBuffer,
          ContentType: 'image/webp',
        }));

        created++;
        console.log(`  ✓ ${wmKey}`);
      } catch (error: any) {
        failed++;
        console.error(`  ✗ ${wmKey}: ${error.message}`);
      }
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
  await disconnectDatabase();
};

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
