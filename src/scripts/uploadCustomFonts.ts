/**
 * Scan a local Fonts directory and upload ALL web-usable fonts (TTF/OTF) to B2.
 *
 * Usage:
 *   FONT_SOURCE_DIR=~/Downloads/Fonts npx ts-node src/scripts/uploadCustomFonts.ts
 *   npx ts-node src/scripts/uploadCustomFonts.ts --dry-run
 *   npx ts-node src/scripts/uploadCustomFonts.ts --limit=50   # smoke test
 *
 * Writes:
 *   balwinder/fonts/{id}.{ext}
 *   balwinder/fonts/manifest.json
 *   balwinder/fonts/fonts.css
 *
 * Skips: .fon (bitmap), .ttc (collections — poor web support), non-font junk.
 * Uses `fc-query` (fontconfig) for real family / full names when available.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PutObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { s3Client, B2_BUCKET_NAME, B2_PUBLIC_URL } from '../config/b2';

const PREFIX = 'balwinder/fonts';
const CONCURRENCY = 8;

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

const sourceDir =
  process.env.FONT_SOURCE_DIR ||
  path.join(os.homedir(), 'Downloads', 'Fonts');

const USABLE_EXT = new Set(['.ttf', '.otf', '.woff', '.woff2']);

interface ManifestFont {
  id: string;
  family: string;
  url: string;
  format: string;
  key: string;
  sourceFile: string;
  style?: string;
}

function contentTypeForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.otf') return 'font/otf';
  if (e === '.woff') return 'font/woff';
  if (e === '.woff2') return 'font/woff2';
  return 'font/ttf';
}

function formatForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.otf') return 'opentype';
  if (e === '.woff') return 'woff';
  if (e === '.woff2') return 'woff2';
  return 'truetype';
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'font';
}

function beautifyFilename(base: string): string {
  // AGENCYR -> Agencyr, "Bodoni Bd BT Bold" stays spaced
  let s = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  // expand common short codes slightly
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Title-ish case for all-caps short names
  if (s === s.toUpperCase() && s.length <= 24) {
    s = s
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return s || base;
}

interface FaceMeta {
  fullname: string;
  family: string;
  style: string;
}

function queryFaceMeta(filePath: string): FaceMeta | null {
  try {
    const out = execFileSync(
      'fc-query',
      ['-f', '%{fullname[0]}\n%{family[0]}\n%{style[0]}\n', filePath],
      { encoding: 'utf8', timeout: 5000 }
    );
    const [fullname = '', family = '', style = ''] = out.split('\n');
    if (!family && !fullname) return null;
    return {
      fullname: (fullname || family).trim(),
      family: (family || fullname).trim(),
      style: (style || 'Regular').trim(),
    };
  } catch {
    return null;
  }
}

/** CSS font-family + picker label — unique per face so bold/regular both appear */
function displayFamily(meta: FaceMeta | null, fileBase: string): string {
  if (!meta) return beautifyFilename(fileBase);
  const style = (meta.style || '').toLowerCase();
  const isDefaultStyle =
    !style ||
    style === 'regular' ||
    style === 'normal' ||
    style === 'book' ||
    style === 'roman' ||
    style === 'medium';
  // Prefer fullname when it already distinguishes the face
  if (meta.fullname && meta.fullname !== meta.family) {
    return meta.fullname;
  }
  if (!isDefaultStyle && meta.family) {
    return `${meta.family} ${meta.style}`;
  }
  return meta.fullname || meta.family || beautifyFilename(fileBase);
}

async function ensureCors(): Promise<void> {
  if (dryRun) {
    console.log('[dry-run] would set bucket CORS');
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
    console.log('Bucket CORS updated');
  } catch (err: any) {
    console.warn('CORS update skipped:', err?.message || err);
  }
}

async function uploadBuffer(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  if (dryRun) {
    return `${B2_PUBLIC_URL}/${key}`;
  }
  await s3Client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      Body: typeof body === 'string' ? Buffer.from(body, 'utf8') : body,
      ContentType: contentType,
    })
  );
  return `${B2_PUBLIC_URL}/${key}`;
}

function buildCss(fonts: ManifestFont[]): string {
  const blocks = fonts.map((f) => {
    const family = f.family.replace(/'/g, "\\'");
    return [
      `@font-face {`,
      `  font-family: '${family}';`,
      `  src: url('${f.url}') format('${f.format}');`,
      `  font-style: normal;`,
      `  font-weight: 400 700;`,
      `  font-display: swap;`,
      `}`,
    ].join('\n');
  });
  return (
    `/* BnD custom product-preview fonts — generated ${new Date().toISOString()} — ${fonts.length} faces */\n` +
    blocks.join('\n\n') +
    '\n'
  );
}

function listFontFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!USABLE_EXT.has(ext)) continue;
    // Skip macOS junk
    if (ent.name.startsWith('._') || ent.name.startsWith('.')) continue;
    files.push(path.join(dir, ent.name));
  }
  return files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  if (!B2_BUCKET_NAME || !B2_PUBLIC_URL) {
    throw new Error('B2_BUCKET_NAME / B2_PUBLIC_URL missing from env');
  }
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Font source directory not found: ${sourceDir}`);
  }

  let files = listFontFiles(sourceDir);
  if (limit > 0) files = files.slice(0, limit);

  console.log(`Source: ${sourceDir}`);
  console.log(`Bucket: ${B2_BUCKET_NAME}`);
  console.log(`Public: ${B2_PUBLIC_URL}/${PREFIX}/`);
  console.log(`Usable font files found: ${files.length}`);
  if (dryRun) console.log('DRY RUN — no uploads');

  await ensureCors();

  const usedIds = new Set<string>();
  const usedFamilies = new Set<string>();

  const uploaded = await mapPool(files, CONCURRENCY, async (filePath, index) => {
    const sourceFile = path.basename(filePath);
    const ext = path.extname(sourceFile).toLowerCase();
    const base = path.basename(sourceFile, path.extname(sourceFile));

    let id = slugify(base);
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);

    const meta = queryFaceMeta(filePath);
    let family = displayFamily(meta, base);
    // Ensure unique CSS family names (picker + @font-face)
    if (usedFamilies.has(family.toLowerCase())) {
      let n = 2;
      const root = family;
      while (usedFamilies.has(`${root} (${n})`.toLowerCase())) n++;
      family = `${root} (${n})`;
    }
    usedFamilies.add(family.toLowerCase());

    const key = `${PREFIX}/${id}${ext}`;
    const buf = fs.readFileSync(filePath);
    const contentType = contentTypeForExt(ext);

    try {
      const url = await uploadBuffer(key, buf, contentType);
      const entry: ManifestFont = {
        id,
        family,
        url,
        format: formatForExt(ext),
        key,
        sourceFile,
        style: meta?.style,
      };
      if ((index + 1) % 25 === 0 || index === 0 || index === files.length - 1) {
        console.log(
          `  [${index + 1}/${files.length}] ${family} ← ${sourceFile} (${(buf.length / 1024).toFixed(0)} KB)`
        );
      }
      return entry;
    } catch (err: any) {
      console.error(`  FAIL ${sourceFile}:`, err?.message || err);
      return null;
    }
  });

  const fonts = uploaded.filter((f): f is ManifestFont => f != null);
  // Sort alphabetically by family for the admin picker
  fonts.sort((a, b) => a.family.localeCompare(b.family, undefined, { sensitivity: 'base' }));

  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    sourceDir,
    count: fonts.length,
    cssUrl: `${B2_PUBLIC_URL}/${PREFIX}/fonts.css`,
    fonts,
  };

  const css = buildCss(fonts);
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
  console.log(`  Uploaded: ${fonts.length} / ${files.length}`);
  console.log(`  Manifest: ${manifestUrl}`);
  console.log(`  CSS:      ${cssUrl}`);
  console.log(`  Total CSS size: ${(Buffer.byteLength(css) / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
