import { models } from '../models/index.js';

const { CancelReason, User } = models;

class CancelReasonRepository {
  /**
   * Crear razón de cancelación
   */
  async create(data) {
    return await CancelReason.create(data);
  }

  /**
   * Buscar por ID
   */
  async findById(id) {
    return await CancelReason.findByPk(id, {
      include: [
        { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'updatedByUser', attributes: ['id', 'name', 'email'] }
      ]
    });
  }

  /**
   * Listar todas las razones activas
   */
  async findAll() {
    return await CancelReason.findAll({
      order: [['created_at', 'ASC']],
      include: [
        { model: User, as: 'createdByUser', attributes: ['id', 'name'] }
      ]
    });
  }

  /**
   * Actualizar razón
   */
  async update(id, data) {
    const reason = await CancelReason.findByPk(id);
    if (!reason) return null;
    
    return await reason.update(data);
  }

  /**
   * Eliminar razón
   */
  async delete(id) {
    const reason = await CancelReason.findByPk(id);
    if (!reason) return false;
    
    await reason.destroy();
    return true;
  }

  /**
   * Verificar si existe por ID
   */
  async exists(id) {
    const count = await CancelReason.count({ where: { id } });
    return count > 0;
  }
}

export default CancelReasonRepository;
