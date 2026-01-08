import sequelize from './sequelize.js';
import logger from '../../logger.js';

/**
 * Registro global de modelos
 * Cada módulo puede registrar sus modelos aquí
 */
const models = {};

/**
 * Registra modelos de un módulo en el registro global
 * @param {string} moduleName - Nombre del módulo
 * @param {Object} moduleModels - Objeto con los modelos del módulo
 */
export function registerModels(moduleName, moduleModels) {
  Object.entries(moduleModels).forEach(([name, model]) => {
    const fullName = `${moduleName}.${name}`;
    if (models[fullName]) {
      logger.warn(`[Database] Model ${fullName} already registered, skipping`);
      return;
    }
    models[fullName] = model;
    // También registrar con nombre corto si no existe
    if (!models[name]) {
      models[name] = model;
    }
  });
  logger.info(`[Database] Registered models from module: ${moduleName}`);
}

/**
 * Obtiene un modelo por nombre
 * @param {string} name - Nombre del modelo (puede ser 'ModuleName.ModelName' o solo 'ModelName')
 */
export function getModel(name) {
  return models[name];
}

/**
 * Obtiene todos los modelos registrados
 */
export function getAllModels() {
  return { ...models };
}

/**
 * Inicializa la conexión a la base de datos
 */
export async function initDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('[Database] Connection established successfully');
    return true;
  } catch (error) {
    logger.error('[Database] Unable to connect:', error.message);
    throw error;
  }
}

/**
 * Cierra la conexión a la base de datos
 */
export async function closeDatabase() {
  await sequelize.close();
  logger.info('[Database] Connection closed');
}

export { sequelize };
export default {
  sequelize,
  models,
  registerModels,
  getModel,
  getAllModels,
  initDatabase,
  closeDatabase
};
