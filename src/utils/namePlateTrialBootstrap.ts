import Category from '../models/category.model';
import SubCategory from '../models/subCategory.model';

/**
 * Preview-only bootstrap for the isolated nameplate_test database.
 * Production databases are never touched by this helper.
 */
export const bootstrapNamePlateTrialData = async (): Promise<void> => {
  if (process.env.MONGODB_DB_NAME !== 'nameplate_test') return;

  const category = await Category.findOneAndUpdate(
    { slug: 'name-plates' },
    {
      $setOnInsert: {
        name: 'Name Plates',
        slug: 'name-plates',
        isActive: true,
        fieldTemplate: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await SubCategory.findOneAndUpdate(
    { category: category._id, slug: 'metal-name-plates' },
    {
      $setOnInsert: {
        name: 'Metal Name Plates',
        slug: 'metal-name-plates',
        category: category._id,
        parent: null,
        isActive: true,
        isHolographic: false,
        showOnHomepage: false,
        fieldTemplate: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log('🧪 Name Plate trial hierarchy ready in isolated nameplate_test database');
};
