import { DataTypes } from 'sequelize';
import sequelize from '../../../config/sequelize.js';

// Enums
export const OrderStatus = {
  SIN_CONFIRMAR: 'SIN CONFIRMAR',
  CONFIRMADA: 'CONFIRMADA',
  ENTREGADA: 'ENTREGADA',
  CANCELADA: 'CANCELADA'
};

export const DeliveryStatus = {
  SIN_CONFIRMAR: 'SIN CONFIRMAR',
  SIN_DESPACHAR: 'SIN DESPACHAR',
  CANCELADA: 'CANCELADA',
  RECHAZADA: 'RECHAZADA',
  EN_TRANSITO: 'EN TRANSITO',
  ENTREGADA: 'ENTREGADA',
  NOVEDAD: 'NOVEDAD',
  RECLAMO_EN_OFICINA: 'RECLAMO EN OFICINA'
};

export const Country = {
  CO: 'CO',
  MX: 'MX',
  EC: 'EC',
  CL: 'CL'
};

const CodOrder = sequelize.define('CodOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cod_store_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'cod_stores',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  shopify_order_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  order_name: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  order_status: {
    type: DataTypes.ENUM(...Object.values(OrderStatus)),
    allowNull: false,
    defaultValue: OrderStatus.SIN_CONFIRMAR
  },
  delivery_status: {
    type: DataTypes.ENUM(...Object.values(DeliveryStatus)),
    allowNull: false,
    defaultValue: DeliveryStatus.SIN_CONFIRMAR
  },
  customer_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  customer_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Departamento/Provincia'
  },
  country: {
    type: DataTypes.ENUM(...Object.values(Country)),
    allowNull: false
  },
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancel_reason_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'cod_cancel_reasons',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  confirmed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'auth_users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'auth_users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  }
}, {
  tableName: 'cod_orders',
  indexes: [
    { 
      unique: true, 
      fields: ['cod_store_id', 'shopify_order_id'],
      name: 'cod_orders_cod_store_shopify_unique'
    },
    { fields: ['order_status'] },
    { fields: ['delivery_status'] },
    { fields: ['country'] },
    { fields: ['created_at'] }
  ]
});

export default CodOrder;
