import { models } from '../models/index.js';
import sequelize from '../../../config/sequelize.js';
import { Op } from 'sequelize';
import ConfigStores from '../../../services/config-stores.js';

const { CodOrder, User, CancelReason, CodStore } = models;

class CodOrderRepository {
  /**
   * Crear una nueva orden COD
   */
  async create(data) {
    // Verificar que el store esté activo antes de crear la orden
    if (data.cod_store_id) {
      const codStore = await CodStore.findByPk(data.cod_store_id);
      if (!codStore) {
        throw new Error('CodStore no encontrado');
      }
      if (!codStore.is_active) {
        throw new Error('No se pueden crear órdenes para un store inactivo');
      }
    }
    
    return await CodOrder.create(data);
  }

  /**
   * Buscar por ID
   */
  async findById(id) {
    const order = await CodOrder.findByPk(id, {
      include: [
        { model: User, as: 'confirmedByUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'updatedByUser', attributes: ['id', 'name', 'email'] },
        { model: CancelReason, as: 'cancelReason' }
      ]
    });

    if (!order) return null;

    // Obtener shopify_url usando ConfigStores
    const storesInfo = await ConfigStores.getStoresInformation();
    const store = Object.values(storesInfo).find(s => s.id === order.store_id);

    // Agregar shopify_url al objeto order
    if (store) {
      order.dataValues.store_shopify_url = store.shopify_url;
    }

    return order;
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

    const result = await CodOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, sortOrder]],
      include: [
        { model: User, as: 'confirmedByUser', attributes: ['id', 'name'] },
        { model: CancelReason, as: 'cancelReason', attributes: ['id', 'reason'] }
      ]
    });

    // Obtener shopify_url para todas las órdenes usando ConfigStores
    if (result.rows.length > 0) {
      const storesInfo = await ConfigStores.getStoresInformation();
      const storeMap = Object.values(storesInfo).reduce((acc, store) => {
        acc[store.id] = store.shopify_url;
        return acc;
      }, {});

      // Agregar shopify_url a cada orden
      result.rows.forEach(order => {
        order.dataValues.store_shopify_url = storeMap[order.store_id];
      });
    }

    return result;
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

    const result = await CodOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'confirmedByUser', attributes: ['id', 'name'] }
      ]
    });

    // Obtener shopify_url para todas las órdenes usando ConfigStores
    if (result.rows.length > 0) {
      const storesInfo = await ConfigStores.getStoresInformation();
      const storeMap = Object.values(storesInfo).reduce((acc, store) => {
        acc[store.id] = store.shopify_url;
        return acc;
      }, {});

      // Agregar shopify_url a cada orden
      result.rows.forEach(order => {
        order.dataValues.store_shopify_url = storeMap[order.store_id];
      });
    }

    return result;
  }

  /**
   * Actualizar orden
   */
  async update(id, data) {
    const orden = await CodOrder.findByPk(id);
    if (!orden) return null;
    
    await orden.update(data);
    
    // Retornar con datos completos incluyendo shopify_url
    return await this.findById(id);
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
