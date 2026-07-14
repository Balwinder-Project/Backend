/**
 * Seed the "Name Plates" category with its product subcategories.
 *
 * Idempotent: skips any subcategory that already exists (matched by slug within
 * the Name Plates category), so it is safe to re-run.
 *
 * Usage: npx ts-node src/scripts/seedNamePlateSubcategories.ts
 */
import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database';
import Category from '../models/category.model';
import SubCategory from '../models/subCategory.model';
import { generateSlug } from '../utils/slug';

const NAME_PLATE_SUBCATEGORIES = [
  'Cutout Name Plates',
  'Hanging Name Plates',
  'House Number Signs',
  'Photo Name Plates',
  'LED Name Plates',
  'Planter Name Plates',
  'Weather-proof Name Plates',
  'Metal Name Plates',
];

const run = async () => {
  await connectDatabase();

  const namePlateCategory = await Category.findOne({ slug: 'name-plates' });
  if (!namePlateCategory) {
    throw new Error('Category "name-plates" not found. Create the Name Plates category first.');
  }

  let created = 0;
  let skipped = 0;

  for (const name of NAME_PLATE_SUBCATEGORIES) {
    const slug = generateSlug(name);
    const exists = await SubCategory.findOne({ category: namePlateCategory._id, slug });
    if (exists) {
      skipped++;
      console.log(`  = exists: ${name}`);
      continue;
    }
    await SubCategory.create({
      name,
      slug,
      category: namePlateCategory._id,
      parent: null,
      isActive: true,
      isHolographic: false,
    });
    created++;
    console.log(`  ✓ created: ${name} (${slug})`);
  }

  console.log(`\nDone. created=${created} skipped=${skipped}`);
  await disconnectDatabase();
};

run().catch((error) => {
  console.error('Seeding name plate subcategories failed:', error);
  process.exit(1);
});
