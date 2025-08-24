const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireStaff, requireAdmin, requireOwnershipOrAdmin } = require('../middleware/auth');
const { validateOrder, validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/orders
// @desc    Criar novo pedido
// @access  Private
router.post('/', authenticateToken, validateOrder, async (req, res) => {
  try {
    const {
      deliveryType,
      deliveryAddress,
      deliveryInstructions,
      preferredTime,
      specificTime,
      paymentMethod,
      customerNotes,
      items
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Carrinho está vazio'
      });
    }

    // Gerar número do pedido
    const orderNumber = `SP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Calcular totais
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = db.prepare('SELECT id, name, price, is_available FROM products WHERE id = ?').get(item.productId);
      
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Produto ${item.productId} não encontrado`
        });
      }

      if (!product.is_available) {
        return res.status(400).json({
          success: false,
          message: `Produto ${product.name} não está disponível`
        });
      }

      const itemTotal = item.quantity * product.price;
      subtotal += itemTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
        specialInstructions: item.specialInstructions,
        customization: item.customization
      });
    }

    const deliveryFee = deliveryType === 'delivery' ? 2.50 : 0;
    const tax = subtotal * 0.23; // IVA 23%
    const finalAmount = subtotal + deliveryFee + tax;

    // Inserir pedido
    const orderStmt = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, delivery_type, delivery_street, delivery_city, 
        delivery_postal_code, delivery_instructions, preferred_time, specific_time,
        payment_method, subtotal, tax, delivery_fee, final_amount, customer_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const orderResult = orderStmt.run(
      orderNumber,
      req.user.id,
      deliveryType,
      deliveryAddress?.street || '',
      deliveryAddress?.city || '',
      deliveryAddress?.postalCode || '',
      deliveryInstructions || null,
      preferredTime || 'asap',
      specificTime || null,
      paymentMethod,
      subtotal,
      tax,
      deliveryFee,
      finalAmount,
      customerNotes || null
    );

    const orderId = orderResult.lastInsertRowid;

    // Inserir itens do pedido
    const itemStmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, special_instructions, customization)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of orderItems) {
      itemStmt.run(
        orderId,
        item.productId,
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        item.specialInstructions || null,
        item.customization || null
      );
    }

    // Limpar carrinho
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);

    // Buscar pedido criado
    const order = db.prepare(`
      SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(orderId);

    res.status(201).json({
      success: true,
      message: 'Pedido criado com sucesso',
      data: {
        order
      }
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/orders
// @desc    Obter pedidos do usuário
// @access  Private
router.get('/', authenticateToken, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir query
    let whereClause = 'WHERE o.user_id = ?';
    const params = [req.user.id];

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    const ordersQuery = `
      SELECT o.*, u.name as customer_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const orders = db.prepare(ordersQuery).all(...params, parseInt(limit), offset);

    // Contar total de pedidos
    const countQuery = `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/orders/:orderId
// @desc    Obter pedido específico
// @access  Private
router.get('/:orderId', authenticateToken, requireOwnershipOrAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = db.prepare(`
      SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Obter itens do pedido
    const orderItems = db.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(orderId);

    // Obter histórico de status
    const statusHistory = db.prepare(`
      SELECT osh.*, u.name as updated_by_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.updated_by = u.id
      WHERE osh.order_id = ?
      ORDER BY osh.timestamp DESC
    `).all(orderId);

    res.json({
      success: true,
      data: {
        order: {
          ...order,
          items: orderItems,
          statusHistory
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/orders/:orderId/status
// @desc    Atualizar status do pedido (Staff/Admin)
// @access  Private (Staff/Admin)
router.put('/:orderId/status', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note } = req.body;

    // Verificar se o pedido existe
    const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Atualizar status
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, orderId);

    // Registrar no histórico
    const historyStmt = db.prepare(`
      INSERT INTO order_status_history (order_id, status, note, updated_by)
      VALUES (?, ?, ?, ?)
    `);

    historyStmt.run(orderId, status, note || null, req.user.id);

    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: {
        orderId,
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

// @route   GET /api/orders/admin/all
// @desc    Obter todos os pedidos (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/all', authenticateToken, requireStaff, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, deliveryType, paymentStatus } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir query
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    if (deliveryType) {
      whereClause += ' AND o.delivery_type = ?';
      params.push(deliveryType);
    }

    if (paymentStatus) {
      whereClause += ' AND o.payment_status = ?';
      params.push(paymentStatus);
    }

    const ordersQuery = `
      SELECT o.*, u.name as customer_name, u.phone as customer_phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const orders = db.prepare(ordersQuery).all(...params, parseInt(limit), offset);

    // Contar total de pedidos
    const countQuery = `SELECT COUNT(*) as total FROM orders o ${whereClause}`;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/orders/admin/stats/summary
// @desc    Obter estatísticas de pedidos (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/stats/summary', authenticateToken, requireStaff, async (req, res) => {
  try {
    // Total de pedidos
    const totalOrders = db.prepare('SELECT COUNT(*) as total FROM orders').get().total;
    const pendingOrders = db.prepare('SELECT COUNT(*) as total FROM orders WHERE status = "pending"').get().total;
    const completedOrders = db.prepare('SELECT COUNT(*) as total FROM orders WHERE status = "delivered"').get().total;

    // Pedidos por status
    const statusStats = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status
    `).all();

    // Pedidos por mês (últimos 12 meses)
    const monthlyOrders = db.prepare(`
      SELECT strftime('%m', created_at) as month, COUNT(*) as count 
      FROM orders 
      WHERE created_at >= date('now', 'start of year')
      GROUP BY strftime('%m', created_at)
      ORDER BY month
    `).all();

    // Receita total
    const totalRevenue = db.prepare('SELECT SUM(final_amount) as total FROM orders WHERE status = "delivered"').get().total || 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalOrders,
          pendingOrders,
          completedOrders,
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          statusDistribution: statusStats,
          monthlyOrders
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

module.exports = router;
