import { Router } from 'express';
import { validationResult } from 'express-validator';
import CodOrderService from '../services/codOrder.service.js';
import { OrderStatus, DeliveryStatus, Country } from '../models/CodOrder.model.js';
import logger from '../../../../logger.js';
// Usar authenticate del módulo auth compartido
import { authenticate } from '../../auth/middlewares/auth.middleware.js';
import {
  createOrderValidation,
  updateDeliveryStatusValidation,
  cancelOrderValidation,
  orderIdValidation,
  listOrdersValidation,
  searchOrdersValidation
} from '../validators/codOrder.validator.js';

const router = Router();
const service = new CodOrderService();

// Middleware para manejar errores de validación
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   GET /cod-hub/enums/order-status
 * @desc    Obtener valores ENUM de order_status
 * @access  Public
 */
router.get('/enums/order-status', (req, res) => {
  res.json({
    success: true,
    data: Object.values(OrderStatus)
  });
});

/**
 * @route   GET /cod-hub/enums/delivery-status
 * @desc    Obtener valores ENUM de delivery_status
 * @access  Public
 */
router.get('/enums/delivery-status', (req, res) => {
  res.json({
    success: true,
    data: Object.values(DeliveryStatus)
  });
});

/**
 * @route   GET /cod-hub/enums/countries
 * @desc    Obtener valores ENUM de countries
 * @access  Public
 */
router.get('/enums/countries', (req, res) => {
  res.json({
    success: true,
    data: Object.values(Country)
  });
});

/**
 * @route   GET /cod-hub/enums
 * @desc    Obtener todos los ENUMs
 * @access  Public
 */
router.get('/enums', (req, res) => {
  res.json({
    success: true,
    data: {
      orderStatus: Object.values(OrderStatus),
      deliveryStatus: Object.values(DeliveryStatus),
      countries: Object.values(Country)
    }
  });
});

/**
 * @route   GET /cod-hub/orders
 * @desc    Listar órdenes con filtros
 * @access  Private
 */
router.get('/orders', listOrdersValidation, validate, async (req, res) => {
  try {
    const filters = {
      storeId: req.query.store_id,
      orderStatus: req.query.order_status,
      deliveryStatus: req.query.delivery_status,
      country: req.query.country,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sort_by || 'created_at',
      sortOrder: req.query.sort_order || 'DESC'
    };

    const result = await service.list(filters);
    
    res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`[CodOrderController] Error listing orders: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /cod-hub/orders/search
 * @desc    Buscar órdenes
 * @access  Private
 */
router.get('/orders/search', searchOrdersValidation, validate, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search term must be at least 2 characters'
      });
    }

    const filters = {
      storeId: req.query.store_id,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await service.search(q, filters);
    
    res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`[CodOrderController] Error searching orders: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /cod-hub/orders/stats
 * @desc    Obtener estadísticas
 * @access  Private
 */
router.get('/orders/stats', async (req, res) => {
  try {
    const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
    const stats = await service.getStatistics(storeId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`[CodOrderController] Error getting stats: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /cod-hub/orders/:id
 * @desc    Obtener orden por ID
 * @access  Private
 */
router.get('/orders/:id', orderIdValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await service.getById(id);
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    const statusCode = error.message === 'Order not found' ? 404 : 500;
    logger.error(`[CodOrderController] Error getting order: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /cod-hub/orders
 * @desc    Crear orden COD
 * @access  Private (webhook)
 */
router.post('/orders', createOrderValidation, validate, async (req, res) => {
  try {
    const result = await service.createFromWebhook(req.body);
    
    res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      data: result.order
    });
  } catch (error) {
    logger.error(`[CodOrderController] Error creating order: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /cod-hub/orders/:id/confirm
 * @desc    Confirmar orden
 * @access  Private (requiere autenticación)
 */
router.patch('/orders/:id/confirm', authenticate, orderIdValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    const order = await service.confirmOrder(id, userId);
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    const statusCode = error.message === 'Order not found' ? 404 : 400;
    logger.error(`[CodOrderController] Error confirming order: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /cod-hub/orders/:id/delivery-status
 * @desc    Actualizar estado de despacho
 * @access  Private (requiere autenticación)
 */
router.patch('/orders/:id/delivery-status', authenticate, updateDeliveryStatusValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_status } = req.body;
    const userId = req.user?.id;
    
    const order = await service.updateDeliveryStatus(id, delivery_status, userId);
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    const statusCode = error.message === 'Order not found' ? 404 : 400;
    logger.error(`[CodOrderController] Error updating delivery status: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /cod-hub/orders/:id/cancel
 * @desc    Cancelar orden
 * @access  Private (requiere autenticación)
 */
router.patch('/orders/:id/cancel', authenticate, cancelOrderValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    const { cancel_reason_id } = req.body;
    const userId = req.user?.id;
    
    const order = await service.cancelOrder(id, cancel_reason_id, userId);
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    const statusCode = error.message === 'Order not found' ? 404 : 400;
    logger.error(`[CodOrderController] Error cancelling order: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /cod-hub/orders/:id/deliver
 * @desc    Marcar como entregada
 * @access  Private (requiere autenticación)
 */
router.patch('/orders/:id/deliver', authenticate, orderIdValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    const order = await service.markAsDelivered(id, userId);
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    const statusCode = error.message === 'Order not found' ? 404 : 400;
    logger.error(`[CodOrderController] Error marking order as delivered: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
