import { Request, Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, B2_BUCKET_NAME, B2_PUBLIC_URL } from '../config/b2';

const FONTS_PREFIX = 'balwinder/fonts';

async function streamB2Object(
  key: string,
  res: Response,
  contentTypeFallback: string
): Promise<void> {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
    })
  );

  const contentType = result.ContentType || contentTypeFallback;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  // Explicit CORS for font/CSS consumers (helmet/cors middleware also applies)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (result.ContentLength != null) {
    res.setHeader('Content-Length', String(result.ContentLength));
  }

  const body = result.Body;
  if (!body) {
    res.status(404).json({ success: false, message: 'Empty object body' });
    return;
  }

  // AWS SDK v3 Body is a Readable stream in Node
  const stream = body as NodeJS.ReadableStream;
  stream.on('error', (err) => {
    console.error('Font stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to stream font' });
    } else {
      res.destroy(err as Error);
    }
  });
  stream.pipe(res);
}

/**
 * GET /api/v1/fonts
 * Public list of custom fonts (from B2 manifest), with same-origin file URLs for CORS-safe loading.
 */
export const listFonts = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: `${FONTS_PREFIX}/manifest.json`,
      })
    );
    const raw = await result.Body?.transformToString('utf-8');
    if (!raw) {
      res.status(404).json({ success: false, message: 'Font manifest not found' });
      return;
    }

    const manifest = JSON.parse(raw) as {
      version: number;
      generatedAt?: string;
      cssUrl?: string;
      fonts: Array<{ id: string; family: string; url: string; format: string; key?: string }>;
    };

    // Prefer public API base (fixes https behind proxies / mixed-content)
    const publicBase =
      (process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || '').replace(
        /\/$/,
        ''
      );
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    const base =
      publicBase && publicBase.includes('/fonts')
        ? publicBase
        : publicBase
          ? `${publicBase}/fonts`
          : `${proto}://${host}/api/v1/fonts`;
    const fonts = (manifest.fonts || []).map((f) => ({
      id: f.id,
      family: f.family,
      format: f.format,
      url: `${base}/file/${encodeURIComponent(f.id)}`,
    }));

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      success: true,
      data: {
        version: manifest.version,
        generatedAt: manifest.generatedAt,
        cssUrl: `${base}/css`,
        fonts,
        // Keep B2 originals for debugging / direct use when CORS is fixed
        b2CssUrl: manifest.cssUrl || `${B2_PUBLIC_URL}/${FONTS_PREFIX}/fonts.css`,
        b2ManifestUrl: `${B2_PUBLIC_URL}/${FONTS_PREFIX}/manifest.json`,
      },
    });
  } catch (error: any) {
    console.error('listFonts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load font catalog',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/v1/fonts/css
 * Public @font-face stylesheet; font URLs point at this API's /file/:id routes.
 */
export const getFontsCss = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: `${FONTS_PREFIX}/manifest.json`,
      })
    );
    const raw = await result.Body?.transformToString('utf-8');
    if (!raw) {
      res.status(404).type('text/plain').send('/* font manifest missing */');
      return;
    }

    const manifest = JSON.parse(raw) as {
      fonts: Array<{ id: string; family: string; format: string }>;
    };

    const publicBase =
      (process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || '').replace(
        /\/$/,
        ''
      );
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    const base =
      publicBase && publicBase.includes('/fonts')
        ? publicBase
        : publicBase
          ? `${publicBase}/fonts`
          : `${proto}://${host}/api/v1/fonts`;

    const css = (manifest.fonts || [])
      .map((f) => {
        const family = String(f.family).replace(/'/g, "\\'");
        const url = `${base}/file/${encodeURIComponent(f.id)}`;
        return [
          `@font-face {`,
          `  font-family: '${family}';`,
          `  src: url('${url}') format('${f.format || 'truetype'}');`,
          `  font-style: normal;`,
          `  font-weight: 100 900;`,
          `  font-display: swap;`,
          `}`,
        ].join('\n');
      })
      .join('\n\n');

    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(
      `/* BnD custom fonts — proxied for CORS-safe loading */\n${css}\n`
    );
  } catch (error: any) {
    console.error('getFontsCss error:', error);
    res.status(500).type('text/plain').send('/* failed to build font css */');
  }
};

/**
 * GET /api/v1/fonts/file/:id
 * Stream a font file from B2 with CORS headers.
 */
export const getFontFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Invalid font id' });
      return;
    }

    // Resolve extension from manifest
    const manifestResult = await s3Client.send(
      new GetObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: `${FONTS_PREFIX}/manifest.json`,
      })
    );
    const raw = await manifestResult.Body?.transformToString('utf-8');
    if (!raw) {
      res.status(404).json({ success: false, message: 'Font catalog missing' });
      return;
    }
    const manifest = JSON.parse(raw) as {
      fonts: Array<{ id: string; key?: string; format?: string }>;
    };
    const entry = (manifest.fonts || []).find((f) => f.id === id);
    if (!entry?.key) {
      // Fallback: try common extensions
      for (const ext of ['.ttf', '.otf', '.woff2', '.woff']) {
        try {
          await streamB2Object(`${FONTS_PREFIX}/${id}${ext}`, res, 'font/ttf');
          return;
        } catch {
          // try next
        }
      }
      res.status(404).json({ success: false, message: 'Font not found' });
      return;
    }

    const ext = entry.key.includes('.') ? entry.key.slice(entry.key.lastIndexOf('.')) : '.ttf';
    const fallbackType =
      ext === '.otf' ? 'font/otf' : ext === '.woff2' ? 'font/woff2' : 'font/ttf';
    await streamB2Object(entry.key, res, fallbackType);
  } catch (error: any) {
    console.error('getFontFile error:', error);
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        message: 'Font file not found',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
};
