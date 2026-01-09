import CodOrderRepository from '../repositories/codOrder.repository.js';
import StoreRepository from '../repositories/store.repository.js';
import CancelReasonRepository from '../repositories/cancelReason.repository.js';
import logger from '../../../../logger.js';

const repository = new CodOrderRepository();
const storeRepository = new StoreRepository();
const cancelReasonRepository = new CancelReasonRepository();

/**
 * Helper para formatear order_url del admin de Shopify
 * @param {string} shopifyUrl - URL de la tienda (ej: "storename.myshopify.com")
 * @param {string|number} shopifyOrderId - ID de la orden en Shopify
 * @returns {string} - URL del admin de Shopify
 */
function formatOrderUrl(shopifyUrl, shopifyOrderId) {
  if (!shopifyUrl || !shopifyOrderId) return null;
  
  // Extraer el nombre de la tienda (storename de storename.myshopify.com)
  const storeName = shopifyUrl.replace(/^https?:\/\//, '').split('.')[0];
  
  return `https://admin.shopify.com/store/${storeName}/orders/${shopifyOrderId}`;
}

/**
 * Agregar order_url a una orden
 */
function addOrderUrl(order) {
  if (!order) return null;
  
  const orderJson = order.toJSON ? order.toJSON() : order;
  
  if (orderJson.store_shopify_url && orderJson.shopify_order_id) {
    orderJson.order_url = formatOrderUrl(orderJson.store_shopify_url, orderJson.shopify_order_id);
  }
  
  return orderJson;
}

class CodOrderService {
  /**
   * Crear orden COD desde webhook de Shopify/Dropi
   * @param {Object} orderData - Datos de la orden (debe incluir store_url)
   */
  async createFromWebhook(orderData) {
    try {
      // Buscar store_id por store_url
      if (!orderData.store_url) {
        throw new Error('store_url is required');
      }

      const store = await storeRepository.findByUrlDomain(orderData.store_url);
      if (!store) {
        throw new Error(`Store not found for URL: ${orderData.store_url}`);
      }

      // Reemplazar store_url con store_id
      const orderDataWithStoreId = {
        ...orderData,
        store_id: store.id
      };
      delete orderDataWithStoreId.store_url;

      // Verificar si ya existe
      const existing = await repository.findByShopifyOrder(
        store.id,
        orderData.shopify_order_id
      );

      if (existing) {
        logger.warn(`[CodOrderService] Order already exists: ${orderData.order_name}`);
        return { created: false, order: addOrderUrl(existing) };
      }

      const order = await repository.create(orderDataWithStoreId);
      logger.info(`[CodOrderService] Order created: ${order.order_name} for store ${store.alias}`);
      
      // Obtener order completa con shopify_url para generar order_url
      const fullOrder = await repository.findById(order.id);
      
      return { created: true, order: addOrderUrl(fullOrder) };
    } catch (error) {
      logger.error(`[CodOrderService] Error creating order: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener orden por ID
   */
  async getById(id) {
    const order = await repository.findById(id);
    if (!order) {
      throw new Error('Order not found');
    }
    return addOrderUrl(order);
  }

  /**
   * Listar órdenes con filtros
   */
  async list(filters) {
    const { count, rows } = await repository.findAll(filters);
    
    return {
      orders: rows.map(order => addOrderUrl(order)),
      pagination: {
        total: count,
        page: filters.page || 1,
        limit: filters.limit || 20,
        pages: Math.ceil(count / (filters.limit || 20))
      }
    };
  }

  /**
   * Buscar órdenes
   */
  async search(searchTerm, filters) {
    const { count, rows } = await repository.search(searchTerm, filters);
    
    return {
      orders: rows.map(order => addOrderUrl(order)),
      pagination: {
        total: count,
        page: filters.page || 1,
        limit: filters.limit || 20,
        pages: Math.ceil(count / (filters.limit || 20))
      }
    };
  }

  /**
   * Confirmar orden
   */
  async confirmOrder(orderId, userId) {
    const order = await repository.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.order_status !== 'SIN CONFIRMAR') {
      throw new Error('Order cannot be confirmed in current status');
    }

    const updated = await repository.confirm(orderId, userId);
    logger.info(`[CodOrderService] Order ${orderId} confirmed by user ${userId}`);
    
    return addOrderUrl(updated);
  }

  /**
   * Actualizar estado de despacho
   */
  async updateDeliveryStatus(orderId, deliveryStatus, userId) {
    const order = await repository.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Validar transiciones de estado
    const validTransitions = {
      'SIN CONFIRMAR': ['SIN DESPACHAR', 'CANCELADA'],
      'SIN DESPACHAR': ['EN TRANSITO', 'CANCELADA'],
      'EN TRANSITO': ['ENTREGADA', 'NOVEDAD', 'CANCELADA'],
      'NOVEDAD': ['EN TRANSITO', 'RECLAMO EN OFICINA', 'CANCELADA'],
      'RECLAMO EN OFICINA': ['ENTREGADA', 'CANCELADA']
    };

    const currentStatus = order.delivery_status;
    if (!validTransitions[currentStatus]?.includes(deliveryStatus)) {
      throw new Error(`Invalid transition from ${currentStatus} to ${deliveryStatus}`);
    }

    // Actualizar order_status automáticamente según delivery_status
    let orderStatus = order.order_status;
    if (deliveryStatus === 'ENTREGADA') {
      orderStatus = 'ENTREGADA';
    } else if (deliveryStatus === 'CANCELADA') {
      orderStatus = 'CANCELADA';
    }

    const updated = await repository.updateStatus(orderId, orderStatus, deliveryStatus, userId);
    logger.info(`[CodOrderService] Order ${orderId} delivery status updated to ${deliveryStatus}`);
    
    return addOrderUrl(updated);
  }

  /**
   * Cancelar orden
   */
  async cancelOrder(orderId, cancelReasonId, userId) {
    const order = await repository.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (['ENTREGADA', 'CANCELADA'].includes(order.order_status)) {
      throw new Error('Order cannot be cancelled in current status');
    }

    // Validar que exista la razón de cancelación
    if (!cancelReasonId) {
      throw new Error('Cancel reason is required');
    }

    const reasonExists = await cancelReasonRepository.exists(cancelReasonId);
    if (!reasonExists) {
      throw new Error('Invalid cancel reason ID');
    }

    const updated = await repository.cancel(orderId, cancelReasonId, userId);
    logger.info(`[CodOrderService] Order ${orderId} cancelled by user ${userId} with reason ${cancelReasonId}`);
    
    return addOrderUrl(updated);
  }

  /**
   * Marcar como entregada
   */
  async markAsDelivered(orderId, userId) {
    const order = await repository.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.order_status === 'CANCELADA') {
      throw new Error('Cannot mark cancelled order as delivered');
    }

    const updated = await repository.markAsDelivered(orderId, userId);
    logger.info(`[CodOrderService] Order ${orderId} marked as delivered by user ${userId}`);
    
    return addOrderUrl(updated);
  }

  /**
   * Obtener estadísticas
   */
  async getStatistics(storeId = null) {
    return await repository.getStats(storeId);
  }
}

export default CodOrderService;
