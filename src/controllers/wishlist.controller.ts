import { Request, Response } from 'express';
import { WishlistService } from '../services/wishlist.service';

/**
 * GET /api/v1/wishlist
 */
export const getWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await WishlistService.getItems(req.user!.uid);
    res.status(200).json({
      success: true,
      message: 'Wishlist fetched successfully',
      data: items,
    });
  } catch (error: any) {
    console.error('Get wishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch wishlist',
    });
  }
};

/**
 * GET /api/v1/wishlist/ids
 * Lightweight list of product IDs for heart-button state.
 */
export const getWishlistIds = async (req: Request, res: Response): Promise<void> => {
  try {
    const ids = await WishlistService.getProductIds(req.user!.uid);
    res.status(200).json({
      success: true,
      message: 'Wishlist IDs fetched successfully',
      data: ids,
    });
  } catch (error: any) {
    console.error('Get wishlist ids error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch wishlist IDs',
    });
  }
};

/**
 * POST /api/v1/wishlist
 */
export const addToWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await WishlistService.add(req.user!.uid, req.body.productId);
    res.status(201).json({
      success: true,
      message: 'Product added to wishlist',
      data: {
        id: (item as any).id || (item._id as any).toString(),
        productId: item.productId.toString(),
      },
    });
  } catch (error: any) {
    if (error.message === 'Product not found') {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    if (error.message === 'Product is not available') {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    console.error('Add to wishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add to wishlist',
    });
  }
};

/**
 * DELETE /api/v1/wishlist/:productId
 */
export const removeFromWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    await WishlistService.remove(req.user!.uid, req.params.productId);
    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
    });
  } catch (error: any) {
    if (error.message === 'Wishlist item not found') {
      res.status(404).json({ success: false, message: 'Wishlist item not found' });
      return;
    }
    console.error('Remove from wishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove from wishlist',
    });
  }
};
