const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Loyalty = require('../models/Loyalty');
const { authenticateToken, requireOrderOwnershipOrStaff, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateOrder, validateMongoId, validatePagination, validateOrderFilters } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/orders/create
// @desc    Criar pedido a partir do carrinho
// @access  Private
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { customerNotes, source = 'website' } = req.body;

    // Buscar carrinho do usuário
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name price availability');

    if (!cart || cart.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Carrinho está vazio'
      });
    }

    // Validar carrinho
    const validationErrors = [];
    for (const item of cart.items) {
      const product = item.product;
      if (!product.isAvailableNow()) {
        validationErrors.push(`${product.name} não está disponível`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Alguns produtos não estão disponíveis',
        errors: validationErrors
      });
    }

    // Criar pedido
    const order = new Order({
      user: req.user._id,
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        specialInstructions: item.specialInstructions,
        customization: item.customization
      })),
      delivery: {
        type: cart.delivery.type,
        address: cart.delivery.address,
        instructions: cart.delivery.instructions,
        preferredTime: cart.delivery.preferredTime,
        specificTime: cart.delivery.specificTime,
        deliveryFee: cart.delivery.deliveryFee
      },
      payment: {
        method: cart.payment.method,
        amount: cart.totals.subtotal,
        tax: cart.totals.tax,
        discount: cart.totals.discount,
        loyaltyDiscount: cart.totals.loyaltyDiscount,
        finalAmount: cart.totals.total
      },
      customerNotes,
      source
    });

    // Calcular total
    order.calculateTotal();

    // Calcular pontos de fidelidade
    order.calculateLoyaltyPoints();

    // Aplicar desconto de fidelidade se aplicável
    const loyalty = await Loyalty.findOne({ user: req.user._id });
    if (loyalty) {
      const discountPercentage = loyalty.getLoyaltyDiscount();
      if (discountPercentage > 0) {
        order.applyLoyaltyDiscount(discountPercentage);
      }
    }

    await order.save();

    // Limpar carrinho
    await cart.clearCart();

    // Buscar pedido com produtos populados
    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images price');

    res.status(201).json({
      success: true,
      message: 'Pedido criado com sucesso',
      data: {
        order: populatedOrder
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
router.get('/', authenticateToken, validateOrderFilters, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      deliveryType
    } = req.query;

    // Construir filtros
    const filters = { user: req.user._id };

    if (status) {
      filters['status.current'] = status;
    }

    if (startDate || endDate) {
      filters['timing.orderPlaced'] = {};
      if (startDate) filters['timing.orderPlaced'].$gte = new Date(startDate);
      if (endDate) filters['timing.orderPlaced'].$lte = new Date(endDate);
    }

    if (deliveryType) {
      filters['delivery.type'] = deliveryType;
    }

    // Calcular skip para paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Executar query
    const orders = await Order.find(filters)
      .sort({ 'timing.orderPlaced': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items.product', 'name images price');

    // Contar total de pedidos
    const total = await Order.countDocuments(filters);

    // Calcular total de páginas
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

// @route   GET /api/orders/:id
// @desc    Obter pedido por ID
// @access  Private
router.get('/:id', authenticateToken, requireOrderOwnershipOrStaff, validateMongoId, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone address')
      .populate('items.product', 'name images price category')
      .populate('status.history.updatedBy', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        order
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

// @route   PUT /api/orders/:id/status
// @desc    Atualizar status do pedido
// @access  Private (Staff/Admin)
router.put('/:id/status', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status é obrigatório'
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Atualizar status
    await order.updateStatus(status, note, req.user._id);

    // Buscar pedido atualizado
    const updatedOrder = await Order.findById(order._id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images price');

    res.json({
      success: true,
      message: 'Status do pedido atualizado com sucesso',
      data: {
        order: updatedOrder
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

// @route   DELETE /api/orders/:id
// @desc    Cancelar pedido
// @access  Private
router.delete('/:id', authenticateToken, requireOrderOwnershipOrStaff, validateMongoId, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Verificar se pode ser cancelado
    const cancelableStatuses = ['pending', 'confirmed'];
    if (!cancelableStatuses.includes(order.status.current)) {
      return res.status(400).json({
        success: false,
        message: 'Pedido não pode ser cancelado neste estado'
      });
    }

    // Cancelar pedido
    await order.updateStatus('cancelled', 'Cancelado pelo cliente', req.user._id);

    res.json({
      success: true,
      message: 'Pedido cancelado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/orders/admin/all
// @desc    Obter todos os pedidos (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/all', authenticateToken, requireStaff, validateOrderFilters, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      deliveryType,
      userId
    } = req.query;

    // Construir filtros
    const filters = {};

    if (status) {
      filters['status.current'] = status;
    }

    if (startDate || endDate) {
      filters['timing.orderPlaced'] = {};
      if (startDate) filters['timing.orderPlaced'].$gte = new Date(startDate);
      if (endDate) filters['timing.orderPlaced'].$lte = new Date(endDate);
    }

    if (deliveryType) {
      filters['delivery.type'] = deliveryType;
    }

    if (userId) {
      filters.user = userId;
    }

    // Calcular skip para paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Executar query
    const orders = await Order.find(filters)
      .sort({ 'timing.orderPlaced': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email phone')
      .populate('items.product', 'name images price');

    // Contar total de pedidos
    const total = await Order.countDocuments(filters);

    // Calcular total de páginas
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

// @route   GET /api/orders/stats/summary
// @desc    Obter estatísticas dos pedidos
// @access  Private (Staff/Admin)
router.get('/stats/summary', authenticateToken, requireStaff, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Estatísticas do dia
    const todayStats = await Order.aggregate([
      {
        $match: {
          'timing.orderPlaced': { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalRevenue: { $sum: '$payment.finalAmount' },
          averageOrderValue: { $avg: '$payment.finalAmount' }
        }
      }
    ]);

    // Estatísticas do mês
    const monthStats = await Order.aggregate([
      {
        $match: {
          'timing.orderPlaced': { $gte: thisMonth }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalRevenue: { $sum: '$payment.finalAmount' },
          averageOrderValue: { $avg: '$payment.finalAmount' }
        }
      }
    ]);

    // Pedidos por status
    const statusStats = await Order.aggregate([
      {
        $group: {
          _id: '$status.current',
          count: { $sum: 1 }
        }
      }
    ]);

    // Pedidos por tipo de entrega
    const deliveryStats = await Order.aggregate([
      {
        $group: {
          _id: '$delivery.type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        today: todayStats[0] || { count: 0, totalRevenue: 0, averageOrderValue: 0 },
        month: monthStats[0] || { count: 0, totalRevenue: 0, averageOrderValue: 0 },
        byStatus: statusStats,
        byDeliveryType: deliveryStats
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

// @route   POST /api/orders/:id/refund
// @desc    Processar reembolso
// @access  Private (Admin)
router.post('/:id/refund', authenticateToken, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const { reason, amount } = req.body;

    if (!reason || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Motivo e valor são obrigatórios'
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    if (order.payment.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Pedido não foi pago'
      });
    }

    // Atualizar status para reembolsado
    await order.updateStatus('refunded', `Reembolso: ${reason}`, req.user._id);

    // TODO: Processar reembolso com gateway de pagamento

    res.json({
      success: true,
      message: 'Reembolso processado com sucesso',
      data: {
        order: {
          _id: order._id,
          status: order.status.current,
          refundAmount: amount
        }
      }
    });
  } catch (error) {
    console.error('Erro ao processar reembolso:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/orders/tracking/:orderNumber
// @desc    Rastrear pedido por número
// @access  Public
router.get('/tracking/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber })
      .select('orderNumber status timing delivery user')
      .populate('user', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    const trackingInfo = {
      orderNumber: order.orderNumber,
      status: order.status.current,
      statusHistory: order.status.history,
      timing: order.timing,
      delivery: {
        type: order.delivery.type,
        address: order.delivery.address
      },
      customerName: order.user.name
    };

    res.json({
      success: true,
      data: {
        tracking: trackingInfo
      }
    });
  } catch (error) {
    console.error('Erro ao rastrear pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
