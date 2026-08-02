import WishlistItem, { IWishlistItem } from '../models/wishlist.model';
import Product from '../models/product.model';
import { transformProductImages } from '../utils/imageTransform';

export class WishlistService {
  static async getItems(firebaseUid: string): Promise<any[]> {
    const items = await WishlistItem.find({ firebaseUid })
      .sort({ createdAt: -1 })
      .populate({
        path: 'productId',
        select:
          'name description price sku images isActive isFeatured category subCategories tags stock normalUserPricing retailerPricing weight length breadth height customFields',
        populate: [
          { path: 'category', select: 'name slug' },
          { path: 'subCategories', select: 'name slug' },
          { path: 'tags', select: 'name' },
        ],
      });

    return items
      .map((item) => {
        const product = item.productId as any;
        if (!product || typeof product !== 'object' || !product._id) {
          return null;
        }

        // Skip inactive products from customer view
        if (product.isActive === false) {
          return null;
        }

        const obj = product.toJSON ? product.toJSON() : product;
        obj.images = transformProductImages(obj.images || [], 'thumbnail');
        // Strip special retailer pricing from public wishlist responses
        delete obj.retailerSpecialPricing;

        return {
          id: (item._id as any).toString(),
          productId: obj.id || obj._id?.toString(),
          product: obj,
          createdAt: item.createdAt,
        };
      })
      .filter(Boolean);
  }

  static async getProductIds(firebaseUid: string): Promise<string[]> {
    const items = await WishlistItem.find({ firebaseUid }).select('productId');
    return items.map((i) => i.productId.toString());
  }

  static async add(firebaseUid: string, productId: string): Promise<IWishlistItem> {
    const product = await Product.findById(productId).select('_id isActive');
    if (!product) {
      throw new Error('Product not found');
    }
    if (!product.isActive) {
      throw new Error('Product is not available');
    }

    try {
      const [item] = await WishlistItem.create([{ firebaseUid, productId }]);
      return item;
    } catch (error: any) {
      // Duplicate key — already wishlisted; return existing
      if (error?.code === 11000) {
        const existing = await WishlistItem.findOne({ firebaseUid, productId });
        if (existing) return existing;
      }
      throw error;
    }
  }

  static async remove(firebaseUid: string, productId: string): Promise<void> {
    const result = await WishlistItem.findOneAndDelete({ firebaseUid, productId });
    if (!result) {
      throw new Error('Wishlist item not found');
    }
  }

  static async isWishlisted(firebaseUid: string, productId: string): Promise<boolean> {
    const count = await WishlistItem.countDocuments({ firebaseUid, productId });
    return count > 0;
  }
}
