import { body, param } from 'express-validator';

export const addWishlistValidator = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID'),
];

export const wishlistProductIdValidator = [
  param('productId').isMongoId().withMessage('Invalid product ID'),
];
