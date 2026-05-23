import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

export const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME!;
export const B2_PUBLIC_URL = process.env.B2_PUBLIC_URL!;

const B2_REGION = process.env.B2_BUCKET_REGION!;

export const s3Client = new S3Client({
  endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
  region: B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_APPLICATION_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
});

if (!process.env.B2_APPLICATION_KEY_ID || !process.env.B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
  console.warn('Warning: Backblaze B2 configuration is incomplete. Please set B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, and B2_BUCKET_NAME in .env');
} else {
  console.log('Backblaze B2 configured successfully');
}
