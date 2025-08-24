const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireOwnershipOrAdmin } = require('../middleware/auth');
const { validateCartItem, validateQuantity } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/cart
// @desc    Obter carrinho do usuário
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const cartItems = db.prepare(`
      SELECT ci.*, p.name, p.price, p.image_url, p.is_available
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
      ORDER BY ci.created_at DESC
    `).all(req.user.id);

    // Calcular totais
    let subtotal = 0;
    let totalItems = 0;

    cartItems.forEach(item => {
      if (item.is_available) {
        subtotal += item.quantity * item.price;
        totalItems += item.quantity;
      }
    });

    res.json({
      success: true,
      data: {
        items: cartItems,
        summary: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          totalItems,
          itemCount: cartItems.length
        }
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

// @route   POST /api/cart/add
// @desc    Adicionar item ao carrinho
// @access  Private
router.post('/add', authenticateToken, validateCartItem, validateQuantity, async (req, res) => {
  try {
    const { productId, quantity, specialInstructions, customization } = req.body;

    // Verificar se o produto existe e está disponível
    const product = db.prepare('SELECT id, name, price, is_available FROM products WHERE id = ?').get(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    if (!product.is_available) {
      return res.status(400).json({
        success: false,
        message: 'Produto não está disponível'
      });
    }

    // Verificar se o item já existe no carrinho
    const existingItem = db.prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);

    if (existingItem) {
      // Atualizar quantidade
      const newQuantity = existingItem.quantity + quantity;
      db.prepare('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQuantity, existingItem.id);
      
      const updatedItem = db.prepare(`
        SELECT ci.*, p.name, p.price, p.image_url
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.id = ?
      `).get(existingItem.id);

      res.json({
        success: true,
        message: 'Quantidade atualizada no carrinho',
        data: {
          item: updatedItem
        }
      });
    } else {
      // Adicionar novo item
      const stmt = db.prepare(`
        INSERT INTO cart_items (user_id, product_id, quantity, special_instructions, customization)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(req.user.id, productId, quantity, specialInstructions || null, customization || null);
      const cartItemId = result.lastInsertRowid;

      const newItem = db.prepare(`
        SELECT ci.*, p.name, p.price, p.image_url
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.id = ?
      `).get(cartItemId);

      res.status(201).json({
        success: true,
        message: 'Item adicionado ao carrinho',
        data: {
          item: newItem
        }
      });
    }
  } catch (error) {
    console.error('Erro ao adicionar item ao carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/cart/:itemId/update
// @desc    Atualizar item do carrinho
// @access  Private
router.put('/:itemId/update', authenticateToken, requireOwnershipOrAdmin, validateQuantity, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity, specialInstructions, customization } = req.body;

    // Verificar se o item existe e pertence ao usuário
    const cartItem = db.prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?').get(itemId, req.user.id);
    
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Item do carrinho não encontrado'
      });
    }

    // Atualizar item
    const updateFields = [];
    const params = [];

    if (quantity !== undefined) {
      updateFields.push('quantity = ?');
      params.push(quantity);
    }

    if (specialInstructions !== undefined) {
      updateFields.push('special_instructions = ?');
      params.push(specialInstructions);
    }

    if (customization !== undefined) {
      updateFields.push('customization = ?');
      params.push(customization);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(itemId);

      const updateQuery = `UPDATE cart_items SET ${updateFields.join(', ')} WHERE id = ?`;
      db.prepare(updateQuery).run(...params);
    }

    // Buscar item atualizado
    const updatedItem = db.prepare(`
      SELECT ci.*, p.name, p.price, p.image_url
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).get(itemId);

    res.json({
      success: true,
      message: 'Item atualizado com sucesso',
      data: {
        item: updatedItem
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar item do carrinho:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/cart/:itemId
// @desc    Remover item do carrinho
// @access  Private
router.delete('/:itemId', authenticateToken, requireOwnershipOrAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;

    // Verificar se o item existe e pertence ao usuário
    const cartItem = db.prepare('SELECT id FROM cart_items WHERE id = ? AND user_id = ?').get(itemId, req.user.id);
    
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Item do carrinho não encontrado'
      });
    }

    // Remover item
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);

    res.json({
      success: true,
      message: 'Item removido do carrinho'
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
    // Remover todos os itens do carrinho do usuário
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);

    res.json({
      success: true,
      message: 'Carrinho limpo com sucesso'
    });
  } catch (error) {
    console.error('Erro ao limpar carrinho:', error);
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
    const cartItems = db.prepare(`
      SELECT ci.*, p.name, p.price, p.is_available, p.stock_quantity
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(req.user.id);

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Carrinho está vazio'
      });
    }

    const validationErrors = [];
    let subtotal = 0;

    cartItems.forEach(item => {
      if (!item.is_available) {
        validationErrors.push(`Produto "${item.name}" não está disponível`);
      } else if (item.stock_quantity < item.quantity) {
        validationErrors.push(`Produto "${item.name}" tem apenas ${item.stock_quantity} unidades em estoque`);
      } else {
        subtotal += item.quantity * item.price;
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Carrinho contém erros',
        errors: validationErrors
      });
    }

    res.json({
      success: true,
      message: 'Carrinho válido',
      data: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        itemCount: cartItems.length
      }
    });
  } catch (error) {
    console.error('Erro ao validar carrinho:', error);
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
    const cartItems = db.prepare(`
      SELECT ci.quantity, p.price, p.is_available
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(req.user.id);

    let subtotal = 0;
    let totalItems = 0;
    let availableItems = 0;

    cartItems.forEach(item => {
      if (item.is_available) {
        subtotal += item.quantity * item.price;
        availableItems += item.quantity;
      }
      totalItems += item.quantity;
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalItems,
          availableItems,
          subtotal: parseFloat(subtotal.toFixed(2)),
          itemCount: cartItems.length
        }
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

module.exports = router;
