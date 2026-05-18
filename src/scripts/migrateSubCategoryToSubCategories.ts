import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  await connectDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not established');

  const productsCollection = db.collection('products');
  const subCategoriesCollection = db.collection('subcategories');

  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===');

  // Step 1: Add parent: null to all subcategories that don't have it
  const subCatsWithoutParent = await subCategoriesCollection.countDocuments({
    parent: { $exists: false },
  });
  console.log(`SubCategories missing 'parent' field: ${subCatsWithoutParent}`);

  if (!DRY_RUN && subCatsWithoutParent > 0) {
    const result = await subCategoriesCollection.updateMany(
      { parent: { $exists: false } },
      { $set: { parent: null } }
    );
    console.log(`  Updated ${result.modifiedCount} subcategories with parent: null`);
  }

  // Step 2: Migrate products with non-null subCategory to subCategories array
  const withSubCategory = await productsCollection.countDocuments({
    subCategory: { $ne: null, $exists: true },
  });
  console.log(`Products with non-null subCategory: ${withSubCategory}`);

  if (!DRY_RUN && withSubCategory > 0) {
    const result = await productsCollection.updateMany(
      { subCategory: { $ne: null, $exists: true } },
      [
        { $set: { subCategories: ['$subCategory'] } },
        { $unset: 'subCategory' },
      ]
    );
    console.log(`  Migrated ${result.modifiedCount} products (subCategory -> subCategories array)`);
  }

  // Step 3: Migrate products with null/missing subCategory to empty subCategories array
  const withoutSubCategory = await productsCollection.countDocuments({
    $or: [
      { subCategory: null },
      { subCategory: { $exists: false } },
    ],
    subCategories: { $exists: false },
  });
  console.log(`Products with null/missing subCategory: ${withoutSubCategory}`);

  if (!DRY_RUN && withoutSubCategory > 0) {
    const result = await productsCollection.updateMany(
      {
        $or: [
          { subCategory: null },
          { subCategory: { $exists: false } },
        ],
        subCategories: { $exists: false },
      },
      { $set: { subCategories: [] }, $unset: { subCategory: '' } }
    );
    console.log(`  Migrated ${result.modifiedCount} products (null subCategory -> empty subCategories)`);
  }

  // Step 4: Clean up any remaining subCategory fields
  if (!DRY_RUN) {
    const remaining = await productsCollection.countDocuments({ subCategory: { $exists: true } });
    if (remaining > 0) {
      const result = await productsCollection.updateMany(
        { subCategory: { $exists: true } },
        { $unset: { subCategory: '' } }
      );
      console.log(`  Cleaned up ${result.modifiedCount} remaining subCategory fields`);
    }
  }

  // Verification
  console.log('\n=== Verification ===');
  const totalProducts = await productsCollection.countDocuments();
  const productsWithOldField = await productsCollection.countDocuments({ subCategory: { $exists: true } });
  const productsWithNewField = await productsCollection.countDocuments({ subCategories: { $exists: true } });
  const productsWithNonEmptySubCats = await productsCollection.countDocuments({
    subCategories: { $exists: true, $ne: [] },
  });

  console.log(`Total products: ${totalProducts}`);
  console.log(`Products still with old 'subCategory' field: ${productsWithOldField}`);
  console.log(`Products with new 'subCategories' field: ${productsWithNewField}`);
  console.log(`Products with non-empty subCategories: ${productsWithNonEmptySubCats}`);

  const totalSubCats = await subCategoriesCollection.countDocuments();
  const subCatsWithParent = await subCategoriesCollection.countDocuments({ parent: { $exists: true } });
  console.log(`Total subcategories: ${totalSubCats}`);
  console.log(`Subcategories with 'parent' field: ${subCatsWithParent}`);

  if (DRY_RUN) {
    console.log('\n(No changes were made — dry run)');
  } else {
    console.log('\nMigration complete!');
  }

  await disconnectDatabase();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
