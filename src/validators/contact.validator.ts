import { body } from 'express-validator';

export const contactFormValidator = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be 2–80 characters'),

  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email cannot exceed 100 characters'),

  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isString()
    .withMessage('Subject must be a string')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Subject cannot exceed 120 characters'),

  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be 10–1000 characters'),
];
