/**
 * Backfill permanent public watermarked variants for existing product images.
 * Safe to rerun: existing -wm-v2.webp files are skipped unless --force is passed.
 */
import 'dotenv/config';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { s3Client, B2_BUCKET_NAME, B2_PUBLIC_URL } from '../config/b2';
import Product from '../models/product.model';
import { downloadToBuffer } from '../utils/imageDownload';
import { applyWatermark } from '../utils/watermark';

const FORCE = process.argv.includes('--force');
const MAX_ATTEMPTS = 3;
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.WATERMARK_CONCURRENCY) || 5));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`    Retry ${attempt}/${MAX_ATTEMPTS} failed for ${label}: ${(error as Error).message}`);
      if (attempt < MAX_ATTEMPTS) await wait(attempt * 1500);
    }
  }
  throw lastError;
};

const keyFromUrl = (imageUrl: string): string | null => {
  if (!B2_PUBLIC_URL || !imageUrl.startsWith(B2_PUBLIC_URL)) return null;
  return imageUrl.slice(B2_PUBLIC_URL.length + 1);
};

const objectExists = async (key: string): Promise<boolean> => {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: B2_BUCKET_NAME, Key: key }));
    return true;
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    const code = error?.name || error?.Code;
    if (status === 404 || code === 'NotFound' || code === 'NoSuchKey') return false;
    throw error;
  }
};

type BackfillTask = { productName: string; imageUrl: string; key: string; wmKey: string };

const run = async () => {
  let connected = false;
  try {
    await connectDatabase();
    connected = true;

    const products = await Product.find({}, { images: 1, name: 1 }).lean();
    const tasks: BackfillTask[] = [];

    for (const product of products) {
      const images: string[] = (product as any).images || [];
      for (const imageUrl of images) {
        if (imageUrl.includes('/design-requests/')) continue;
        if (!/\\.webp$/i.test(imageUrl) || /-(thumb|wm(?:-v\\d+)?)\\.webp$/i.test(imageUrl)) continue;
        const key = keyFromUrl(imageUrl);
        if (!key) {
          console.warn(`Skipping non-B2 URL: ${imageUrl}`);
          continue;
        }
        tasks.push({
          productName: String((product as any).name || 'Unnamed product'),
          imageUrl,
          key,
          wmKey: key.replace(/\\.webp$/i, '-wm-v2.webp'),
        });
      }
    }

    console.log(`Found ${products.length} products and ${tasks.length} original images to check. Concurrency=${CONCURRENCY}`);
    let created = 0;
    let skipped = 0;
    let failed = 0;
    let completed = 0;
    let nextIndex = 0;

    const processTask = async (task: BackfillTask, index: number) => {
      const label = `[${index + 1}/${tasks.length}] ${task.productName} — ${task.key}`;
      try {
        if (!FORCE && await withRetry(task.wmKey, () => objectExists(task.wmKey))) {
          skipped++;
        } else {
          const originalBuffer = await withRetry(task.key, () => downloadToBuffer(task.imageUrl));
          const watermarkedBuffer = await withRetry(task.key + ' watermark', () => applyWatermark(originalBuffer));
          await withRetry(task.wmKey + ' upload', () => s3Client.send(new PutObjectCommand({
            Bucket: B2_BUCKET_NAME,
            Key: task.wmKey,
            Body: watermarkedBuffer,
            ContentType: 'image/webp',
          })));
          created++;
        }
      } catch (error: any) {
        failed++;
        console.error(`FAILED ${label}: ${error?.message || error}`);
      } finally {
        completed++;
        console.log(`Progress ${completed}/${tasks.length} | created=${created} skipped=${skipped} failed=${failed}`);
      }
    };

    const worker = async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= tasks.length) return;
        await processTask(tasks[index], index);
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker()));
    console.log(`BACKFILL COMPLETE: total=${tasks.length}, created=${created}, skipped=${skipped}, failed=${failed}`);
  } finally {
    if (connected) await disconnectDatabase();
  }
};

run().catch((error) => {
  console.error('Backfill stopped with fatal error:', error);
  process.exitCode = 1;
});
