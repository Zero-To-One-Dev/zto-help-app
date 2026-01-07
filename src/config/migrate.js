import sequelize from './sequelize.js';
import { Sequelize } from 'sequelize';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sistema de migraciones por módulos
 * 
 * Estructura esperada:
 * src/
 * ├── config/migrate.js (este archivo)
 * ├── cod-hub/
 * │   └── migrations/
 * │       └── 20260105000001-create-tables.cjs
 * └── otro-modulo/
 *     └── migrations/
 *         └── 20260106000001-create-tables.cjs
 */

// Registro de módulos con migraciones
const moduleRegistry = new Map();

/**
 * Registra un módulo para migraciones
 * @param {string} moduleName - Nombre del módulo
 * @param {string} migrationsPath - Ruta absoluta a la carpeta de migraciones
 */
export function registerMigrationModule(moduleName, migrationsPath) {
  moduleRegistry.set(moduleName, migrationsPath);
}

/**
 * Inicializa la tabla de control de migraciones
 */
async function initMigrationTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
      "name" VARCHAR(255) NOT NULL,
      "module" VARCHAR(100) NOT NULL,
      "executed_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("name", "module")
    );
  `);
}

/**
 * Obtiene las migraciones ya ejecutadas
 * @param {string|null} moduleName - Filtrar por módulo (null = todas)
 */
async function getExecutedMigrations(moduleName = null) {
  let query = 'SELECT name, module FROM "SequelizeMeta"';
  const replacements = {};
  
  if (moduleName) {
    query += ' WHERE module = :module';
    replacements.module = moduleName;
  }
  
  const [results] = await sequelize.query(query, { replacements });
  return results;
}

/**
 * Ejecuta migraciones de un módulo específico
 * @param {string} moduleName - Nombre del módulo
 */
async function runModuleMigrations(moduleName) {
  const migrationsPath = moduleRegistry.get(moduleName);
  
  if (!migrationsPath) {
    console.log(`⚠️  Módulo "${moduleName}" no registrado`);
    return { executed: 0, skipped: 0 };
  }

  // Verificar si existe la carpeta
  try {
    await fs.access(migrationsPath);
  } catch {
    console.log(`⚠️  No existe carpeta de migraciones para "${moduleName}"`);
    return { executed: 0, skipped: 0 };
  }

  // Leer migraciones ejecutadas del módulo
  const executedMigrations = await getExecutedMigrations(moduleName);
  const executedNames = executedMigrations.map(m => m.name);

  // Leer archivos de migración
  const files = await fs.readdir(migrationsPath);
  const migrationFiles = files.filter(f => f.endsWith('.cjs') || f.endsWith('.js')).sort();

  let executed = 0;
  let skipped = 0;

  for (const file of migrationFiles) {
    if (executedNames.includes(file)) {
      console.log(`  ⏭️  ${file} (ya ejecutada)`);
      skipped++;
      continue;
    }

    console.log(`  🚀 Ejecutando: ${file}`);
    
    const migrationPath = path.join(migrationsPath, file);
    const migration = await import(`file://${migrationPath}`);
    const migrationFn = migration.default || migration;

    await migrationFn.up(sequelize.getQueryInterface(), Sequelize);

    await sequelize.query(
      'INSERT INTO "SequelizeMeta" (name, module) VALUES (:name, :module)',
      { replacements: { name: file, module: moduleName } }
    );

    console.log(`  ✅ ${file} completada`);
    executed++;
  }

  return { executed, skipped };
}

/**
 * Revierte la última migración de un módulo
 * @param {string} moduleName - Nombre del módulo
 */
async function rollbackModuleMigration(moduleName) {
  const migrationsPath = moduleRegistry.get(moduleName);
  
  if (!migrationsPath) {
    console.log(`⚠️  Módulo "${moduleName}" no registrado`);
    return false;
  }

  // Obtener última migración ejecutada
  const [results] = await sequelize.query(
    'SELECT name FROM "SequelizeMeta" WHERE module = :module ORDER BY executed_at DESC LIMIT 1',
    { replacements: { module: moduleName } }
  );

  if (results.length === 0) {
    console.log(`⚠️  No hay migraciones para revertir en "${moduleName}"`);
    return false;
  }

  const lastMigration = results[0].name;
  console.log(`  ⏪ Revirtiendo: ${lastMigration}`);

  const migrationPath = path.join(migrationsPath, lastMigration);
  const migration = await import(`file://${migrationPath}`);
  const migrationFn = migration.default || migration;

  await migrationFn.down(sequelize.getQueryInterface(), Sequelize);

  await sequelize.query(
    'DELETE FROM "SequelizeMeta" WHERE name = :name AND module = :module',
    { replacements: { name: lastMigration, module: moduleName } }
  );

  console.log(`  ✅ ${lastMigration} revertida`);
  return true;
}

/**
 * Ejecuta todas las migraciones pendientes
 * @param {string|null} targetModule - Módulo específico o null para todos
 */
export async function migrate(targetModule = null) {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    await initMigrationTable();

    const modules = targetModule 
      ? [targetModule] 
      : Array.from(moduleRegistry.keys());

    let totalExecuted = 0;
    let totalSkipped = 0;

    for (const moduleName of modules) {
      console.log(`📦 Módulo: ${moduleName}`);
      const { executed, skipped } = await runModuleMigrations(moduleName);
      totalExecuted += executed;
      totalSkipped += skipped;
      console.log('');
    }

    console.log('🎉 Migraciones completadas');
    console.log(`   Ejecutadas: ${totalExecuted}`);
    console.log(`   Omitidas: ${totalSkipped}`);

  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    throw error;
  }
}

/**
 * Revierte migraciones
 * @param {string} targetModule - Módulo a revertir
 * @param {number} steps - Cantidad de migraciones a revertir (default: 1)
 */
export async function rollback(targetModule, steps = 1) {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    console.log(`📦 Módulo: ${targetModule}`);
    
    for (let i = 0; i < steps; i++) {
      const reverted = await rollbackModuleMigration(targetModule);
      if (!reverted) break;
    }

    console.log('\n🎉 Rollback completado');

  } catch (error) {
    console.error('❌ Error en rollback:', error.message);
    throw error;
  }
}

/**
 * Muestra el estado de las migraciones
 * @param {string|null} targetModule - Módulo específico o null para todos
 */
export async function status(targetModule = null) {
  try {
    await sequelize.authenticate();
    await initMigrationTable();

    const modules = targetModule 
      ? [targetModule] 
      : Array.from(moduleRegistry.keys());

    console.log('\n📊 Estado de migraciones:\n');

    for (const moduleName of modules) {
      console.log(`📦 ${moduleName}:`);
      
      const migrationsPath = moduleRegistry.get(moduleName);
      if (!migrationsPath) {
        console.log('   ⚠️  No registrado\n');
        continue;
      }

      // Migraciones en disco
      let filesOnDisk = [];
      try {
        const files = await fs.readdir(migrationsPath);
        filesOnDisk = files.filter(f => f.endsWith('.cjs') || f.endsWith('.js')).sort();
      } catch {
        console.log('   ⚠️  Sin carpeta de migraciones\n');
        continue;
      }

      // Migraciones ejecutadas
      const executed = await getExecutedMigrations(moduleName);
      const executedNames = executed.map(m => m.name);

      for (const file of filesOnDisk) {
        const status = executedNames.includes(file) ? '✅' : '⏳';
        console.log(`   ${status} ${file}`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

export default {
  registerMigrationModule,
  migrate,
  rollback,
  status
};
