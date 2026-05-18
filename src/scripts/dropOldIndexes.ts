import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';

dotenv.config();

async function dropOldIndexes() {
  await connectDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not established');

  const productsCollection = db.collection('products');
  const subCategoriesCollection = db.collection('subcategories');

  // List current indexes for reference
  console.log('=== Current Products Indexes ===');
  const productIndexes = await productsCollection.indexes();
  productIndexes.forEach(idx => console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`));

  console.log('\n=== Current SubCategories Indexes ===');
  const subCatIndexes = await subCategoriesCollection.indexes();
  subCatIndexes.forEach(idx => console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`));

  // Drop old product index: { subCategory: 1 }
  console.log('\n--- Dropping old indexes ---');
  try {
    await productsCollection.dropIndex('subCategory_1');
    console.log('Dropped products index: subCategory_1');
  } catch (err: any) {
    if (err.codeName === 'IndexNotFound') {
      console.log('products index subCategory_1 already gone — skipping');
    } else {
      throw err;
    }
  }

  // Drop old subcategory index: { category: 1, name: 1 }
  try {
    await subCategoriesCollection.dropIndex('category_1_name_1');
    console.log('Dropped subcategories index: category_1_name_1');
  } catch (err: any) {
    if (err.codeName === 'IndexNotFound') {
      console.log('subcategories index category_1_name_1 already gone — skipping');
    } else {
      throw err;
    }
  }

  // Verify
  console.log('\n=== Updated Products Indexes ===');
  const newProductIndexes = await productsCollection.indexes();
  newProductIndexes.forEach(idx => console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`));

  console.log('\n=== Updated SubCategories Indexes ===');
  const newSubCatIndexes = await subCategoriesCollection.indexes();
  newSubCatIndexes.forEach(idx => console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`));

  console.log('\nDone!');
  await disconnectDatabase();
}

dropOldIndexes().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
