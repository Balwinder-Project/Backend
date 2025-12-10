import { body } from 'express-validator';

export const topUpWalletValidator = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number greater than 0'),
  
  body('description')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Description must be a string')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Description must be between 3 and 500 characters'),
  
  body('performedBy')
    .optional()
    .isString()
    .withMessage('Performed by must be a string'),
  
  body('performedByType')
    .optional()
    .isIn(['admin', 'user', 'retailer'])
    .withMessage('Performed by type must be admin, user, or retailer'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

export const deductWalletValidator = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number greater than 0'),
  
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isString()
    .withMessage('Description must be a string')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Description must be between 3 and 500 characters'),
  
  body('performedBy')
    .optional()
    .isString()
    .withMessage('Performed by must be a string'),
  
  body('performedByType')
    .optional()
    .isIn(['admin', 'user', 'retailer'])
    .withMessage('Performed by type must be admin, user, or retailer'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

