const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateProduct, validatePagination, validateProductFilters } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/products
// @desc    Obter todos os produtos com filtros e paginação
// @access  Public
router.get('/', validateProductFilters, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      available,
      featured,
      popular,
      search,
      sort = 'name',
      order = 'asc'
    } = req.query;

    // Construir query SQL
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (minPrice) {
      whereClause += ' AND price >= ?';
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      whereClause += ' AND price <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (available !== undefined) {
      whereClause += ' AND is_available = ?';
      params.push(available === 'true' ? 1 : 0);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Construir ordenação
    let orderClause = 'ORDER BY ';
    if (sort === 'price') {
      orderClause += `price ${order === 'desc' ? 'DESC' : 'ASC'}`;
    } else if (sort === 'created_at') {
      orderClause += `created_at ${order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      orderClause += `name ${order === 'desc' ? 'DESC' : 'ASC'}`;
    }

    // Calcular offset para paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Executar query
    const productsQuery = `
      SELECT * FROM products 
      ${whereClause} 
      ${orderClause} 
      LIMIT ? OFFSET ?
    `;
    
    const products = db.prepare(productsQuery).all(...params, parseInt(limit), offset);

    // Contar total de produtos
    const countQuery = `SELECT COUNT(*) as total FROM products ${whereClause}`;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;

    // Calcular total de páginas
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProducts: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter produtos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/products/:id
// @desc    Obter produto específico
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Erro ao obter produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/products
// @desc    Criar novo produto (admin/staff)
// @access  Private
router.post('/', authenticateToken, requireStaff, validateProduct, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      imageUrl,
      stockQuantity,
      allergens,
      nutritionalInfo,
      preparationTime
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO products (name, description, price, category, image_url, stock_quantity, allergens, nutritional_info, preparation_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      description,
      price,
      category,
      imageUrl,
      stockQuantity || 0,
      allergens || null,
      nutritionalInfo || null,
      preparationTime || null
    );

    const productId = result.lastInsertRowid;

    // Buscar produto criado
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);

    res.status(201).json({
      success: true,
      message: 'Produto criado com sucesso',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/products/:id
// @desc    Atualizar produto (admin/staff)
// @access  Private
router.put('/:id', authenticateToken, requireStaff, validateProduct, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      category,
      imageUrl,
      stockQuantity,
      allergens,
      nutritionalInfo,
      preparationTime,
      isAvailable
    } = req.body;

    // Verificar se produto existe
    const existingProduct = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    const stmt = db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, category = ?, image_url = ?, 
          stock_quantity = ?, allergens = ?, nutritional_info = ?, preparation_time = ?, 
          is_available = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      name,
      description,
      price,
      category,
      imageUrl,
      stockQuantity || 0,
      allergens || null,
      nutritionalInfo || null,
      preparationTime || null,
      isAvailable !== undefined ? isAvailable : 1,
      id
    );

    // Buscar produto atualizado
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    res.json({
      success: true,
      message: 'Produto atualizado com sucesso',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/products/:id
// @desc    Deletar produto (admin)
// @access  Private
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se produto existe
    const existingProduct = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Deletar produto
    db.prepare('DELETE FROM products WHERE id = ?').run(id);

    res.json({
      success: true,
      message: 'Produto deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/products/categories/all
// @desc    Obter todas as categorias
// @access  Public
router.get('/categories/all', async (req, res) => {
  try {
    const categories = db.prepare('SELECT DISTINCT category FROM products WHERE is_available = 1 ORDER BY category').all();

    res.json({
      success: true,
      data: {
        categories: categories.map(cat => cat.category)
      }
    });
  } catch (error) {
    console.error('Erro ao obter categorias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/products/featured/random
// @desc    Obter produtos em destaque aleatórios
// @access  Public
router.get('/featured/random', async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const products = db.prepare(`
      SELECT * FROM products 
      WHERE is_available = 1 
      ORDER BY RANDOM() 
      LIMIT ?
    `).all(parseInt(limit));

    res.json({
      success: true,
      data: {
        products
      }
    });
  } catch (error) {
    console.error('Erro ao obter produtos em destaque:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/products/:id/toggle-availability
// @desc    Alternar disponibilidade do produto (admin/staff)
// @access  Private
router.post('/:id/toggle-availability', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se produto existe
    const existingProduct = db.prepare('SELECT id, is_available FROM products WHERE id = ?').get(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Alternar disponibilidade
    const newAvailability = existingProduct.is_available ? 0 : 1;
    
    db.prepare(`
      UPDATE products 
      SET is_available = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newAvailability, id);

    res.json({
      success: true,
      message: `Produto ${newAvailability ? 'ativado' : 'desativado'} com sucesso`,
      data: {
        isAvailable: newAvailability === 1
      }
    });
  } catch (error) {
    console.error('Erro ao alternar disponibilidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
