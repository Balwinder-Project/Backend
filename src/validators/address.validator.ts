import { body } from 'express-validator';

export const createAddressValidator = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isString().withMessage('Name must be a string')
    .trim(),

  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\d{10}$/).withMessage('Phone must be exactly 10 digits'),

  body('addressLine1')
    .notEmpty().withMessage('Address line 1 is required')
    .isString().withMessage('Address line 1 must be a string')
    .trim(),

  body('addressLine2')
    .optional({ checkFalsy: true })
    .isString().withMessage('Address line 2 must be a string')
    .trim(),

  body('city')
    .notEmpty().withMessage('City is required')
    .isString().withMessage('City must be a string')
    .trim(),

  body('state')
    .notEmpty().withMessage('State is required')
    .isString().withMessage('State must be a string')
    .trim(),

  body('pincode')
    .notEmpty().withMessage('Pincode is required')
    .matches(/^\d{6}$/).withMessage('Pincode must be exactly 6 digits'),

  body('country')
    .optional({ checkFalsy: true })
    .isString().withMessage('Country must be a string')
    .trim(),

  body('type')
    .optional()
    .isIn(['home', 'office', 'other']).withMessage('Type must be home, office, or other'),

  body('isDefault')
    .optional()
    .isBoolean().withMessage('isDefault must be a boolean'),
];

export const updateAddressValidator = [
  body('name')
    .optional()
    .isString().withMessage('Name must be a string')
    .trim(),

  body('phone')
    .optional()
    .matches(/^\d{10}$/).withMessage('Phone must be exactly 10 digits'),

  body('addressLine1')
    .optional()
    .isString().withMessage('Address line 1 must be a string')
    .trim(),

  body('addressLine2')
    .optional({ checkFalsy: true })
    .isString().withMessage('Address line 2 must be a string')
    .trim(),

  body('city')
    .optional()
    .isString().withMessage('City must be a string')
    .trim(),

  body('state')
    .optional()
    .isString().withMessage('State must be a string')
    .trim(),

  body('pincode')
    .optional()
    .matches(/^\d{6}$/).withMessage('Pincode must be exactly 6 digits'),

  body('country')
    .optional({ checkFalsy: true })
    .isString().withMessage('Country must be a string')
    .trim(),

  body('type')
    .optional()
    .isIn(['home', 'office', 'other']).withMessage('Type must be home, office, or other'),

  body('isDefault')
    .optional()
    .isBoolean().withMessage('isDefault must be a boolean'),
];
