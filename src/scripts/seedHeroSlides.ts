import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database';
import HeroSlide from '../models/heroSlide.model';

dotenv.config();

const heroSlides = [
  {
    title: 'Name Plates',
    description:
      'Make a lasting impression with premium quality nameplates. Whether for your home, office, or business, we provide beautifully crafted designs that add a touch of sophistication and professional appeal.',
    buttonText: 'Order Now',
    buttonLink: '/shop',
    imageUrl: '/hero/heroNameplate.png',
    position: 1,
  },
  {
    title: 'Premium Stickers',
    description:
      'Bring your brand to life with vibrant, durable custom stickers. From product labels to promotional decals, we offer weather-resistant prints that stick and stay, making your message pop.',
    buttonText: 'Shop Stickers',
    buttonLink: '/shop',
    imageUrl: '/hero/hero_sticker.png',
    position: 2,
  },
  {
    title: '3D Led Letter',
    description:
      'Enhance your brand visibility with premium 3D LED letters. Designed with high-quality materials and bright illumination, perfect for shops, showrooms, offices, and outdoor signage. Durable, weather-resistant, and crafted to attract attention day and night.',
    buttonText: 'Explore LED Letters',
    buttonLink: '/shop',
    imageUrl: '/hero/heroLed.png',
    position: 3,
  },
];

const seedHeroSlides = async (): Promise<void> => {
  await connectDatabase();

  try {
    for (const slide of heroSlides) {
      await HeroSlide.findOneAndUpdate(
        { title: slide.title },
        { $setOnInsert: slide },
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
