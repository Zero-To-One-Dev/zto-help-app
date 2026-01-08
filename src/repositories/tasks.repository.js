import { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE, PGSSL } from '../app.js'
import { Sequelize, Model, DataTypes } from 'sequelize';

export const sequelize = new Sequelize(`postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}`, {
  dialect: 'postgres',
  //logging: false,            // quítalo si quieres ver SQL en consola
  // ssl: true, dialectOptions: { ssl: { require: true } } // si tu DB exige SSL
});

export class Task extends Model {}
Task.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  className: {
    type: DataTypes.STRING,
    allowNull: false
  },
  functionName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  arguments: {
    type: DataTypes.JSON,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM,
    values: ['UNPROCESSED', 'COMPLETED', 'PROCESSING', 'ERROR'],
    defaultValue: 'UNPROCESSED'
  },
  retries_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5
  },
  retries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
}, {
  sequelize,
  modelName: 'Task',
  tableName: 'tasks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default Task