const express = require('express');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const { authenticateToken, requireDeliveryOwnershipOrStaff, requireStaff, requireAdmin, requireDriver } = require('../middleware/auth');
const { validateDelivery, validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/delivery/order/:orderId
// @desc    Obter informações de entrega de um pedido
// @access  Private
router.get('/order/:orderId', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Verificar se o pedido existe e pertence ao usuário
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Buscar entrega associada
    const delivery = await Delivery.findOne({ order: orderId });
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada para este pedido'
      });
    }

    res.json({
      success: true,
      data: {
        delivery: {
          _id: delivery._id,
          status: delivery.status.current,
          estimatedTime: delivery.estimatedTime,
          driver: delivery.driver,
          address: delivery.address,
          specialInstructions: delivery.specialInstructions,
          tracking: delivery.tracking
        },
        order: {
          orderNumber: order.orderNumber,
          total: order.total
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/delivery/tracking/:deliveryId
// @desc    Rastrear entrega em tempo real
// @access  Private
router.get('/tracking/:deliveryId', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const delivery = await Delivery.findById(deliveryId)
      .populate('order', 'orderNumber user')
      .populate('driver', 'name phone');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Verificar se o usuário tem acesso (dono do pedido ou staff)
    if (delivery.order.user.toString() !== req.user._id.toString() && req.user.role === 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    res.json({
      success: true,
      data: {
        delivery: {
          _id: delivery._id,
          status: delivery.status,
          estimatedTime: delivery.estimatedTime,
          driver: delivery.driver,
          address: delivery.address,
          tracking: delivery.tracking,
          distance: delivery.distance,
          specialInstructions: delivery.specialInstructions
        },
        order: {
          orderNumber: delivery.order.orderNumber
        }
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
// @desc    Criar nova entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.post('/admin/create', authenticateToken, requireStaff, validateDelivery, async (req, res) => {
  try {
    const { orderId, address, specialInstructions, priority, estimatedTime } = req.body;

    // Verificar se o pedido existe
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Verificar se já existe entrega para este pedido
    const existingDelivery = await Delivery.findOne({ order: orderId });
    if (existingDelivery) {
      return res.status(400).json({
        success: false,
        message: 'Já existe uma entrega para este pedido'
      });
    }

    // Criar nova entrega
    const delivery = new Delivery({
      order: orderId,
      user: order.user,
      address,
      specialInstructions,
      priority: priority || 'normal',
      estimatedTime: estimatedTime || new Date(Date.now() + 60 * 60 * 1000), // 1 hora por padrão
      status: {
        current: 'pending',
        history: [{
          status: 'pending',
          timestamp: new Date(),
          description: 'Entrega criada'
        }]
      }
    });

    await delivery.save();

    res.status(201).json({
      success: true,
      message: 'Entrega criada com sucesso',
      data: {
        delivery: {
          _id: delivery._id,
          status: delivery.status.current,
          estimatedTime: delivery.estimatedTime,
          address: delivery.address
        }
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

// @route   PUT /api/delivery/admin/:deliveryId/assign-driver
// @desc    Atribuir motorista à entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:deliveryId/assign-driver', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'ID do motorista é obrigatório'
      });
    }

    // Verificar se o motorista existe e tem role de driver
    const driver = await User.findOne({ _id: driverId, role: 'driver' });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Motorista não encontrado'
      });
    }

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Atribuir motorista
    delivery.driver = driverId;
    delivery.status.current = 'assigned';
    delivery.status.history.push({
      status: 'assigned',
      timestamp: new Date(),
      description: `Motorista ${driver.name} atribuído`
    });

    await delivery.save();

    res.json({
      success: true,
      message: 'Motorista atribuído com sucesso',
      data: {
        delivery: {
          _id: delivery._id,
          driver: {
            _id: driver._id,
            name: driver.name,
            phone: driver.phone
          },
          status: delivery.status.current
        }
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

// @route   PUT /api/delivery/admin/:deliveryId/update-status
// @desc    Atualizar status da entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:deliveryId/update-status', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { status, description, location } = req.body;

    if (!status || !description) {
      return res.status(400).json({
        success: false,
        message: 'Status e descrição são obrigatórios'
      });
    }

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Atualizar status
    delivery.status.current = status;
    delivery.status.history.push({
      status,
      timestamp: new Date(),
      description,
      location
    });

    // Atualizar tracking se fornecido
    if (location) {
      delivery.tracking.currentLocation = location;
      delivery.tracking.lastUpdate = new Date();
    }

    await delivery.save();

    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: {
        delivery: {
          _id: delivery._id,
          status: delivery.status.current,
          lastUpdate: delivery.status.history[delivery.status.history.length - 1]
        }
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

// @route   PUT /api/delivery/driver/:deliveryId/update-location
// @desc    Atualizar localização da entrega (Motorista)
// @access  Private (Driver)
router.put('/driver/:deliveryId/update-location', authenticateToken, requireDriver, validateMongoId, async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { latitude, longitude, address } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude e longitude são obrigatórios'
      });
    }

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Verificar se o motorista está atribuído a esta entrega
    if (delivery.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você não está atribuído a esta entrega'
      });
    }

    // Atualizar localização
    delivery.tracking.currentLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || delivery.tracking.currentLocation?.address
    };
    delivery.tracking.lastUpdate = new Date();

    // Atualizar status se estiver em trânsito
    if (delivery.status.current === 'assigned') {
      delivery.status.current = 'in_transit';
      delivery.status.history.push({
        status: 'in_transit',
        timestamp: new Date(),
        description: 'Motorista em trânsito para entrega'
      });
    }

    await delivery.save();

    res.json({
      success: true,
      message: 'Localização atualizada com sucesso',
      data: {
        delivery: {
          _id: delivery._id,
          currentLocation: delivery.tracking.currentLocation,
          lastUpdate: delivery.tracking.lastUpdate,
          status: delivery.status.current
        }
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

// @route   PUT /api/delivery/driver/:deliveryId/complete
// @desc    Marcar entrega como concluída (Motorista)
// @access  Private (Driver)
router.put('/driver/:deliveryId/complete', authenticateToken, requireDriver, validateMongoId, async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { notes, customerSignature } = req.body;

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Verificar se o motorista está atribuído a esta entrega
    if (delivery.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você não está atribuído a esta entrega'
      });
    }

    // Marcar como concluída
    delivery.status.current = 'completed';
    delivery.status.history.push({
      status: 'completed',
      timestamp: new Date(),
      description: 'Entrega concluída com sucesso',
      notes,
      customerSignature
    });

    delivery.completedAt = new Date();

    await delivery.save();

    // Atualizar status do pedido
    await Order.findByIdAndUpdate(delivery.order, {
      status: 'delivered',
      'statusHistory': {
        status: 'delivered',
        timestamp: new Date(),
        description: 'Entrega concluída'
      }
    });

    res.json({
      success: true,
      message: 'Entrega marcada como concluída',
      data: {
        delivery: {
          _id: delivery._id,
          status: delivery.status.current,
          completedAt: delivery.completedAt
        }
      }
    });
  } catch (error) {
    console.error('Erro ao concluir entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/delivery/admin/all
// @desc    Obter todas as entregas (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/all', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, driver, priority } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros
    const filters = {};
    if (status) filters['status.current'] = status;
    if (driver) filters.driver = driver;
    if (priority) filters.priority = priority;

    const deliveries = await Delivery.find(filters)
      .populate('order', 'orderNumber user total')
      .populate('user', 'name email phone')
      .populate('driver', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Delivery.countDocuments(filters);
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
// @desc    Obter estatísticas de entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/stats/summary', authenticateToken, requireStaff, async (req, res) => {
  try {
    // Estatísticas por status
    const statusStats = await Delivery.aggregate([
      {
        $group: {
          _id: '$status.current',
          count: { $sum: 1 }
        }
      }
    ]);

    // Estatísticas por prioridade
    const priorityStats = await Delivery.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Entregas por motorista
    const driverStats = await Delivery.aggregate([
      {
        $match: { driver: { $exists: true, $ne: null } }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'driver',
          foreignField: '_id',
          as: 'driverInfo'
        }
      },
      {
        $group: {
          _id: '$driver',
          driverName: { $first: '$driverInfo.name' },
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status.current', 'completed'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Tempo médio de entrega
    const avgDeliveryTime = await Delivery.aggregate([
      {
        $match: {
          status: { $elemMatch: { status: 'completed' } },
          completedAt: { $exists: true }
        }
      },
      {
        $project: {
          deliveryTime: {
            $divide: [
              { $subtract: ['$completedAt', '$createdAt'] },
              1000 * 60 * 60 // Converter para horas
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageTime: { $avg: '$deliveryTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        statusStats,
        priorityStats,
        driverStats,
        averageDeliveryTime: avgDeliveryTime[0]?.averageTime || 0
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
router.get('/driver/assigned', authenticateToken, requireDriver, async (req, res) => {
  try {
    const deliveries = await Delivery.find({ driver: req.user._id })
      .populate('order', 'orderNumber user total')
      .populate('user', 'name phone address')
      .sort({ priority: 1, createdAt: 1 });

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

// @route   PUT /api/delivery/admin/:deliveryId/update-address
// @desc    Atualizar endereço de entrega (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:deliveryId/update-address', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { address, coordinates } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Endereço é obrigatório'
      });
    }

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Atualizar endereço
    delivery.address = address;
    if (coordinates) {
      delivery.address.coordinates = coordinates;
    }

    // Recalcular distância se necessário
    if (delivery.driver && delivery.tracking.currentLocation) {
      delivery.distance = delivery.calculateDistance();
    }

    await delivery.save();

    res.json({
      success: true,
      message: 'Endereço atualizado com sucesso',
      data: {
        delivery: {
          _id: delivery._id,
          address: delivery.address,
          distance: delivery.distance
        }
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
