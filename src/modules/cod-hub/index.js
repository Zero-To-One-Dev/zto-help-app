import { Router } from 'express';
import { initDatabase } from '../../config/database.js';
import { models } from './models/index.js';
import codOrderRoutes from './routes/codOrder.routes.js';
import cancelReasonRoutes from './routes/cancelReason.routes.js';
import logger from '../../../logger.js';

const router = Router();

// Inicializar conexión a BD
initDatabase().then(() => {
  logger.info('[COD-Hub] Module initialized');
}).catch(err => {
  logger.error('[COD-Hub] Failed to initialize:', err.message);
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'cod-hub' });
});

// Rutas de razones de cancelación
router.use('/cancel-reasons', cancelReasonRoutes);

// Montar rutas de órdenes COD
router.use('/', codOrderRoutes);

export default router;
export { models };
