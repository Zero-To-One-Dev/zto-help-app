/**
 * Re-exporta la instancia global de Sequelize
 * Mantiene compatibilidad con imports existentes en el módulo cod-hub
 */
export { default } from '../../config/sequelize.js';
export { sequelize } from '../../config/database.js';

