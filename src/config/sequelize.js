import { Sequelize } from 'sequelize';
import { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE, PGSSL } from '../app.js';

/**
 * Instancia global de Sequelize
 * Singleton que puede ser usado por todos los módulos
 */
const sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
  host: PGHOST,
  port: PGPORT,
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: PGSSL ? { rejectUnauthorized: false } : false
  },
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

export default sequelize;
