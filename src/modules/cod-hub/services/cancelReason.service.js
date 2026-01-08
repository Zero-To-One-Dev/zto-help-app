import CancelReasonRepository from '../repositories/cancelReason.repository.js';
import logger from '../../../../logger.js';

const repository = new CancelReasonRepository();

class CancelReasonService {
  /**
   * Crear razón de cancelación
   */
  async create(data, userId) {
    try {
      const reasonData = {
        ...data,
        created_by: userId,
        updated_by: userId
      };

      const reason = await repository.create(reasonData);
      logger.info(`[CancelReasonService] Reason created: ${reason.reason}`);
      
      return reason;
    } catch (error) {
      logger.error(`[CancelReasonService] Error creating reason: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener razón por ID
   */
  async getById(id) {
    const reason = await repository.findById(id);
    if (!reason) {
      throw new Error('Cancel reason not found');
    }
    return reason;
  }

  /**
   * Listar todas las razones
   */
  async list() {
    return await repository.findAll();
  }

  /**
   * Actualizar razón
   */
  async update(id, data, userId) {
    const reason = await repository.findById(id);
    if (!reason) {
      throw new Error('Cancel reason not found');
    }

    const updateData = {
      ...data,
      updated_by: userId
    };

    const updated = await repository.update(id, updateData);
    logger.info(`[CancelReasonService] Reason ${id} updated by user ${userId}`);
    
    return updated;
  }

  /**
   * Eliminar razón
   */
  async delete(id) {
    const deleted = await repository.delete(id);
    if (!deleted) {
      throw new Error('Cancel reason not found');
    }

    logger.info(`[CancelReasonService] Reason ${id} deleted`);
    return true;
  }

  /**
   * Validar que existe la razón
   */
  async validateExists(id) {
    const exists = await repository.exists(id);
    if (!exists) {
      throw new Error('Invalid cancel reason ID');
    }
    return true;
  }
}

export default CancelReasonService;
