/**
 * Download a remote image (e.g. a Backblaze B2 public URL) into a Buffer.
 * Uses the global fetch available in Node 18+.
 */
export const downloadToBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status}) from ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
