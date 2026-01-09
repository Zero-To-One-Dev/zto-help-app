'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar columna is_active a cod_stores
    await queryInterface.addColumn('cod_stores', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Eliminar columna is_active
    await queryInterface.removeColumn('cod_stores', 'is_active');
  }
};
