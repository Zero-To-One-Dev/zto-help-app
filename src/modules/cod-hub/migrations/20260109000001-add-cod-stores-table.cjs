'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Crear tabla cod_stores
    await queryInterface.createTable('cod_stores', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      store_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'auth_users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'auth_users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 2. Crear índice único en cod_stores.store_id
    await queryInterface.addIndex('cod_stores', ['store_id'], {
      unique: true,
      name: 'cod_stores_store_id_unique'
    });

    // 3. Migrar datos: insertar registros únicos en cod_stores basados en cod_orders
    await queryInterface.sequelize.query(`
      INSERT INTO cod_stores (store_id, created_at, updated_at)
      SELECT DISTINCT store_id, NOW(), NOW()
      FROM cod_orders
      WHERE NOT EXISTS (
        SELECT 1 FROM cod_stores WHERE cod_stores.store_id = cod_orders.store_id
      )
      ORDER BY store_id;
    `);

    // 4. Agregar columna temporal cod_store_id a cod_orders
    await queryInterface.addColumn('cod_orders', 'cod_store_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Temporal, lo haremos NOT NULL después
      references: {
        model: 'cod_stores',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    // 5. Poblar cod_store_id basándose en store_id
    await queryInterface.sequelize.query(`
      UPDATE cod_orders
      SET cod_store_id = cod_stores.id
      FROM cod_stores
      WHERE cod_orders.store_id = cod_stores.store_id;
    `);

    // 6. Hacer cod_store_id NOT NULL
    await queryInterface.changeColumn('cod_orders', 'cod_store_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'cod_stores',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    // 7. Eliminar el índice único anterior que usaba store_id
    await queryInterface.removeIndex('cod_orders', 'cod_orders_store_shopify_unique');

    // 8. Eliminar la columna store_id de cod_orders
    await queryInterface.removeColumn('cod_orders', 'store_id');

    // 9. Crear nuevo índice único con cod_store_id
    await queryInterface.addIndex('cod_orders', ['cod_store_id', 'shopify_order_id'], {
      unique: true,
      name: 'cod_orders_cod_store_shopify_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    // 1. Eliminar índice único nuevo
    await queryInterface.removeIndex('cod_orders', 'cod_orders_cod_store_shopify_unique');

    // 2. Agregar de vuelta la columna store_id
    await queryInterface.addColumn('cod_orders', 'store_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // 3. Restaurar datos de store_id desde cod_stores
    await queryInterface.sequelize.query(`
      UPDATE cod_orders
      SET store_id = cod_stores.store_id
      FROM cod_stores
      WHERE cod_orders.cod_store_id = cod_stores.id;
    `);

    // 4. Hacer store_id NOT NULL y agregar foreign key
    await queryInterface.changeColumn('cod_orders', 'store_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    // 5. Eliminar columna cod_store_id
    await queryInterface.removeColumn('cod_orders', 'cod_store_id');

    // 6. Restaurar índice único anterior
    await queryInterface.addIndex('cod_orders', ['store_id', 'shopify_order_id'], {
      unique: true,
      name: 'cod_orders_store_shopify_unique'
    });

    // 7. Eliminar tabla cod_stores
    await queryInterface.dropTable('cod_stores');
  }
};
