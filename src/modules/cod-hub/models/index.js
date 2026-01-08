import { registerModels } from '../../../config/database.js';
import CodOrder from './CodOrder.model.js';
import CancelReason from './CancelReason.model.js';
// Importar User del módulo auth para las asociaciones
import { models as authModels } from '../../auth/models/index.js';

const { User } = authModels;

// CodOrder -> User (confirmed_by)
CodOrder.belongsTo(User, {
  foreignKey: 'confirmed_by',
  as: 'confirmedByUser'
});

// CodOrder -> User (updated_by)
CodOrder.belongsTo(User, {
  foreignKey: 'updated_by',
  as: 'updatedByUser'
});

// User -> CodOrder (inverse relations)
User.hasMany(CodOrder, {
  foreignKey: 'confirmed_by',
  as: 'confirmedOrders'
});

User.hasMany(CodOrder, {
  foreignKey: 'updated_by',
  as: 'updatedOrders'
});

// CodOrder -> CancelReason
CodOrder.belongsTo(CancelReason, {
  foreignKey: 'cancel_reason_id',
  as: 'cancelReason'
});

// CancelReason -> CodOrder (inverse)
CancelReason.hasMany(CodOrder, {
  foreignKey: 'cancel_reason_id',
  as: 'orders'
});

// CancelReason -> User (created_by)
CancelReason.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'createdByUser'
});

// CancelReason -> User (updated_by)
CancelReason.belongsTo(User, {
  foreignKey: 'updated_by',
  as: 'updatedByUser'
});

// Registro de modelos en el sistema global
const models = {
  CodOrder,
  CancelReason,
  User // Exponerlo para uso interno
};

// Registrar solo los modelos propios de cod-hub en el sistema global
registerModels('CodHub', { CodOrder, CancelReason });

export { models, User };
export default models;
