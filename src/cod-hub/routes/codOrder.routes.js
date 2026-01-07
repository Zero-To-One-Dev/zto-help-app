import { Router } from 'express';
import { validationResult } from 'express-validator';
import CodOrderController from '../controllers/codOrder.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  createOrderValidation,
  updateDeliveryStatusValidation,
  cancelOrderValidation,
  orderIdValidation,
  listOrdersValidation,
  searchOrdersValidation
} from '../validators/codOrder.validator.js';

const router = Router();
const controller = new CodOrderController();

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
 * @route   GET /cod-hub/orders
 * @desc    Listar órdenes con filtros
 * @access  Private
 */
router.get('/orders', listOrdersValidation, validate, (req, res) => 
  controller.list(req, res)
);

/**
 * @route   GET /cod-hub/orders/search
 * @desc    Buscar órdenes
 * @access  Private
 */
router.get('/orders/search', searchOrdersValidation, validate, (req, res) => 
  controller.search(req, res)
);

/**
 * @route   GET /cod-hub/orders/stats
 * @desc    Obtener estadísticas
 * @access  Private
 */
router.get('/orders/stats', (req, res) => 
  controller.getStats(req, res)
);

/**
 * @route   GET /cod-hub/orders/:id
 * @desc    Obtener orden por ID
 * @access  Private
 */
router.get('/orders/:id', orderIdValidation, validate, (req, res) => 
  controller.getById(req, res)
);

/**
 * @route   POST /cod-hub/orders
 * @desc    Crear orden COD
 * @access  Private (webhook)
 */
router.post('/orders', createOrderValidation, validate, (req, res) => 
  controller.create(req, res)
);

/**
 * @route   PATCH /cod-hub/orders/:id/confirm
 * @desc    Confirmar orden
 * @access  Private (requiere autenticación)
 */
router.patch('/orders/:id/confirm', authenticate, orderIdValidation, validate, (req, res) => 
  controller.confirm(req, res)
);

/**
 * @route   PATCH /cod-hub/orders/:id/delivery-status
 * @desc    Actualizar estado de despacho
 * @access  Private (requiere autenticación)
 */
router.patch('/orders/:id/delivery-status', authenticate, updateDeliveryStatusValidation, validate, (req, res) => 
  controller.updateDeliveryStatus(req, res)
);

/**
 * @route   PATCH /cod-hub/orders/:id/cancel
 * @desc    Cancelar orden
 * @access  Private (requiere autenticación)
 */
router.patch('/orders/:id/cancel', authenticate, cancelOrderValidation, validate, (req, res) => 
  controller.cancel(req, res)
);

/**
 * @route   PATCH /cod-hub/orders/:id/deliver
 * @desc    Marcar orden como entregada
 * @access  Public (webhook)
 */
router.patch('/orders/:id/deliver', orderIdValidation, validate, (req, res) => 
  controller.markAsDelivered(req, res)
);

export default router;
