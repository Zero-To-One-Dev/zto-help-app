#!/usr/bin/env node
/**
 * CLI para migraciones por módulos
 * 
 * Uso:
 *   node src/migrate.js                    # Migrar todos los módulos
 *   node src/migrate.js --module cod-hub   # Migrar solo cod-hub
 *   node src/migrate.js --rollback cod-hub # Revertir última migración de cod-hub
 *   node src/migrate.js --status           # Ver estado de migraciones
 *   node src/migrate.js --status cod-hub   # Ver estado de un módulo
 */

import path from 'path';
import { fileURLToPath } from 'url';
import migrator from './config/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// Registrar módulos con migraciones
// ============================================
// Agregar aquí cada nuevo módulo que tenga migraciones

// Módulo de autenticación (debe ejecutarse primero por dependencias)
migrator.registerMigrationModule(
  'auth',
  path.resolve(__dirname, 'modules', 'auth', 'migrations')
);

// Módulo COD Hub (depende de auth para FKs a auth_users)
migrator.registerMigrationModule(
  'cod-hub',
  path.resolve(__dirname, 'modules', 'cod-hub', 'migrations')
);

// Ejemplo para futuros módulos:
// migrator.registerMigrationModule(
//   'inventory',
//   path.resolve(__dirname, 'modules', 'inventory', 'migrations')
// );

// ============================================
// CLI
// ============================================
const args = process.argv.slice(2);

async function main() {
  const command = args[0];
  const target = args[1];

  try {
    if (command === '--status') {
      await migrator.status(target || null);
    } else if (command === '--rollback') {
      if (!target) {
        console.error('❌ Debes especificar el módulo: --rollback <modulo>');
        process.exit(1);
      }
      const steps = args[2] ? parseInt(args[2]) : 1;
      await migrator.rollback(target, steps);
    } else if (command === '--module') {
      await migrator.migrate(target);
    } else if (!command) {
      // Sin argumentos = migrar todo
      await migrator.migrate();
    } else {
      console.log(`
📖 Uso:
  node src/migrate.js                      Migrar todos los módulos
  node src/migrate.js --module <nombre>    Migrar un módulo específico
  node src/migrate.js --rollback <nombre>  Revertir última migración
  node src/migrate.js --rollback <nombre> <n>  Revertir n migraciones
  node src/migrate.js --status             Ver estado de todos los módulos
  node src/migrate.js --status <nombre>    Ver estado de un módulo
      `);
    }
  } catch (error) {
    process.exit(1);
  }

  process.exit(0);
}

main();
