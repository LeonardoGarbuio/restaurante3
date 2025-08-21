const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso não fornecido'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    // Buscar usuário
    const user = db.prepare('SELECT id, name, email, phone, street, city, postal_code, role, loyalty_points, loyalty_tier, is_active, created_at FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }

    // Adicionar usuário ao request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    console.error('Erro na autenticação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acesso negado'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores podem aceder a este recurso.'
    });
  }

  next();
};

// Middleware para verificar se é staff ou admin
const requireStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acesso negado'
    });
  }

  if (!['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas funcionários podem aceder a este recurso.'
    });
  }

  next();
};

// Middleware para verificar se é motorista
const requireDriver = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acesso negado'
    });
  }

  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas motoristas podem aceder a este recurso.'
    });
  }

  next();
};

// Middleware para verificar se é o próprio usuário ou admin
const requireOwnershipOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acesso negado'
    });
  }

  const requestedUserId = req.params.userId || req.params.id;
  
  if (req.user.role === 'admin' || req.user.id.toString() === requestedUserId) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Só pode aceder aos seus próprios dados.'
    });
  }
};

// Middleware para verificar se é o proprietário do pedido ou staff
const requireOrderOwnershipOrStaff = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Staff e admin podem aceder a qualquer pedido
    if (['admin', 'staff'].includes(req.user.role)) {
      return next();
    }

    const orderId = req.params.orderId || req.params.id;
    
    const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    // Verificar se o usuário é o proprietário do pedido
    if (order.user_id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Só pode aceder aos seus próprios pedidos.'
      });
    }

    next();
  } catch (error) {
    console.error('Erro na verificação de propriedade do pedido:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar se é o proprietário do carrinho ou staff
const requireCartOwnershipOrStaff = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Staff e admin podem aceder a qualquer carrinho
    if (['admin', 'staff'].includes(req.user.role)) {
      return next();
    }

    const cartId = req.params.cartId || req.params.id;
    
    const cart = db.prepare('SELECT user_id FROM cart_items WHERE id = ?').get(cartId);
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    // Verificar se o usuário é o proprietário do carrinho
    if (cart.user_id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Só pode aceder ao seu próprio carrinho.'
      });
    }

    next();
  } catch (error) {
    console.error('Erro na verificação de propriedade do carrinho:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar se é o proprietário da entrega ou staff
const requireDeliveryOwnershipOrStaff = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Staff, admin e motoristas podem aceder a qualquer entrega
    if (['admin', 'staff', 'driver'].includes(req.user.role)) {
      return next();
    }

    const deliveryId = req.params.deliveryId || req.params.id;
    
    const delivery = db.prepare('SELECT order_id FROM deliveries WHERE id = ?').get(deliveryId);
    
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Entrega não encontrada'
      });
    }

    // Verificar se o usuário é o proprietário da entrega (através do pedido)
    const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(delivery.order_id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado'
      });
    }

    if (order.user_id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Só pode aceder às suas próprias entregas.'
      });
    }

    next();
  } catch (error) {
    console.error('Erro na verificação de propriedade da entrega:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar se é o proprietário da fidelidade ou staff
const requireLoyaltyOwnershipOrStaff = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Staff e admin podem aceder a qualquer fidelidade
    if (['admin', 'staff'].includes(req.user.role)) {
      return next();
    }

    const loyaltyId = req.params.loyaltyId || req.params.id;
    
    const loyalty = db.prepare('SELECT user_id FROM loyalty_transactions WHERE id = ?').get(loyaltyId);
    
    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Fidelidade não encontrada'
      });
    }

    // Verificar se o usuário é o proprietário da fidelidade
    if (loyalty.user_id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Só pode aceder à sua própria fidelidade.'
      });
    }

    next();
  } catch (error) {
    console.error('Erro na verificação de propriedade da fidelidade:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireStaff,
  requireDriver,
  requireOwnershipOrAdmin,
  requireOrderOwnershipOrStaff,
  requireCartOwnershipOrStaff,
  requireDeliveryOwnershipOrStaff,
  requireLoyaltyOwnershipOrStaff
};
