import { body, param, query } from 'express-validator';

export const createDesignRequestValidator = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be 2–80 characters'),

  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isString()
    .withMessage('Subject must be a string')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Subject cannot exceed 120 characters'),

  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email cannot exceed 100 characters'),

  body('phone')
    .notEmpty()
    .withMessage('Phone is required')
    .matches(/^[+]?\d{10,15}$/)
    .withMessage('Phone must be 10–15 digits (optionally prefixed with +)'),

  body('requirements')
    .notEmpty()
    .withMessage('Requirements are required')
    .isString()
    .withMessage('Requirements must be a string')
    .trim()
    .isLength({ min: 20, max: 1000 })
    .withMessage('Requirements must be 20–1000 characters'),
];

export const updateDesignRequestValidator = [
  param('id').isMongoId().withMessage('Invalid design request id'),

  body('status')
    .optional()
    .isIn(['new', 'in_review', 'contacted', 'completed', 'cancelled'])
    .withMessage('Invalid status'),

  body('adminNotes')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Admin notes must be a string')
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Admin notes cannot exceed 2000 characters'),
];

export const listDesignRequestsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('status')
    .optional({ checkFalsy: true })
    .isIn(['new', 'in_review', 'contacted', 'completed', 'cancelled'])
    .withMessage('Invalid status filter'),
  query('search')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search cannot exceed 100 characters'),
];

export const designRequestIdValidator = [
  param('id').isMongoId().withMessage('Invalid design request id'),
];
