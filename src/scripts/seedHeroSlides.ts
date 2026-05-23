import dotenv from 'dotenv';
import path from 'path';
import { readFile } from 'fs/promises';
import { connectDatabase, disconnectDatabase } from '../config/database';
import HeroSlide from '../models/heroSlide.model';
import { uploadImageToB2 } from '../utils/imageUpload';

dotenv.config();

const heroSlides = [
  {
    title: 'Name Plates',
    description:
      'Make a lasting impression with premium quality nameplates. Whether for your home, office, or business, we provide beautifully crafted designs that add a touch of sophistication and professional appeal.',
    buttonText: 'Order Now',
    buttonLink: '/shop',
    imageFilename: 'heroNameplate.png',
    position: 1,
  },
  {
    title: 'Premium Stickers',
    description:
      'Bring your brand to life with vibrant, durable custom stickers. From product labels to promotional decals, we offer weather-resistant prints that stick and stay, making your message pop.',
    buttonText: 'Shop Stickers',
    buttonLink: '/shop',
    imageFilename: 'hero_sticker.png',
    position: 2,
  },
  {
    title: '3D Led Letter',
    description:
      'Enhance your brand visibility with premium 3D LED letters. Designed with high-quality materials and bright illumination, perfect for shops, showrooms, offices, and outdoor signage. Durable, weather-resistant, and crafted to attract attention day and night.',
    buttonText: 'Explore LED Letters',
    buttonLink: '/shop',
    imageFilename: 'heroLed.png',
    position: 3,
  },
];

const getUploadedImageUrl = async (imageFilename: string): Promise<string> => {
  const existing = await HeroSlide.findOne({
    imageUrl: /^https:\/\/f\d+\.backblazeb2\.com\//,
    title: heroSlides.find((slide) => slide.imageFilename === imageFilename)?.title,
  });

  if (existing?.imageUrl) {
    return existing.imageUrl;
  }

  const imagePath = path.resolve(__dirname, '../../../stickerprinting/public/hero', imageFilename);
  const fileBuffer = await readFile(imagePath);
  return uploadImageToB2(fileBuffer, imageFilename, 'hero-slides');
};

const seedHeroSlides = async (): Promise<void> => {
  await connectDatabase();

  try {
    for (const slide of heroSlides) {
      const imageUrl = await getUploadedImageUrl(slide.imageFilename);
      await HeroSlide.findOneAndUpdate(
        { title: slide.title },
        {
          title: slide.title,
          description: slide.description,
          buttonText: slide.buttonText,
          buttonLink: slide.buttonLink,
          imageUrl,
          position: slide.position,
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    console.log(`Seeded ${heroSlides.length} hero slide(s)`);
  } finally {
    await disconnectDatabase();
  }
};

seedHeroSlides().catch((error) => {
  console.error('Failed to seed hero slides:', error);
  disconnectDatabase().finally(() => process.exit(1));
});
