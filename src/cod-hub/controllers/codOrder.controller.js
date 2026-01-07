import CodOrderService from '../services/codOrder.service.js';
import logger from '../../../logger.js';

const service = new CodOrderService();

class CodOrderController {
  /**
   * GET /cod-hub/orders
   * Listar órdenes con filtros
   */
  async list(req, res) {
    try {
      const filters = {
        storeId: req.query.store_id,
        orderStatus: req.query.order_status,
        deliveryStatus: req.query.delivery_status,
        country: req.query.country,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sort_by || 'created_at',
        sortOrder: req.query.sort_order || 'DESC'
      };

      const result = await service.list(filters);
      
      res.json({
        success: true,
        data: result.orders,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`[CodOrderController] Error listing orders: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /cod-hub/orders/search
   * Buscar órdenes por término
   */
  async search(req, res) {
    try {
      const { q } = req.query;
      
      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search term must be at least 2 characters'
        });
      }

      const filters = {
        storeId: req.query.store_id,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await service.search(q, filters);
      
      res.json({
        success: true,
        data: result.orders,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`[CodOrderController] Error searching orders: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /cod-hub/orders/:id
   * Obtener orden por ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const order = await service.getById(id);
      
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      const statusCode = error.message === 'Order not found' ? 404 : 500;
      logger.error(`[CodOrderController] Error getting order: ${error.message}`);
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /cod-hub/orders
   * Crear orden COD (desde webhook)
   */
  async create(req, res) {
    try {
      const result = await service.createFromWebhook(req.body);
      
      res.status(result.created ? 201 : 200).json({
        success: true,
        created: result.created,
        data: result.order
      });
    } catch (error) {
      logger.error(`[CodOrderController] Error creating order: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * PATCH /cod-hub/orders/:id/confirm
   * Confirmar orden
   */
  async confirm(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id; // Asume middleware de auth que inyecta req.user
      
      const order = await service.confirmOrder(id, userId);
      
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      const statusCode = error.message === 'Order not found' ? 404 : 400;
      logger.error(`[CodOrderController] Error confirming order: ${error.message}`);
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * PATCH /cod-hub/orders/:id/delivery-status
   * Actualizar estado de despacho
   */
  async updateDeliveryStatus(req, res) {
    try {
      const { id } = req.params;
      const { delivery_status } = req.body;
      const userId = req.user?.id;
      
      const order = await service.updateDeliveryStatus(id, delivery_status, userId);
      
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      const statusCode = error.message === 'Order not found' ? 404 : 400;
      logger.error(`[CodOrderController] Error updating delivery status: ${error.message}`);
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * PATCH /cod-hub/orders/:id/cancel
   * Cancelar orden
   */
  async cancel(req, res) {
    try {
      const { id } = req.params;
      const { cancel_reason_id } = req.body;
      const userId = req.user?.id;
      
      const order = await service.cancelOrder(id, cancel_reason_id, userId);
      
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      const statusCode = error.message === 'Order not found' ? 404 : 400;
      logger.error(`[CodOrderController] Error cancelling order: ${error.message}`);
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * PATCH /cod-hub/orders/:id/deliver
   * Marcar como entregada
   */
  async markAsDelivered(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const order = await service.markAsDelivered(id, userId);
      
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      const statusCode = error.message === 'Order not found' ? 404 : 400;
      logger.error(`[CodOrderController] Error marking order as delivered: ${error.message}`);
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /cod-hub/orders/stats
   * Obtener estadísticas
   */
  async getStats(req, res) {
    try {
      const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
      const stats = await service.getStatistics(storeId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error(`[CodOrderController] Error getting stats: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default CodOrderController;
