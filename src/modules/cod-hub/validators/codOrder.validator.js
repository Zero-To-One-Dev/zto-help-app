import { body, param, query } from 'express-validator';
import { OrderStatus, DeliveryStatus, Country } from '../models/CodOrder.model.js';

export const createOrderValidation = [
  body('store_url')
    .notEmpty().withMessage('store_url is required')
    .isString().withMessage('store_url must be a string'),
  body('shopify_order_id').isInt().withMessage('shopify_order_id must be an integer'),
  body('order_name').notEmpty().withMessage('order_name is required'),
  body('customer_name').notEmpty().withMessage('customer_name is required'),
  body('address').notEmpty().withMessage('address is required'),
  body('city').notEmpty().withMessage('city is required'),
  body('country').isIn(Object.values(Country)).withMessage('Invalid country'),
  body('customer_phone').optional().isString(),
  body('customer_email').optional().isEmail().withMessage('Invalid email'),
  body('region').optional().isString()
];

export const updateDeliveryStatusValidation = [
  param('id').isInt().withMessage('Order ID must be an integer'),
  body('delivery_status')
    .isIn(Object.values(DeliveryStatus))
    .withMessage('Invalid delivery status')
];

export const cancelOrderValidation = [
  param('id').isInt().withMessage('Order ID must be an integer'),
  body('cancel_reason_id').isInt().withMessage('cancel_reason_id must be an integer')
];

export const orderIdValidation = [
  param('id').isInt().withMessage('Order ID must be an integer')
];

export const listOrdersValidation = [
  query('store_id').optional().isInt().withMessage('store_id must be an integer'),
  query('order_status').optional().isIn(Object.values(OrderStatus)).withMessage('Invalid order status'),
  query('delivery_status').optional().isIn(Object.values(DeliveryStatus)).withMessage('Invalid delivery status'),
  query('country').optional().isIn(Object.values(Country)).withMessage('Invalid country'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('sort_by').optional().isIn(['created_at', 'updated_at', 'order_name', 'customer_name']).withMessage('Invalid sort field'),
  query('sort_order').optional().isIn(['ASC', 'DESC']).withMessage('Invalid sort order')
];

export const searchOrdersValidation = [
  query('q').notEmpty().withMessage('Search term is required').isLength({ min: 2 }).withMessage('Search term must be at least 2 characters'),
  query('store_id').optional().isInt().withMessage('store_id must be an integer'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
];
