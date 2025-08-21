const express = require('express');
const Product = require('../models/Product');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateProduct, validateMongoId, validatePagination, validateProductFilters } = require('../middleware/validation');

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

    // Construir filtros
    const filters = {};

    if (category) {
      filters.category = category;
    }

    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = parseFloat(minPrice);
      if (maxPrice) filters.price.$lte = parseFloat(maxPrice);
    }

    if (available !== undefined) {
      filters['availability.isAvailable'] = available === 'true';
    }

    if (featured !== undefined) {
      filters.isFeatured = featured === 'true';
    }

    if (popular !== undefined) {
      filters.isPopular = popular === 'true';
    }

    if (search) {
      filters.$text = { $search: search };
    }

    // Construir ordenação
    const sortOptions = {};
    if (sort === 'price') {
      sortOptions.price = order === 'desc' ? -1 : 1;
    } else if (sort === 'rating') {
      sortOptions['ratings.average'] = order === 'desc' ? -1 : 1;
    } else if (sort === 'popularity') {
      sortOptions['ratings.count'] = order === 'desc' ? -1 : 1;
    } else {
      sortOptions.name = order === 'desc' ? -1 : 1;
    }

    // Calcular skip para paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Executar query
    const products = await Product.find(filters)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedProducts', 'name images price');

    // Contar total de produtos
    const total = await Product.countDocuments(filters);

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
// @desc    Obter produto por ID
// @access  Public
router.get('/:id', validateMongoId, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('relatedProducts', 'name images price category')
      .populate('ratings.reviews.user', 'name');

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
// @desc    Criar novo produto
// @access  Private (Staff/Admin)
router.post('/', authenticateToken, requireStaff, validateProduct, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Produto criado com sucesso',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Produto com este nome já existe'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/products/:id
// @desc    Atualizar produto
// @access  Private (Staff/Admin)
router.put('/:id', authenticateToken, requireStaff, validateMongoId, validateProduct, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Produto atualizado com sucesso',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Produto com este nome já existe'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/products/:id
// @desc    Eliminar produto
// @access  Private (Admin)
router.delete('/:id', authenticateToken, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Produto eliminado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao eliminar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/products/:id/reviews
// @desc    Adicionar review ao produto
// @access  Private
router.post('/:id/reviews', authenticateToken, validateMongoId, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating deve ser entre 1 e 5'
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Adicionar review
    await product.addReview(req.user._id, rating, comment);

    res.json({
      success: true,
      message: 'Review adicionado com sucesso',
      data: {
        product: {
          _id: product._id,
          ratings: product.ratings
        }
      }
    });
  } catch (error) {
    console.error('Erro ao adicionar review:', error);
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
    const categories = await Product.distinct('category');
    
    const categoryStats = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({ category });
        return { category, count };
      })
    );

    res.json({
      success: true,
      data: {
        categories: categoryStats
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

// @route   GET /api/products/featured
// @desc    Obter produtos em destaque
// @access  Public
router.get('/featured/list', async (req, res) => {
  try {
    const featuredProducts = await Product.find({ isFeatured: true })
      .limit(10)
      .select('name images price category ratings');

    res.json({
      success: true,
      data: {
        products: featuredProducts
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

// @route   GET /api/products/popular
// @desc    Obter produtos populares
// @access  Public
router.get('/popular/list', async (req, res) => {
  try {
    const popularProducts = await Product.find({ isPopular: true })
      .sort({ 'ratings.average': -1, 'ratings.count': -1 })
      .limit(10)
      .select('name images price category ratings');

    res.json({
      success: true,
      data: {
        products: popularProducts
      }
    });
  } catch (error) {
    console.error('Erro ao obter produtos populares:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/products/search
// @desc    Pesquisar produtos
// @access  Public
router.get('/search/query', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Termo de pesquisa é obrigatório'
      });
    }

    const products = await Product.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .select('name images price category ratings');

    res.json({
      success: true,
      data: {
        products,
        searchTerm: q,
        totalResults: products.length
      }
    });
  } catch (error) {
    console.error('Erro na pesquisa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/products/seasonal
// @desc    Obter produtos sazonais
// @access  Public
router.get('/seasonal/list', async (req, res) => {
  try {
    const now = new Date();
    const seasonalProducts = await Product.find({
      isSeasonal: true,
      'seasonalPeriod.start': { $lte: now },
      'seasonalPeriod.end': { $gte: now }
    })
      .select('name images price category seasonalPeriod');

    res.json({
      success: true,
      data: {
        products: seasonalProducts
      }
    });
  } catch (error) {
    console.error('Erro ao obter produtos sazonais:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/products/:id/toggle-featured
// @desc    Alternar status de destaque do produto
// @access  Private (Staff/Admin)
router.post('/:id/toggle-featured', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    product.isFeatured = !product.isFeatured;
    await product.save();

    res.json({
      success: true,
      message: `Produto ${product.isFeatured ? 'adicionado' : 'removido'} dos destaques`,
      data: {
        product: {
          _id: product._id,
          isFeatured: product.isFeatured
        }
      }
    });
  } catch (error) {
    console.error('Erro ao alternar destaque:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/products/:id/toggle-popular
// @desc    Alternar status de popular do produto
// @access  Private (Staff/Admin)
router.post('/:id/toggle-popular', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    product.isPopular = !product.isPopular;
    await product.save();

    res.json({
      success: true,
      message: `Produto ${product.isPopular ? 'marcado' : 'desmarcado'} como popular`,
      data: {
        product: {
          _id: product._id,
          isPopular: product.isPopular
        }
      }
    });
  } catch (error) {
    console.error('Erro ao alternar popular:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/products/availability/check
// @desc    Verificar disponibilidade de produtos
// @access  Public
router.get('/availability/check', async (req, res) => {
  try {
    const { productIds } = req.query;

    if (!productIds) {
      return res.status(400).json({
        success: false,
        message: 'IDs dos produtos são obrigatórios'
      });
    }

    const ids = productIds.split(',');
    const products = await Product.find({
      _id: { $in: ids }
    }).select('_id name availability isAvailable stockQuantity');

    const availability = products.map(product => ({
      _id: product._id,
      name: product.name,
      isAvailable: product.isAvailableNow(),
      stockQuantity: product.availability.stockQuantity,
      availableNow: product.isAvailableNow()
    }));

    res.json({
      success: true,
      data: {
        availability
      }
    });
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
