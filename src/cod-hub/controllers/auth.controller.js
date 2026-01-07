import AuthService from '../services/auth.service.js';
import logger from '../../../logger.js';

const service = new AuthService();

class AuthController {
  /**
   * POST /cod-hub/auth/register
   * Registrar nuevo usuario
   */
  async register(req, res) {
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
  }

  /**
   * POST /cod-hub/auth/login
   * Login de usuario
   */
  async login(req, res) {
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
  }

  /**
   * GET /cod-hub/auth/me
   * Obtener información del usuario autenticado
   */
  async getMe(req, res) {
    try {
      // req.user ya está inyectado por el middleware de autenticación
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
  }

  /**
   * PATCH /cod-hub/auth/password
   * Cambiar contraseña
   */
  async changePassword(req, res) {
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
  }

  /**
   * PATCH /cod-hub/auth/profile
   * Actualizar perfil
   */
  async updateProfile(req, res) {
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
  }
}

export default AuthController;
