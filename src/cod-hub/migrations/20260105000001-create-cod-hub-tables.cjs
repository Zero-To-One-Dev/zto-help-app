'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla cod_users
    await queryInterface.createTable('cod_users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex('cod_users', ['email'], { unique: true });
    await queryInterface.addIndex('cod_users', ['is_active']);

    // Crear tabla cod_cancel_reasons
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
          model: 'cod_users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'cod_users',
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

    // Crear ENUMs para cod_orders
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE cod_order_status AS ENUM ('SIN CONFIRMAR', 'CONFIRMADA', 'ENTREGADA', 'CANCELADA');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE cod_delivery_status AS ENUM ('SIN CONFIRMAR', 'SIN DESPACHAR', 'CANCELADA', 'RECHAZADA', 'EN TRANSITO', 'ENTREGADA', 'NOVEDAD', 'RECLAMO EN OFICINA');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE cod_country AS ENUM ('CO', 'MX', 'EC', 'CL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Crear tabla cod_orders
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
        type: 'cod_order_status',
        allowNull: false,
        defaultValue: 'SIN CONFIRMAR'
      },
      delivery_status: {
        type: 'cod_delivery_status',
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
        allowNull: true
      },
      country: {
        type: 'cod_country',
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
          model: 'cod_users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'cod_users',
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

    // Índices para cod_orders
    await queryInterface.addIndex('cod_orders', ['store_id', 'shopify_order_id'], {
      unique: true,
      name: 'cod_orders_store_shopify_unique'
    });
    await queryInterface.addIndex('cod_orders', ['order_status']);
    await queryInterface.addIndex('cod_orders', ['delivery_status']);
    await queryInterface.addIndex('cod_orders', ['country']);
    await queryInterface.addIndex('cod_orders', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cod_orders');
    await queryInterface.dropTable('cod_cancel_reasons');
    await queryInterface.dropTable('cod_users');
    
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS cod_order_status;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS cod_delivery_status;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS cod_country;');
  }
};
