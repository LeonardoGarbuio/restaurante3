const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateDelivery, validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/delivery/order/:orderId
// @desc    Obter informações de entrega de um pedido
// @access  Private
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Verificar se o usuário tem acesso ao pedido
    const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    if (order.user_id !== req.user.id && req.user.role === 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Buscar informações de entrega
    const delivery = db.prepare(`
      SELECT d.*, o.order_number, o.delivery_type, o.delivery_street, o.delivery_city, o.delivery_postal_code,
             u.name as customer_name, u.phone as customer_phone,
             driver.name as driver_name, driver.phone as driver_phone
      FROM deliveries d
      JOIN orders o ON d.order_id = o.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN users driver ON d.driver_id = driver.id
      WHERE d.order_id = ?
    `).get(orderId);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        delivery
      }
    });
  } catch (error) {
    console.error('Erro ao obter informações de entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/delivery/tracking/:orderId
// @desc    Rastrear entrega em tempo real
// @access  Private
router.get('/tracking/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Verificar se o usuário tem acesso ao pedido
    const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    if (order.user_id !== req.user.id && req.user.role === 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Buscar informações de rastreamento
    const tracking = db.prepare(`
      SELECT d.status, d.current_lat, d.current_lng, d.estimated_delivery, d.actual_delivery,
             d.pickup_time, d.delivery_time, d.notes,
             o.order_number, o.delivery_street, o.delivery_city
      FROM deliveries d
      JOIN orders o ON d.order_id = o.id
      WHERE d.order_id = ?
    `).get(orderId);

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        tracking
      }
    });
  } catch (error) {
    console.error('Erro ao rastrear entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/delivery/admin/create
// @desc    Criar entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.post('/admin/create', authenticateToken, requireStaff, validateDelivery, async (req, res) => {
  try {
    const { orderId, driverId, estimatedDelivery, notes } = req.body;

    // Verificar se o pedido existe
    const order = db.prepare('SELECT id, delivery_type FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    if (order.delivery_type === 'pickup' || order.delivery_type === 'dine-in') {
      return res.status(400).json({
        success: false,
        message: 'Pedido não é para entrega'
      });
    }

    // Verificar se já existe entrega para este pedido
    const existingDelivery = db.prepare('SELECT id FROM deliveries WHERE order_id = ?').get(orderId);
    if (existingDelivery) {
      return res.status(400).json({
        success: false,
        message: 'Já existe entrega para este pedido'
      });
    }

    // Criar entrega
    const stmt = db.prepare(`
      INSERT INTO deliveries (order_id, driver_id, estimated_delivery, notes)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(orderId, driverId || null, estimatedDelivery || null, notes || null);
    const deliveryId = result.lastInsertRowid;

    // Buscar entrega criada
    const delivery = db.prepare(`
      SELECT d.*, o.order_number, u.name as customer_name
      FROM deliveries d
      JOIN orders o ON d.order_id = o.id
      JOIN users u ON o.user_id = u.id
      WHERE d.id = ?
    `).get(deliveryId);

    res.status(201).json({
      success: true,
      message: 'Entrega criada com sucesso',
      data: {
        delivery
      }
    });
  } catch (error) {
    console.error('Erro ao criar entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/delivery/admin/assign-driver
// @desc    Atribuir motorista à entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/assign-driver', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { deliveryId, driverId } = req.body;

    // Verificar se a entrega existe
    const delivery = db.prepare('SELECT id, status FROM deliveries WHERE id = ?').get(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Verificar se o motorista existe e tem role correto
    const driver = db.prepare('SELECT id, name, role FROM users WHERE id = ? AND role = "driver"').get(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Motorista não encontrado'
      });
    }

    // Atualizar entrega
    db.prepare(`
      UPDATE deliveries 
      SET driver_id = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(driverId, deliveryId);

    res.json({
      success: true,
      message: 'Motorista atribuído com sucesso',
      data: {
        deliveryId,
        driverId,
        driverName: driver.name
      }
    });
  } catch (error) {
    console.error('Erro ao atribuir motorista:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/delivery/admin/update-status
// @desc    Atualizar status da entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/update-status', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { deliveryId, status, notes } = req.body;

    // Verificar se a entrega existe
    const delivery = db.prepare('SELECT id FROM deliveries WHERE id = ?').get(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Atualizar status
    const updateFields = [];
    const params = [];

    if (status) {
      updateFields.push('status = ?');
      params.push(status);
    }

    if (notes) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(deliveryId);

      const updateQuery = `UPDATE deliveries SET ${updateFields.join(', ')} WHERE id = ?`;
      db.prepare(updateQuery).run(...params);
    }

    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: {
        deliveryId,
        newStatus: status
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/delivery/driver/update-location
// @desc    Atualizar localização do motorista (Driver)
// @access  Private (Driver)
router.put('/driver/update-location', authenticateToken, async (req, res) => {
  try {
    const { deliveryId, lat, lng } = req.body;

    // Verificar se o usuário é motorista
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado - apenas motoristas'
      });
    }

    // Verificar se a entrega existe e está atribuída ao motorista
    const delivery = db.prepare('SELECT id FROM deliveries WHERE id = ? AND driver_id = ?').get(deliveryId, req.user.id);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada ou não atribuída'
      });
    }

    // Atualizar localização
    db.prepare(`
      UPDATE deliveries 
      SET current_lat = ?, current_lng = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(lat, lng, deliveryId);

    res.json({
      success: true,
      message: 'Localização atualizada com sucesso',
      data: {
        deliveryId,
        location: { lat, lng }
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar localização:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/delivery/driver/complete
// @desc    Marcar entrega como concluída (Driver)
// @access  Private (Driver)
router.put('/driver/complete', authenticateToken, async (req, res) => {
  try {
    const { deliveryId } = req.body;

    // Verificar se o usuário é motorista
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado - apenas motoristas'
      });
    }

    // Verificar se a entrega existe e está atribuída ao motorista
    const delivery = db.prepare('SELECT id FROM deliveries WHERE id = ? AND driver_id = ?').get(deliveryId, req.user.id);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada ou não atribuída'
      });
    }

    // Marcar como entregue
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE deliveries 
      SET status = 'delivered', delivery_time = ?, actual_delivery = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(now, now, deliveryId);

    // Atualizar status do pedido
    db.prepare(`
      UPDATE orders 
      SET status = 'delivered', actual_delivery = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = (SELECT order_id FROM deliveries WHERE id = ?)
    `).run(now, deliveryId);

    res.json({
      success: true,
      message: 'Entrega marcada como concluída',
      data: {
        deliveryId,
        completedAt: now
      }
    });
  } catch (error) {
    console.error('Erro ao completar entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/delivery/admin/all
// @desc    Obter todas as entregas (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/all', authenticateToken, requireStaff, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, driverId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir query
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    if (driverId) {
      whereClause += ' AND d.driver_id = ?';
      params.push(driverId);
    }

    const deliveriesQuery = `
      SELECT d.*, o.order_number, o.delivery_street, o.delivery_city,
             u.name as customer_name, u.phone as customer_phone,
             driver.name as driver_name
      FROM deliveries d
      JOIN orders o ON d.order_id = o.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN users driver ON d.driver_id = driver.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const deliveries = db.prepare(deliveriesQuery).all(...params, parseInt(limit), offset);

    // Contar total de entregas
    const countQuery = `SELECT COUNT(*) as total FROM deliveries d ${whereClause}`;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        deliveries,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalDeliveries: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter entregas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/delivery/admin/stats/summary
// @desc    Obter estatísticas de entregas (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/stats/summary', authenticateToken, requireStaff, async (req, res) => {
  try {
    // Total de entregas
    const totalDeliveries = db.prepare('SELECT COUNT(*) as total FROM deliveries').get().total;
    const pendingDeliveries = db.prepare('SELECT COUNT(*) as total FROM deliveries WHERE status = "pending"').get().total;
    const inProgressDeliveries = db.prepare('SELECT COUNT(*) as total FROM deliveries WHERE status IN ("assigned", "picked_up", "in_transit")').get().total;
    const completedDeliveries = db.prepare('SELECT COUNT(*) as total FROM deliveries WHERE status = "delivered"').get().total;

    // Entregas por status
    const statusStats = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM deliveries 
      GROUP BY status
    `).all();

    // Entregas por mês (últimos 12 meses)
    const monthlyDeliveries = db.prepare(`
      SELECT strftime('%m', created_at) as month, COUNT(*) as count 
      FROM deliveries 
      WHERE created_at >= date('now', 'start of year')
      GROUP BY strftime('%m', created_at)
      ORDER BY month
    `).all();

    // Motoristas ativos
    const activeDrivers = db.prepare(`
      SELECT COUNT(DISTINCT driver_id) as count 
      FROM deliveries 
      WHERE driver_id IS NOT NULL AND status IN ('assigned', 'picked_up', 'in_transit')
    `).get().count;

    res.json({
      success: true,
      data: {
        summary: {
          totalDeliveries,
          pendingDeliveries,
          inProgressDeliveries,
          completedDeliveries,
          activeDrivers,
          statusDistribution: statusStats,
          monthlyDeliveries
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/delivery/driver/assigned
// @desc    Obter entregas atribuídas ao motorista
// @access  Private (Driver)
router.get('/driver/assigned', authenticateToken, async (req, res) => {
  try {
    // Verificar se o usuário é motorista
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado - apenas motoristas'
      });
    }

    const deliveries = db.prepare(`
      SELECT d.*, o.order_number, o.delivery_street, o.delivery_city, o.delivery_postal_code,
             u.name as customer_name, u.phone as customer_phone
      FROM deliveries d
      JOIN orders o ON d.order_id = o.id
      JOIN users u ON o.user_id = u.id
      WHERE d.driver_id = ? AND d.status IN ('assigned', 'picked_up', 'in_transit')
      ORDER BY d.created_at ASC
    `).all(req.user.id);

    res.json({
      success: true,
      data: {
        deliveries
      }
    });
  } catch (error) {
    console.error('Erro ao obter entregas atribuídas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/delivery/admin/address
// @desc    Atualizar endereço de entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/address', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { orderId, street, city, postalCode, instructions } = req.body;

    // Verificar se o pedido existe
    const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Atualizar endereço do pedido
    const updateFields = [];
    const params = [];

    if (street) {
      updateFields.push('delivery_street = ?');
      params.push(street);
    }

    if (city) {
      updateFields.push('delivery_city = ?');
      params.push(city);
    }

    if (postalCode) {
      updateFields.push('delivery_postal_code = ?');
      params.push(postalCode);
    }

    if (instructions) {
      updateFields.push('delivery_instructions = ?');
      params.push(instructions);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(orderId);

      const updateQuery = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`;
      db.prepare(updateQuery).run(...params);
    }

    res.json({
      success: true,
      message: 'Endereço atualizado com sucesso',
      data: {
        orderId,
        address: { street, city, postalCode, instructions }
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar endereço:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
