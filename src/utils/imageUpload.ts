import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, B2_BUCKET_NAME, B2_PUBLIC_URL } from '../config/b2';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { applyWatermark } from './watermark';

/**
 * Upload image to Backblaze B2
 * Uploads three variants:
 *   - original       (file.webp)        served to admins
 *   - thumbnail      (file-thumb.webp)  400x400, for listings/cards
 *   - watermarked    (file-wm.webp)     served to the public on detail pages
 * @returns Public URL of the original image
 */
export const uploadImageToB2 = async (
  fileBuffer: Buffer,
  filename: string,
  folder: string = 'products'
): Promise<string> => {
  try {
    const baseName = filename.split('.')[0]
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 64);
    const key = `balwinder/${folder}/${randomUUID()}-${baseName}`;

    // Process original: convert to webp with auto quality
    const originalBuffer = await sharp(fileBuffer)
      .webp({ quality: 80 })
      .toBuffer();

    // Process thumbnail: 400x400 cover crop, lower quality
    const thumbBuffer = await sharp(fileBuffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 60 })
      .toBuffer();

    const uploads = [
      s3Client.send(new PutObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: `${key}.webp`,
        Body: originalBuffer,
        ContentType: 'image/webp',
      })),
      s3Client.send(new PutObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: `${key}-thumb.webp`,
        Body: thumbBuffer,
        ContentType: 'image/webp',
      })),
    ];

    // Watermarked variant — skipped for mockup scenes (marketing assets) and
    // design-request references (private admin-only creative assets).
    const skipWatermark =
      folder.startsWith('mockups') || folder.startsWith('design-requests');
    if (!skipWatermark) {
      const watermarkedBuffer = await applyWatermark(fileBuffer);
      uploads.push(
        s3Client.send(new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: `${key}-wm.webp`,
          Body: watermarkedBuffer,
          ContentType: 'image/webp',
        }))
      );
    }

    await Promise.all(uploads);

    return `${B2_PUBLIC_URL}/${key}.webp`;
  } catch (error) {
    console.error('Error uploading image to B2:', error);
    throw new Error('Failed to upload image');
  }
};

/**
 * Upload multiple images to B2
 */
export const uploadMultipleImages = async (
  files: Array<{ buffer: Buffer; filename: string }>,
  folder: string = 'products'
): Promise<string[]> => {
  try {
    const uploadPromises = files.map((file) =>
      uploadImageToB2(file.buffer, file.filename, folder)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw new Error('Failed to upload images');
  }
};

/**
 * Extract the B2 object key from a public URL
 */
function getKeyFromUrl(imageUrl: string): string | null {
  if (!B2_PUBLIC_URL || !imageUrl.startsWith(B2_PUBLIC_URL)) return null;
  return imageUrl.slice(B2_PUBLIC_URL.length + 1); // +1 for the trailing slash
}

/**
 * Delete image from B2 (deletes both original and thumbnail)
 */
export const deleteImageFromB2 = async (imageUrl: string): Promise<void> => {
  try {
    const key = getKeyFromUrl(imageUrl);
    if (!key) {
      console.warn('Invalid B2 URL format:', imageUrl);
      return;
    }

    // Derive sibling variant keys: file.webp -> file-thumb.webp / file-wm.webp
    const thumbKey = key.replace(/\.webp$/, '-thumb.webp');
    const watermarkKey = key.replace(/\.webp$/, '-wm.webp');

    await Promise.all([
      s3Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: key })),
      s3Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: thumbKey })),
      s3Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: watermarkKey })),
    ]);
  } catch (error) {
    console.error('Error deleting image from B2:', error);
  }
};

/**
 * Delete multiple images from B2
 */
export const deleteMultipleImages = async (imageUrls: string[]): Promise<void> => {
  try {
    await Promise.all(imageUrls.map((url) => deleteImageFromB2(url)));
  } catch (error) {
    console.error('Error deleting multiple images:', error);
  }
};
