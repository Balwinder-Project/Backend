/**
 * Remove watermarked variants of mockup images from B2.
 *
 * Older uploads generated a `-wm.webp` watermarked variant for every image,
 * including mockup scenes. Mockups are now served clean (getWatermarkedUrl
 * skips them and uploadImageToB2 no longer generates their -wm variant), which
 * leaves those old `-wm.webp` files orphaned in the bucket. This deletes them.
 *
 * It scans every object under `balwinder/mockups/` and deletes the ones ending
 * in `-wm.webp`. The clean original mockup `.webp` files are left untouched.
 *
 * Usage:
 *   npx ts-node src/scripts/cleanMockupWatermarks.ts          # dry run (lists only)
 *   npx ts-node src/scripts/cleanMockupWatermarks.ts --apply  # actually delete
 */
import 'dotenv/config';
import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { s3Client, B2_BUCKET_NAME } from '../config/b2';

const APPLY = process.argv.includes('--apply');
const PREFIX = 'balwinder/mockups/';

const run = async () => {
  console.log(
    `Scanning s3://${B2_BUCKET_NAME}/${PREFIX} for watermarked mockup variants (-wm.webp)…`
  );
  console.log(APPLY ? 'Mode: APPLY (will delete)' : 'Mode: DRY RUN (no deletion — pass --apply to delete)');

  const toDelete: string[] = [];
  let continuationToken: string | undefined;
  let scanned = 0;

  do {
    const page = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: B2_BUCKET_NAME,
        Prefix: PREFIX,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of page.Contents || []) {
      scanned++;
      if (obj.Key && obj.Key.endsWith('-wm.webp')) {
        toDelete.push(obj.Key);
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`Scanned ${scanned} objects. Found ${toDelete.length} watermarked mockup variant(s).`);

  if (!toDelete.length) {
    console.log('Nothing to clean.');
    return;
  }

  if (!APPLY) {
    toDelete.slice(0, 20).forEach((k) => console.log(`  would delete: ${k}`));
    if (toDelete.length > 20) console.log(`  … and ${toDelete.length - 20} more`);
    console.log('\nDry run complete. Re-run with --apply to delete these.');
    return;
  }

  // S3 DeleteObjects accepts up to 1000 keys per call.
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 1000) {
    const chunk = toDelete.slice(i, i + 1000);
    const res = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: B2_BUCKET_NAME,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      })
    );
    deleted += chunk.length - (res.Errors?.length || 0);
    (res.Errors || []).forEach((e) => console.error(`  ✗ ${e.Key}: ${e.Message}`));
  }

  console.log(`\nDone. Deleted ${deleted}/${toDelete.length} watermarked mockup variant(s).`);
};

run().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
