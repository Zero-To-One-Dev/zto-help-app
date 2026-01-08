import { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE, PGSSL } from '../app.js'
import { Sequelize, Model, DataTypes } from 'sequelize';

export const sequelize = new Sequelize(`postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}`, {
  dialect: 'postgres',
  //logging: false,            // quítalo si quieres ver SQL en consola
  // ssl: true, dialectOptions: { ssl: { require: true } } // si tu DB exige SSL
});

export class Member extends Model {}
Member.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  extrahealth_id: {
    type: DataTypes.INTEGER,
    unique: true,
    allowNull: true
  },
  customer_id: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM,
    values: ['CREATED', 'ENROLLED', 'ON_HOLD', 'CANCEL'],
  },
  firstname: {
    type: DataTypes.STRING,
  },
  lastname: {
    type: DataTypes.STRING,
  },
  birthday: {
    type: DataTypes.DATEONLY,
  },
  gender: {
    type: DataTypes.ENUM,
    values: ['Male', 'Female'],
  },
  phone_number: {
    type: DataTypes.STRING,
  },
  phone_device: {
    type: DataTypes.ENUM,
    values: ['Android', 'Apple'],
  },
  email: {
    type: DataTypes.STRING,
  },
  address: {
    type: DataTypes.STRING,
  },
  state: {
    type: DataTypes.STRING,
  },
  zipcode: {
    type: DataTypes.STRING,
  },
}, {
  sequelize,
  modelName: 'Member',
  tableName: 'members',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export class ProductSubscription extends Model {}
ProductSubscription.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  skio_subscription_id: {
    type: DataTypes.STRING,
    unique: true,
  },
  contract_id: {
    type: DataTypes.STRING,
    unique: true,
  },
  pdid: {
    type: DataTypes.INTEGER,
    defaultValue: 45750
  },
  dtEffective: {
    type: DataTypes.DATE,
  },  
  bPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  dtBilling: {
    type: DataTypes.DATE,
  },
  dtRecurring: {
    type: DataTypes.DATE,
  },
  dtCancelled: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.ENUM,
    values: ['ACTIVE', 'ON_HOLD', 'CANCEL'],
    defaultValue: 'ACTIVE'
  },
}, {
  sequelize,
  modelName: 'ProductSubscription',
  tableName: 'product_subscriptions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export class Dependent extends Model {}
Dependent.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  product_subscription_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },  
  firstname: {
    type: DataTypes.STRING,
  },
  lastname: {
    type: DataTypes.STRING,
  },
  birthday: {
    type: DataTypes.DATE,
  },
  relationship: {
    type: DataTypes.ENUM,
    values: ['Spouse', 'Child'],
  },
  gender: {
    type: DataTypes.ENUM,
    values: ['Male', 'Female'],
  },
  address: {
    type: DataTypes.STRING,
  },
  state: {
    type: DataTypes.STRING,
  },
  zipcode: {
    type: DataTypes.STRING,
  },
  phone: {
    type: DataTypes.STRING,
  },
  email: {
    type: DataTypes.STRING,
  },
}, {
  sequelize,
  modelName: 'Dependent',
  tableName: 'dependents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});


// Member 1:N ProductSubscription
Member.hasMany(ProductSubscription, { foreignKey: 'member_id', as: 'products' });
ProductSubscription.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

// ProductSubscription 1:N Dependent
// (la FK en dependents es product_subscription_id → product_subscriptions.id)
ProductSubscription.hasMany(Dependent, { foreignKey: 'product_subscription_id', as: 'dependents' });
Dependent.belongsTo(ProductSubscription, { foreignKey: 'product_subscription_id', as: 'product' });

// Comprueba conexión y una consulta simple
// try {
//   await sequelize.authenticate();
//   const count = await ProductSubscription.count(); // debería NO fallar si el tableName es correcto
//   console.log('ProductSubscription rows:', count);
// } catch (error) {
//   console.error('Unable to connect to the database:', error);
// }