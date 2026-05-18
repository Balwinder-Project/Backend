import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database';
import Category from '../models/category.model';
import SubCategory from '../models/subCategory.model';
import { generateSlug } from '../utils/slug';

dotenv.config();

/**
 * Hierarchical category structure to seed.
 * Edit this array to match your desired structure before running.
 */
const CATEGORY_TREE = [
  {
    name: 'Stickers',
    description: 'All types of stickers',
    children: [
      {
        name: 'Vehicle Stickers',
        description: 'Stickers for vehicles',
        children: [
          { name: 'Bike Stickers', description: 'Stickers for bikes' },
          { name: 'Car Stickers', description: 'Stickers for cars' },
          { name: 'Jeep Stickers', description: 'Stickers for jeeps' },
          { name: 'Tractor Stickers', description: 'Stickers for tractors' },
          { name: 'Bullet Bike', description: 'Stickers for bullet bikes' },
        ],
      },
      { name: 'Electronics Sticker', description: 'Stickers for electronics' },
      { name: 'Resin Dome Stickers', description: 'Resin dome stickers' },
      { name: 'Holographic Stickers', description: 'Holographic stickers' },
      { name: 'Other Applications', description: 'Stickers for other applications' },
    ],
  },
  {
    name: 'Name Plates',
    description: 'All types of name plates',
    children: [
      { name: 'Vehicle Fancy Name Plates', description: 'Fancy name plates for vehicles' },
      { name: 'House Name Plates', description: 'Name plates for houses' },
    ],
  },
];

interface SubCategoryNode {
  name: string;
  description?: string;
  children?: SubCategoryNode[];
}

async function createSubCategories(
  categoryId: string,
  nodes: SubCategoryNode[],
  parentId: string | null
) {
  for (const node of nodes) {
    const slug = generateSlug(node.name);
    const subCategory = await SubCategory.create({
      name: node.name,
      description: node.description || '',
      slug,
      category: categoryId,
      parent: parentId,
      isActive: true,
    });
    console.log(
      `  ${'  '.repeat(parentId ? 1 : 0)}+ SubCategory: ${node.name} (${subCategory._id})`
    );

    if (node.children?.length) {
      await createSubCategories(categoryId, node.children, subCategory._id.toString());
    }
  }
}

async function seedCategories() {
  const dryRun = process.argv.includes('--dry-run');

  await connectDatabase();

  if (dryRun) {
    console.log('=== DRY RUN — no changes will be made ===\n');
    const catCount = await Category.countDocuments();
    const subCatCount = await SubCategory.countDocuments();
    console.log(`Current data: ${catCount} categories, ${subCatCount} subcategories`);
    console.log('\nWould create:');
    for (const cat of CATEGORY_TREE) {
      console.log(`  Category: ${cat.name}`);
      const printChildren = (nodes: SubCategoryNode[], depth: number) => {
        for (const node of nodes) {
          console.log(`  ${'  '.repeat(depth)}SubCategory: ${node.name}`);
          if (node.children) printChildren(node.children, depth + 1);
        }
      };
      printChildren(cat.children || [], 1);
    }
    await disconnectDatabase();
    return;
  }

  // --- Delete existing data ---
  console.log('Deleting existing subcategories...');
  const deletedSubs = await SubCategory.deleteMany({});
  console.log(`  Deleted ${deletedSubs.deletedCount} subcategories`);

  console.log('Deleting existing categories...');
  const deletedCats = await Category.deleteMany({});
  console.log(`  Deleted ${deletedCats.deletedCount} categories`);

  // --- Create new data ---
  console.log('\nCreating categories and subcategories...\n');

  for (const catData of CATEGORY_TREE) {
    const slug = generateSlug(catData.name);
    const category = await Category.create({
      name: catData.name,
      description: catData.description || '',
      slug,
      isActive: true,
    });
    console.log(`Category: ${catData.name} (${category._id})`);

    if (catData.children?.length) {
      await createSubCategories(category._id.toString(), catData.children, null);
    }
  }

  // --- Verify ---
  const finalCatCount = await Category.countDocuments();
  const finalSubCatCount = await SubCategory.countDocuments();
  console.log(`\nDone! Created ${finalCatCount} categories and ${finalSubCatCount} subcategories.`);

  await disconnectDatabase();
}

seedCategories().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
