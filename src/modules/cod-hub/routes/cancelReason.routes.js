import { Router } from 'express';
import { validationResult } from 'express-validator';
import CancelReasonService from '../services/cancelReason.service.js';
import logger from '../../../../logger.js';
// Usar authenticate del módulo auth compartido
import { authenticate } from '../../auth/middlewares/auth.middleware.js';
import {
  createCancelReasonValidation,
  updateCancelReasonValidation,
  cancelReasonIdValidation
} from '../validators/cancelReason.validator.js';

const router = Router();
const service = new CancelReasonService();

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
 * @route   GET /cod-hub/cancel-reasons
 * @desc    Listar razones de cancelación
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const reasons = await service.list();
    
    res.json({
      success: true,
      data: reasons
    });
  } catch (error) {
    logger.error(`[CancelReasonController] Error listing reasons: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /cod-hub/cancel-reasons/:id
 * @desc    Obtener razón por ID
 * @access  Public
 */
router.get('/:id', cancelReasonIdValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    const reason = await service.getById(id);
    
    res.json({
      success: true,
      data: reason
    });
  } catch (error) {
    const statusCode = error.message === 'Cancel reason not found' ? 404 : 500;
    logger.error(`[CancelReasonController] Error getting reason: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /cod-hub/cancel-reasons
 * @desc    Crear razón de cancelación
 * @access  Private
 */
router.post('/', authenticate, createCancelReasonValidation, validate, async (req, res) => {
  try {
    const userId = req.user?.id;
    const reason = await service.create(req.body, userId);
    
    res.status(201).json({
      success: true,
      data: reason
    });
  } catch (error) {
    logger.error(`[CancelReasonController] Error creating reason: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /cod-hub/cancel-reasons/:id
 * @desc    Actualizar razón
 * @access  Private
 */
router.patch('/:id', authenticate, updateCancelReasonValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    const reason = await service.update(id, req.body, userId);
    
    res.json({
      success: true,
      data: reason
    });
  } catch (error) {
    const statusCode = error.message === 'Cancel reason not found' ? 404 : 500;
    logger.error(`[CancelReasonController] Error updating reason: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   DELETE /cod-hub/cancel-reasons/:id
 * @desc    Eliminar razón
 * @access  Private
 */
router.delete('/:id', authenticate, cancelReasonIdValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    await service.delete(id);
    
    res.json({
      success: true,
      message: 'Cancel reason deleted successfully'
    });
  } catch (error) {
    const statusCode = error.message === 'Cancel reason not found' ? 404 : 500;
    logger.error(`[CancelReasonController] Error deleting reason: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
