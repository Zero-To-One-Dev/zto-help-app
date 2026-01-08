import { DataTypes } from 'sequelize';
import sequelize from '../../../config/sequelize.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'auth_users',
  indexes: [
    { unique: true, fields: ['email'] },
    { fields: ['is_active'] }
  ]
});

export default User;
