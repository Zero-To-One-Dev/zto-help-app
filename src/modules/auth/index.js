import { Router } from 'express';
import { initDatabase } from '../../config/database.js';
import { models } from './models/index.js';
import authRoutes from './routes/auth.routes.js';
import logger from '../../../logger.js';

// Exportar middleware y servicio para uso externo
export { authenticate, optionalAuthenticate } from './middlewares/auth.middleware.js';
export { default as AuthService } from './services/auth.service.js';

const router = Router();

// Inicializar conexión a BD
initDatabase().then(() => {
  logger.info('[Auth] Module initialized');
}).catch(err => {
  logger.error('[Auth] Failed to initialize:', err.message);
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'auth' });
});

// Montar rutas de autenticación
router.use('/', authRoutes);

export default router;
export { models };
