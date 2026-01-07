import { body, param } from 'express-validator';

export const createCancelReasonValidation = [
  body('reason')
    .notEmpty().withMessage('reason is required')
    .isString().withMessage('reason must be a string')
    .isLength({ min: 3, max: 255 }).withMessage('reason must be between 3 and 255 characters')
];

export const updateCancelReasonValidation = [
  param('id').isInt().withMessage('ID must be an integer'),
  body('reason')
    .optional()
    .isString().withMessage('reason must be a string')
    .isLength({ min: 3, max: 255 }).withMessage('reason must be between 3 and 255 characters')
];

export const cancelReasonIdValidation = [
  param('id').isInt().withMessage('ID must be an integer')
];
