import AuthService from '../services/auth.service.js';
import logger from '../../../logger.js';

const authService = new AuthService();

/**
 * Middleware de autenticación JWT
 * Verifica el token y agrega req.user
 */
export const authenticate = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '

    // Verificar token
    const decoded = authService.verifyToken(token);

    // Obtener usuario completo
    const user = await authService.getUserById(decoded.id);

    // Agregar usuario al request
    req.user = user;

    next();
  } catch (error) {
    logger.error(`[Auth Middleware] Error: ${error.message}`);
    
    return res.status(401).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Middleware opcional de autenticación
 * Si hay token lo verifica, si no continúa sin usuario
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);
    const user = await authService.getUserById(decoded.id);
    
    req.user = user;
    next();
  } catch (error) {
    // Si hay error en el token opcional, continuar sin usuario
    next();
  }
};

export default { authenticate, optionalAuthenticate };
