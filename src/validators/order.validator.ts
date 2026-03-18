import { body } from 'express-validator';

export const shippingRatesValidator = [
  body('deliveryPincode')
    .notEmpty().withMessage('Delivery pincode is required')
    .matches(/^\d{6}$/).withMessage('Delivery pincode must be exactly 6 digits'),

  body('items')
    .isArray({ min: 1 }).withMessage('Items must be a non-empty array'),

  body('items.*.productId')
    .notEmpty().withMessage('Product ID is required')
    .isMongoId().withMessage('Product ID must be a valid ID'),

  body('items.*.quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

const addressFields = (prefix: string) => [
  body(`${prefix}.name`).notEmpty().withMessage(`${prefix} name is required`),
  body(`${prefix}.phone`).notEmpty().withMessage(`${prefix} phone is required`).matches(/^\d{10}$/).withMessage(`${prefix} phone must be 10 digits`),
  body(`${prefix}.addressLine1`).notEmpty().withMessage(`${prefix} address line 1 is required`),
  body(`${prefix}.city`).notEmpty().withMessage(`${prefix} city is required`),
  body(`${prefix}.state`).notEmpty().withMessage(`${prefix} state is required`),
  body(`${prefix}.pincode`).notEmpty().withMessage(`${prefix} pincode is required`).matches(/^\d{6}$/).withMessage(`${prefix} pincode must be 6 digits`),
];

export const createOrderValidator = [
  body('items')
    .isArray({ min: 1 }).withMessage('Items must be a non-empty array'),

  body('items.*.productId')
    .notEmpty().withMessage('Product ID is required')
    .isMongoId().withMessage('Product ID must be a valid ID'),

  body('items.*.quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),

  body('items.*.price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be non-negative'),

  ...addressFields('shippingAddress'),
  ...addressFields('billingAddress'),

  body('shippingCharge')
    .notEmpty().withMessage('Shipping charge is required')
    .isFloat({ min: 0 }).withMessage('Shipping charge must be non-negative'),
];
