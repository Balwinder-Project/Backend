/**
 * Upload curated local fonts to Backblaze B2 and publish a public CSS + JSON manifest.
 *
 * Usage:
 *   FONT_SOURCE_DIR=~/Downloads/Fonts npx ts-node src/scripts/uploadCustomFonts.ts
 *   npx ts-node src/scripts/uploadCustomFonts.ts --dry-run
 *
 * Writes under:
 *   balwinder/fonts/{id}.{ext}
 *   balwinder/fonts/manifest.json
 *   balwinder/fonts/fonts.css
 *
 * Also attempts to set a permissive GET CORS rule so browsers can use FontFace / @font-face.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PutObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { s3Client, B2_BUCKET_NAME, B2_PUBLIC_URL } from '../config/b2';
import {
  FONT_CATALOG,
  contentTypeForExt,
  formatForExt,
} from './fontCatalog';

const PREFIX = 'balwinder/fonts';
const dryRun = process.argv.includes('--dry-run');

const sourceDir =
  process.env.FONT_SOURCE_DIR ||
  path.join(os.homedir(), 'Downloads', 'Fonts');

interface ManifestFont {
  id: string;
  family: string;
  url: string;
  format: string;
  key: string;
}

async function ensureCors(): Promise<void> {
  if (dryRun) {
    console.log('[dry-run] would set bucket CORS for GET/HEAD *');
    return;
  }
  try {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: B2_BUCKET_NAME,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ['*'],
              AllowedMethods: ['GET', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
              MaxAgeSeconds: 86400,
            },
          ],
        },
      })
    );
    console.log('Bucket CORS updated (GET/HEAD from any origin)');
  } catch (err: any) {
    console.warn(
      'Could not set bucket CORS (fonts may still work if CORS already allows GET):',
      err?.message || err
    );
  }
}

async function uploadBuffer(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  if (dryRun) {
    console.log(`[dry-run] put ${key} (${contentType})`);
    return `${B2_PUBLIC_URL}/${key}`;
  }
  await s3Client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      Body: typeof body === 'string' ? Buffer.from(body, 'utf8') : body,
      ContentType: contentType,
      // B2 ignores ACL; public access is via bucket settings + friendly URL
    })
  );
  return `${B2_PUBLIC_URL}/${key}`;
}

function buildCss(fonts: ManifestFont[]): string {
  const blocks = fonts.map((f) => {
    return [
      `@font-face {`,
      `  font-family: '${f.family.replace(/'/g, "\\'")}';`,
      `  src: url('${f.url}') format('${f.format}');`,
      `  font-style: normal;`,
      `  font-weight: 400 700;`,
      `  font-display: swap;`,
      `}`,
    ].join('\n');
  });
  return (
    `/* BnD Creation custom product-preview fonts — generated ${new Date().toISOString()} */\n` +
    blocks.join('\n\n') +
    '\n'
  );
}

async function main() {
  if (!B2_BUCKET_NAME || !B2_PUBLIC_URL) {
    throw new Error('B2_BUCKET_NAME / B2_PUBLIC_URL missing from env');
  }
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Font source directory not found: ${sourceDir}`);
  }

  console.log(`Source: ${sourceDir}`);
  console.log(`Bucket: ${B2_BUCKET_NAME}`);
  console.log(`Public: ${B2_PUBLIC_URL}/${PREFIX}/`);
  console.log(`Catalog entries: ${FONT_CATALOG.length}`);
  if (dryRun) console.log('DRY RUN — no uploads');

  await ensureCors();

  const uploaded: ManifestFont[] = [];
  const missing: string[] = [];

  for (const entry of FONT_CATALOG) {
    const localPath = path.join(sourceDir, entry.sourceFile);
    if (!fs.existsSync(localPath)) {
      missing.push(entry.sourceFile);
      console.warn(`  SKIP missing: ${entry.sourceFile}`);
      continue;
    }

    const ext = path.extname(entry.sourceFile).toLowerCase() || '.ttf';
    const key = `${PREFIX}/${entry.id}${ext}`;
    const buf = fs.readFileSync(localPath);
    const contentType = contentTypeForExt(ext);
    const url = await uploadBuffer(key, buf, contentType);

    uploaded.push({
      id: entry.id,
      family: entry.family,
      url,
      format: formatForExt(ext),
      key,
    });
    console.log(`  OK ${entry.family} → ${key} (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    cssUrl: `${B2_PUBLIC_URL}/${PREFIX}/fonts.css`,
    fonts: uploaded,
  };

  const css = buildCss(uploaded);
  const manifestUrl = await uploadBuffer(
    `${PREFIX}/manifest.json`,
    JSON.stringify(manifest, null, 2),
    'application/json; charset=utf-8'
  );
  const cssUrl = await uploadBuffer(
    `${PREFIX}/fonts.css`,
    css,
    'text/css; charset=utf-8'
  );

  console.log('\nDone.');
  console.log(`  Uploaded fonts: ${uploaded.length}`);
  console.log(`  Missing:        ${missing.length}`);
  if (missing.length) console.log('  Missing files:', missing.join(', '));
  console.log(`  Manifest: ${manifestUrl}`);
  console.log(`  CSS:      ${cssUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
