'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla de razones de cancelación
    await queryInterface.createTable('cod_cancel_reasons', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: false
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

    // Crear ENUMs
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_cod_orders_order_status" AS ENUM ('SIN CONFIRMAR', 'CONFIRMADA', 'ENTREGADA', 'CANCELADA');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_cod_orders_delivery_status" AS ENUM ('SIN CONFIRMAR', 'SIN DESPACHAR', 'CANCELADA', 'RECHAZADA', 'EN TRANSITO', 'ENTREGADA', 'NOVEDAD', 'RECLAMO EN OFICINA');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_cod_orders_country" AS ENUM ('CO', 'MX', 'EC', 'CL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Crear tabla de órdenes COD
    await queryInterface.createTable('cod_orders', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      store_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      shopify_order_id: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      order_name: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      order_status: {
        type: Sequelize.ENUM('SIN CONFIRMAR', 'CONFIRMADA', 'ENTREGADA', 'CANCELADA'),
        allowNull: false,
        defaultValue: 'SIN CONFIRMAR'
      },
      delivery_status: {
        type: Sequelize.ENUM('SIN CONFIRMAR', 'SIN DESPACHAR', 'CANCELADA', 'RECHAZADA', 'EN TRANSITO', 'ENTREGADA', 'NOVEDAD', 'RECLAMO EN OFICINA'),
        allowNull: false,
        defaultValue: 'SIN CONFIRMAR'
      },
      customer_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      customer_phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      customer_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      region: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Departamento/Provincia'
      },
      country: {
        type: Sequelize.ENUM('CO', 'MX', 'EC', 'CL'),
        allowNull: false
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancel_reason_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'cod_cancel_reasons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      confirmed_by: {
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

    // Índices
    await queryInterface.addIndex('cod_orders', ['store_id', 'shopify_order_id'], {
      unique: true,
      name: 'cod_orders_store_shopify_unique'
    });

    await queryInterface.addIndex('cod_orders', ['order_status'], {
      name: 'cod_orders_order_status_idx'
    });

    await queryInterface.addIndex('cod_orders', ['delivery_status'], {
      name: 'cod_orders_delivery_status_idx'
    });

    await queryInterface.addIndex('cod_orders', ['country'], {
      name: 'cod_orders_country_idx'
    });

    await queryInterface.addIndex('cod_orders', ['created_at'], {
      name: 'cod_orders_created_at_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cod_orders');
    await queryInterface.dropTable('cod_cancel_reasons');

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_cod_orders_order_status";
      DROP TYPE IF EXISTS "enum_cod_orders_delivery_status";
      DROP TYPE IF EXISTS "enum_cod_orders_country";
    `);
  }
};
