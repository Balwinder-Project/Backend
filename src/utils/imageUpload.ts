import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, B2_BUCKET_NAME, B2_PUBLIC_URL } from '../config/b2';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { applyWatermark } from './watermark';

export const uploadImageToB2 = async (
  fileBuffer: Buffer,
  filename: string,
  folder: string = 'products'
): Promise<string> => {
  try {
    if (!B2_BUCKET_NAME || !B2_PUBLIC_URL) throw new Error('Backblaze B2 configuration is incomplete');
    const baseName = filename.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').substring(0, 64);
    const key = `balwinder/${folder}/${randomUUID()}-${baseName}`;
    const originalBuffer = await sharp(fileBuffer).webp({ quality: 80 }).toBuffer();
    const thumbBuffer = await sharp(fileBuffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 60 }).toBuffer();
    const uploads = [
      s3Client.send(new PutObjectCommand({ Bucket: B2_BUCKET_NAME, Key: `${key}.webp`, Body: originalBuffer, ContentType: 'image/webp' })),
      s3Client.send(new PutObjectCommand({ Bucket: B2_BUCKET_NAME, Key: `${key}-thumb.webp`, Body: thumbBuffer, ContentType: 'image/webp' })),
    ];

    // Name Plate finish/design assets must remain clean. Do not add the public watermark.
    const skipWatermark = folder.startsWith('mockups') || folder.startsWith('design-requests') || folder.startsWith('name-plates/');
    if (!skipWatermark) {
      const watermarkedBuffer = await applyWatermark(fileBuffer);
      uploads.push(s3Client.send(new PutObjectCommand({
        Bucket: B2_BUCKET_NAME, Key: `${key}-wm.webp`, Body: watermarkedBuffer, ContentType: 'image/webp',
      })));
    }
    await Promise.all(uploads);
    return `${B2_PUBLIC_URL}/${key}.webp`;
  } catch (error) {
    console.error('Error uploading image to B2:', error);
    throw error instanceof Error ? error : new Error('Failed to upload image');
  }
};

export const uploadMultipleImages = async (
  files: Array<{ buffer: Buffer; filename: string }>,
  folder: string = 'products'
): Promise<string[]> => {
  try { return await Promise.all(files.map((file) => uploadImageToB2(file.buffer, file.filename, folder))); }
  catch (error) { console.error('Error uploading multiple images:', error); throw error instanceof Error ? error : new Error('Failed to upload images'); }
};

function getKeyFromUrl(imageUrl: string): string | null {
  if (!B2_PUBLIC_URL || !imageUrl.startsWith(B2_PUBLIC_URL)) return null;
  return imageUrl.slice(B2_PUBLIC_URL.length + 1);
}

export const deleteImageFromB2 = async (imageUrl: string): Promise<void> => {
  try {
    const key = getKeyFromUrl(imageUrl);
    if (!key) return;
    const thumbKey = key.replace(/\.webp$/, '-thumb.webp');
    const watermarkKey = key.replace(/\.webp$/, '-wm.webp');
    await Promise.all([
      s3Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: key })),
      s3Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: thumbKey })),
      s3Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: watermarkKey })),
    ]);
  } catch (error) { console.error('Error deleting image from B2:', error); }
};

export const deleteMultipleImages = async (imageUrls: string[]): Promise<void> => {
  try { await Promise.all(imageUrls.map((url) => deleteImageFromB2(url))); }
  catch (error) { console.error('Error deleting multiple images:', error); }
};
