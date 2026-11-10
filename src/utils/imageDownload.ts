/**
 * Download a remote image (e.g. a Backblaze B2 public URL) into a Buffer.
 * Uses a timeout so one stalled image cannot hang the watermark backfill forever.
 */
export const downloadToBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status}) from ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
