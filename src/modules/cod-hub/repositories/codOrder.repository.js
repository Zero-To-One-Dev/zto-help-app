import { models } from '../models/index.js';
import sequelize from '../../../config/sequelize.js';
import { Op } from 'sequelize';

const { CodOrder, User, CancelReason } = models;

class CodOrderRepository {
  /**
   * Crear una nueva orden COD
   */
  async create(data) {
    return await CodOrder.create(data);
  }

  /**
   * Buscar por ID
   */
  async findById(id) {
    return await CodOrder.findByPk(id, {
      include: [
        { model: User, as: 'confirmedByUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'updatedByUser', attributes: ['id', 'name', 'email'] },
        { model: CancelReason, as: 'cancelReason' }
      ]
    });
  }

  /**
   * Buscar por store_id y shopify_order_id
   */
  async findByShopifyOrder(storeId, shopifyOrderId) {
    return await CodOrder.findOne({
      where: { store_id: storeId, shopify_order_id: shopifyOrderId }
    });
  }

  /**
   * Listar órdenes con filtros y paginación
   */
  async findAll(filters = {}) {
    const { 
      storeId, 
      orderStatus, 
      deliveryStatus, 
      country,
      page = 1, 
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = filters;

    const where = {};
    
    if (storeId) where.store_id = storeId;
    if (orderStatus) where.order_status = orderStatus;
    if (deliveryStatus) where.delivery_status = deliveryStatus;
    if (country) where.country = country;

    const offset = (page - 1) * limit;

    return await CodOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        { model: User, as: 'confirmedByUser', attributes: ['id', 'name'] },
        { model: CancelReason, as: 'cancelReason', attributes: ['id', 'reason'] }
      ]
    });
  }

  /**
   * Buscar con término de búsqueda
   */
  async search(searchTerm, filters = {}) {
    const { storeId, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const where = {
      [Op.or]: [
        { order_name: { [Op.iLike]: `%${searchTerm}%` } },
        { customer_name: { [Op.iLike]: `%${searchTerm}%` } },
        { customer_phone: { [Op.iLike]: `%${searchTerm}%` } },
        { customer_email: { [Op.iLike]: `%${searchTerm}%` } }
      ]
    };

    if (storeId) where.store_id = storeId;

    return await CodOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'confirmedByUser', attributes: ['id', 'name'] }
      ]
    });
  }

  /**
   * Actualizar orden
   */
  async update(id, data) {
    const orden = await CodOrder.findByPk(id);
    if (!orden) return null;
    
    return await orden.update(data);
  }

  /**
   * Actualizar estado de orden
   */
  async updateStatus(id, orderStatus, deliveryStatus, userId) {
    const data = { 
      order_status: orderStatus,
      updated_by: userId
    };
    
    if (deliveryStatus) {
      data.delivery_status = deliveryStatus;
    }

    return await this.update(id, data);
  }

  /**
   * Confirmar orden
   */
  async confirm(id, userId) {
    return await this.update(id, {
      order_status: 'CONFIRMADA',
      confirmed_at: new Date(),
      confirmed_by: userId,
      updated_by: userId
    });
  }

  /**
   * Cancelar orden
   */
  async cancel(id, cancelReasonId, userId) {
    return await this.update(id, {
      order_status: 'CANCELADA',
      delivery_status: 'CANCELADA',
      cancel_reason_id: cancelReasonId,
      updated_by: userId
    });
  }

  /**
   * Marcar como entregada
   */
  async markAsDelivered(id, userId) {
    return await this.update(id, {
      order_status: 'ENTREGADA',
      delivery_status: 'ENTREGADA',
      updated_by: userId
    });
  }

  /**
   * Eliminar orden
   */
  async delete(id) {
    const orden = await CodOrder.findByPk(id);
    if (!orden) return false;
    
    await orden.destroy();
    return true;
  }

  /**
   * Obtener estadísticas
   */
  async getStats(storeId = null) {
    const where = storeId ? { store_id: storeId } : {};

    const stats = await CodOrder.findAll({
      attributes: [
        'order_status',
        'delivery_status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where,
      group: ['order_status', 'delivery_status'],
      raw: true
    });

    return stats;
  }
}

export default CodOrderRepository;
