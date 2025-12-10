import { body } from 'express-validator';

export const googleSignInValidator = [
  body('firebaseUid')
    .notEmpty()
    .withMessage('Firebase UID is required')
    .isString()
    .withMessage('Firebase UID must be a string'),
  
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('profilePicture')
    .optional()
    .isURL()
    .withMessage('Profile picture must be a valid URL')
];

export const updateUserValidator = [
  body('name')
    .optional()
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('profilePicture')
    .optional()
    .isURL()
    .withMessage('Profile picture must be a valid URL')
];


