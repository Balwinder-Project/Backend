import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { isMagickAvailable } from '../utils/magick';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/** Read the installed ImageMagick version string (empty if not found). */
const magickVersion = (): Promise<string> =>
  new Promise((resolve) => {
    for (const bin of ['magick', 'convert']) {
      try {
        const child = spawn(bin, ['-version']);
        let out = '';
        child.stdout.on('data', (c) => (out += c.toString()));
        child.on('error', () => resolve(''));
        child.on('close', () => resolve(out.split('\n')[0] || ''));
        return;
      } catch {
        /* try next binary */
      }
    }
    resolve('');
  });

/**
 * Diagnostics: is the ImageMagick CLI available? Perspective/curved mockups
 * need it (flat mockups do not). Hit /health/magick in the browser to check.
 */
router.get('/magick', async (_req: Request, res: Response) => {
  const available = await isMagickAvailable();
  res.json({
    success: true,
    imagemagick: {
      available,
      version: available ? await magickVersion() : null,
      note: available
        ? 'Perspective & curved mockups can render.'
        : 'Not installed — only flat mockups will render. Ensure aptPkgs=["imagemagick"] is in nixpacks.toml and redeploy.',
    },
  });
});

export default router;
