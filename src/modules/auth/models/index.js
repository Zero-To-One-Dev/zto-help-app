import { registerModels } from '../../../config/database.js';
import User from './User.model.js';

// Registro de modelos en el sistema global
const models = {
  User
};

// Registrar en el sistema global de modelos
registerModels('Auth', models);

export { models };
export default models;
