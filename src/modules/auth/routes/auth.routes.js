import { Router } from 'express';
import { validationResult } from 'express-validator';
import AuthService from '../services/auth.service.js';
import logger from '../../../../logger.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  updateProfileValidation,
  listUsersValidation,
  toggleUserStatusValidation
} from '../validators/auth.validator.js';

const router = Router();
const service = new AuthService();

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

// ============================================
// RUTAS PÚBLICAS
// ============================================

/**
 * @route   POST /auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post('/register', registerValidation, validate, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const result = await service.register({ name, email, password });

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (error) {
    const statusCode = error.message === 'Email already registered' ? 400 : 500;
    logger.error(`[AuthController] Registration error: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', loginValidation, validate, async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await service.login(email, password);

    res.json({
      success: true,
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (error) {
    const statusCode = ['Invalid credentials', 'User account is inactive'].includes(error.message) ? 401 : 500;
    logger.error(`[AuthController] Login error: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// RUTAS PROTEGIDAS (Requieren autenticación)
// ============================================

/**
 * @route   GET /auth/me
 * @desc    Obtener usuario autenticado
 * @access  Private
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await service.getUserById(req.user.id);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`[AuthController] Get me error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /auth/password
 * @desc    Cambiar contraseña
 * @access  Private
 */
router.patch('/password', authenticate, changePasswordValidation, validate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    await service.changePassword(userId, current_password, new_password);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    const statusCode = error.message === 'Current password is incorrect' ? 400 : 500;
    logger.error(`[AuthController] Change password error: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /auth/profile
 * @desc    Actualizar perfil
 * @access  Private
 */
router.patch('/profile', authenticate, updateProfileValidation, validate, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const user = await service.updateProfile(userId, updates);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`[AuthController] Update profile error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMINISTRACIÓN
// ============================================

/**
 * @route   GET /auth/users
 * @desc    Listar usuarios
 * @access  Private (Admin)
 */
router.get('/users', authenticate, listUsersValidation, validate, async (req, res) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined
    };

    const result = await service.listUsers(filters);

    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`[AuthController] List users error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /auth/users/:id/status
 * @desc    Activar/Desactivar usuario
 * @access  Private (Admin)
 */
router.patch('/users/:id/status', authenticate, toggleUserStatusValidation, validate, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const user = await service.toggleUserStatus(id, is_active);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    const statusCode = error.message === 'User not found' ? 404 : 500;
    logger.error(`[AuthController] Toggle user status error: ${error.message}`);
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
