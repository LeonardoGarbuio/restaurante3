const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticateToken, requireCartOwnershipOrStaff } = require('../middleware/auth');
const { validateCartItem, validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/cart
// @desc    Obter carrinho do usuário
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name images price category availability');

    if (!cart) {
      // Criar carrinho vazio se não existir
      cart = new Cart({
        user: req.user._id,
        items: [],
        delivery: {
          type: 'delivery',
          address: req.user.address
        }
      });
      await cart.save();
    }

    // Verificar disponibilidade dos produtos
    const updatedItems = cart.items.map(item => {
      const product = item.product;
      if (product) {
        return {
          ...item.toObject(),
          product: {
            ...product.toObject(),
            isAvailable: product.isAvailableNow()
          }
        };
      }
      return item;
    });

    cart.items = updatedItems;
    await cart.save();

    res.json({
      success: true,
      data: {
        cart
      }
    });
  } catch (error) {
    console.error('Erro ao obter carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/cart/add-item
// @desc    Adicionar item ao carrinho
// @access  Private
router.post('/add-item', authenticateToken, validateCartItem, async (req, res) => {
  try {
    const { productId, quantity, specialInstructions, customization } = req.body;

    // Verificar se o produto existe e está disponível
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    if (!product.isAvailableNow()) {
      return res.status(400).json({
        success: false,
        message: 'Produto não está disponível neste momento'
      });
    }

    // Verificar quantidade máxima
    if (quantity > product.availability.maxOrderQuantity) {
      return res.status(400).json({
        success: false,
        message: `Quantidade máxima permitida é ${product.availability.maxOrderQuantity}`
      });
    }

    // Buscar ou criar carrinho
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: [],
        delivery: {
          type: 'delivery',
          address: req.user.address
        }
      });
    }

    // Adicionar item
    await cart.addItem(productId, quantity, product.price, specialInstructions, customization);

    // Buscar carrinho atualizado com produtos populados
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price category availability');

    res.json({
      success: true,
      message: 'Item adicionado ao carrinho com sucesso',
      data: {
        cart: updatedCart
      }
    });
  } catch (error) {
    console.error('Erro ao adicionar item ao carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/cart/update-item/:productId
// @desc    Atualizar quantidade de um item no carrinho
// @access  Private
router.put('/update-item/:productId', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { quantity } = req.body;
    const { productId } = req.params;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantidade deve ser pelo menos 1'
      });
    }

    // Verificar se o produto existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Verificar quantidade máxima
    if (quantity > product.availability.maxOrderQuantity) {
      return res.status(400).json({
        success: false,
        message: `Quantidade máxima permitida é ${product.availability.maxOrderQuantity}`
      });
    }

    // Buscar carrinho
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    // Atualizar quantidade
    await cart.updateItemQuantity(productId, quantity);

    // Buscar carrinho atualizado
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price category availability');

    res.json({
      success: true,
      message: 'Quantidade atualizada com sucesso',
      data: {
        cart: updatedCart
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar quantidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/cart/remove-item/:productId
// @desc    Remover item do carrinho
// @access  Private
router.delete('/remove-item/:productId', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { productId } = req.params;

    // Buscar carrinho
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    // Remover item
    await cart.removeItem(productId);

    // Buscar carrinho atualizado
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price category availability');

    res.json({
      success: true,
      message: 'Item removido do carrinho com sucesso',
      data: {
        cart: updatedCart
      }
    });
  } catch (error) {
    console.error('Erro ao remover item do carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/cart/clear
// @desc    Limpar carrinho
// @access  Private
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    await cart.clearCart();

    res.json({
      success: true,
      message: 'Carrinho limpo com sucesso',
      data: {
        cart
      }
    });
  } catch (error) {
    console.error('Erro ao limpar carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/cart/delivery
// @desc    Atualizar informações de entrega do carrinho
// @access  Private
router.put('/delivery', authenticateToken, async (req, res) => {
  try {
    const { type, address, instructions, preferredTime, specificTime } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    // Atualizar informações de entrega
    if (type) cart.delivery.type = type;
    if (address) cart.delivery.address = address;
    if (instructions) cart.delivery.instructions = instructions;
    if (preferredTime) cart.delivery.preferredTime = preferredTime;
    if (specificTime) cart.delivery.specificTime = specificTime;

    // Calcular taxa de entrega baseada no tipo e endereço
    if (type === 'delivery' && address) {
      // Simular cálculo de taxa de entrega
      cart.delivery.deliveryFee = 2.50; // Taxa fixa por enquanto
    } else if (type === 'pickup' || type === 'dine-in') {
      cart.delivery.deliveryFee = 0;
    }

    await cart.save();

    // Buscar carrinho atualizado
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price category availability');

    res.json({
      success: true,
      message: 'Informações de entrega atualizadas com sucesso',
      data: {
        cart: updatedCart
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/cart/payment
// @desc    Atualizar método de pagamento do carrinho
// @access  Private
router.put('/payment', authenticateToken, async (req, res) => {
  try {
    const { method, loyaltyPointsUsed } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    // Atualizar método de pagamento
    if (method) cart.payment.method = method;
    if (loyaltyPointsUsed !== undefined) {
      await cart.useLoyaltyPoints(loyaltyPointsUsed);
    }

    // Buscar carrinho atualizado
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price category availability');

    res.json({
      success: true,
      message: 'Método de pagamento atualizado com sucesso',
      data: {
        cart: updatedCart
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar pagamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/cart/apply-discount
// @desc    Aplicar desconto ao carrinho
// @access  Private
router.post('/apply-discount', authenticateToken, async (req, res) => {
  try {
    const { discountAmount, discountCode } = req.body;

    if (!discountAmount && !discountCode) {
      return res.status(400).json({
        success: false,
        message: 'Valor de desconto ou código é obrigatório'
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    // TODO: Implementar validação de códigos de desconto
    if (discountCode) {
      // Simular validação de código
      if (discountCode === 'WELCOME10') {
        await cart.applyDiscount(10);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Código de desconto inválido'
        });
      }
    } else if (discountAmount) {
      await cart.applyDiscount(parseFloat(discountAmount));
    }

    // Buscar carrinho atualizado
    const updatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name images price category availability');

    res.json({
      success: true,
      message: 'Desconto aplicado com sucesso',
      data: {
        cart: updatedCart
      }
    });
  } catch (error) {
    console.error('Erro ao aplicar desconto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/cart/summary
// @desc    Obter resumo do carrinho
// @access  Private
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name images price');

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    const summary = {
      itemCount: cart.getItemCount(),
      subtotal: cart.totals.subtotal,
      deliveryFee: cart.totals.deliveryFee,
      tax: cart.totals.tax,
      discount: cart.totals.discount,
      loyaltyDiscount: cart.totals.loyaltyDiscount,
      total: cart.totals.total,
      isEmpty: cart.isEmpty(),
      deliveryType: cart.delivery.type,
      paymentMethod: cart.payment.method
    };

    res.json({
      success: true,
      data: {
        summary
      }
    });
  } catch (error) {
    console.error('Erro ao obter resumo do carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/cart/validate
// @desc    Validar carrinho antes do checkout
// @access  Private
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name availability price');

    if (!cart || cart.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Carrinho está vazio'
      });
    }

    const validationErrors = [];
    const warnings = [];

    // Verificar cada item
    for (const item of cart.items) {
      const product = item.product;
      
      if (!product) {
        validationErrors.push(`Produto não encontrado: ${item._id}`);
        continue;
      }

      if (!product.isAvailableNow()) {
        validationErrors.push(`${product.name} não está disponível neste momento`);
      }

      if (product.availability.stockQuantity !== -1 && 
          item.quantity > product.availability.stockQuantity) {
        validationErrors.push(`${product.name} - quantidade solicitada (${item.quantity}) excede stock disponível (${product.availability.stockQuantity})`);
      }

      if (item.quantity < product.availability.minOrderQuantity) {
        validationErrors.push(`${product.name} - quantidade mínima é ${product.availability.minOrderQuantity}`);
      }

      if (item.quantity > product.availability.maxOrderQuantity) {
        validationErrors.push(`${product.name} - quantidade máxima é ${product.availability.maxOrderQuantity}`);
      }
    }

    // Verificar endereço para entrega
    if (cart.delivery.type === 'delivery' && !cart.delivery.address) {
      validationErrors.push('Endereço de entrega é obrigatório');
    }

    // Verificar valor mínimo
    if (cart.totals.subtotal < 15) {
      warnings.push('Pedido mínimo é €15.00');
    }

    const isValid = validationErrors.length === 0;

    res.json({
      success: true,
      data: {
        isValid,
        errors: validationErrors,
        warnings,
        cart: {
          _id: cart._id,
          itemCount: cart.getItemCount(),
          total: cart.totals.total
        }
      }
    });
  } catch (error) {
    console.error('Erro na validação do carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/cart/:id
// @desc    Obter carrinho por ID (para staff/admin)
// @access  Private (Staff/Admin)
router.get('/:id', authenticateToken, requireCartOwnershipOrStaff, async (req, res) => {
  try {
    const cart = await Cart.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images price category');

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Carrinho não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        cart
      }
    });
  } catch (error) {
    console.error('Erro ao obter carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
