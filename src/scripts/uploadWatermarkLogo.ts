import dotenv from 'dotenv';
import path from 'path';
import { readFile } from 'fs/promises';
import cloudinary from '../config/cloudinary';

dotenv.config();

const WATERMARK_PUBLIC_ID = 'balwinder/brand/logo-watermark';

const uploadWatermarkLogo = async (): Promise<void> => {
  const logoPath = path.resolve(__dirname, '../../../stickerprinting/public/logo2.png');
  const fileBuffer = await readFile(logoPath);
  const base64Image = `data:image/png;base64,${fileBuffer.toString('base64')}`;

  const result = await cloudinary.uploader.upload(base64Image, {
    public_id: WATERMARK_PUBLIC_ID,
    resource_type: 'image',
    overwrite: true,
  });

  console.log('Watermark logo uploaded successfully');
  console.log('Public ID:', result.public_id);
  console.log('URL:', result.secure_url);
};

uploadWatermarkLogo().catch((error) => {
  console.error('Failed to upload watermark logo:', error);
  process.exit(1);
});
