import { Router } from 'express';
import { validationResult } from 'express-validator';
import AuthController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  updateProfileValidation
} from '../validators/auth.validator.js';

const router = Router();
const controller = new AuthController();

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
 * @route   POST /cod-hub/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post('/register', registerValidation, validate, (req, res) =>
  controller.register(req, res)
);

/**
 * @route   POST /cod-hub/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', loginValidation, validate, (req, res) =>
  controller.login(req, res)
);

// ============================================
// RUTAS PROTEGIDAS (Requieren autenticación)
// ============================================

/**
 * @route   GET /cod-hub/auth/me
 * @desc    Obtener usuario autenticado
 * @access  Private
 */
router.get('/me', authenticate, (req, res) =>
  controller.getMe(req, res)
);

/**
 * @route   PATCH /cod-hub/auth/password
 * @desc    Cambiar contraseña
 * @access  Private
 */
router.patch('/password', authenticate, changePasswordValidation, validate, (req, res) =>
  controller.changePassword(req, res)
);

/**
 * @route   PATCH /cod-hub/auth/profile
 * @desc    Actualizar perfil
 * @access  Private
 */
router.patch('/profile', authenticate, updateProfileValidation, validate, (req, res) =>
  controller.updateProfile(req, res)
);

export default router;
