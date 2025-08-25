const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, getCategories, getProducts } = require('../config/database');
const { authenticateAdmin, requirePermission } = require('../middleware/admin-auth');

// Criar diretório de uploads se não existir
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Diretório de uploads criado:', uploadsDir);
}

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'), false);
    }
  }
});

// GET - Listar todos os produtos
router.get('/products', authenticateAdmin, requirePermission('manage_products'), async (req, res) => {
    try {
        const products = await getProducts();
        const categories = await getCategories();
        
        // Adicionar nome da categoria aos produtos
        const productsWithCategory = products.map(product => ({
            ...product,
            category_name: categories.find(cat => cat.id === product.category_id)?.name || 'Sem categoria'
        }));
        
        res.json({ success: true, data: productsWithCategory });
    } catch (error) {
        console.error('❌ Erro ao buscar produtos:', error);
        res.status(500).json({ success: false, message: 'Erro interno' });
    }
});

// GET - Buscar produto específico
router.get('/products/:id', authenticateAdmin, requirePermission('manage_products'), async (req, res) => {
    try {
        const { id } = req.params;
        
        db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
            if (err) {
                console.error('❌ Erro ao buscar produto:', err);
                return res.status(500).json({ success: false, message: 'Erro interno' });
            }
            
            if (!product) {
                return res.status(404).json({ success: false, message: 'Produto não encontrado' });
            }
            
            console.log('✅ Produto encontrado:', product);
            res.json({ success: true, data: product });
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar produto:', error);
        res.status(500).json({ success: false, message: 'Erro interno' });
    }
});

// POST - Criar produto
router.post('/products', authenticateAdmin, requirePermission('manage_products'), upload.single('image'), async (req, res) => {
    try {
        console.log('📝 Criando produto:', req.body);
        console.log('📁 Arquivo recebido:', req.file);
        
        const { name, description, price, category_id, is_available, is_featured } = req.body;
        
        if (!name || !price || !category_id) {
            return res.status(400).json({ success: false, message: 'Nome, preço e categoria são obrigatórios' });
        }
        
        // Gerar URL da imagem se foi enviada
        let image_url = '';
        if (req.file) {
            image_url = `/uploads/${req.file.filename}`;
        }
        
        const query = `INSERT INTO products (name, description, price, category_id, image_url, is_available, is_featured) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(query, [name, description, price, category_id, image_url, is_available ? 1 : 0, is_featured ? 1 : 0], function(err) {
            if (err) {
                console.error('❌ Erro ao criar produto:', err);
                return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
            }
            
            console.log('✅ Produto criado com ID:', this.lastID);
            res.status(201).json({ success: true, data: { id: this.lastID }, message: 'Produto criado com sucesso' });
        });
        
    } catch (error) {
        console.error('❌ Erro na criação do produto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT - Atualizar produto
router.put('/products/:id', authenticateAdmin, requirePermission('manage_products'), upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category_id, is_available, is_featured, sort_order } = req.body;
        
        console.log('📝 Atualizando produto ID:', id, req.body);
        console.log('📁 Arquivo recebido:', req.file);
        
        // Se é apenas uma atualização de destaque/sort_order, não validar campos obrigatórios
        const isFeaturedUpdate = req.body.hasOwnProperty('is_featured') && !name && !price && !category_id;
        
        if (!isFeaturedUpdate && (!name || !price || !category_id)) {
            return res.status(400).json({ success: false, message: 'Nome, preço e categoria são obrigatórios' });
        }
        
        // Buscar produto atual para manter dados existentes
        db.get('SELECT * FROM products WHERE id = ?', [id], async (err, currentProduct) => {
            if (err) {
                console.error('❌ Erro ao buscar produto atual:', err);
                return res.status(500).json({ success: false, message: 'Erro interno' });
            }
            
            if (!currentProduct) {
                return res.status(404).json({ success: false, message: 'Produto não encontrado' });
            }
            
            // Para atualizações de destaque, manter dados existentes
            const updateName = name || currentProduct.name;
            const updateDescription = description || currentProduct.description;
            const updatePrice = price || currentProduct.price;
            const updateCategoryId = category_id || currentProduct.category_id;
            const updateIsAvailable = is_available !== undefined ? (is_available ? 1 : 0) : currentProduct.is_available;
            const updateIsFeatured = is_featured !== undefined ? (is_featured ? 1 : 0) : currentProduct.is_featured;
            const updateSortOrder = sort_order !== undefined ? sort_order : currentProduct.sort_order;
            
            let image_url = currentProduct.image_url || '';
            
            // Se foi enviada nova imagem, usar ela
            if (req.file) {
                image_url = `/uploads/${req.file.filename}`;
            }
            
            const query = `UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, 
                           image_url = ?, is_available = ?, is_featured = ?, sort_order = ? WHERE id = ?`;
            
            db.run(query, [updateName, updateDescription, updatePrice, updateCategoryId, image_url, updateIsAvailable, updateIsFeatured, updateSortOrder, id], function(err) {
                if (err) {
                    console.error('❌ Erro ao atualizar produto:', err);
                    return res.status(500).json({ success: false, message: 'Erro interno' });
                }
                
                // Buscar produto atualizado
                db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
                    if (err) {
                        console.error('❌ Erro ao buscar produto atualizado:', err);
                        return res.status(500).json({ success: false, message: 'Erro interno' });
                    }
                    
                    console.log('✅ Produto atualizado com sucesso:', product);
                    res.json({ success: true, data: product, message: 'Produto atualizado com sucesso' });
                });
            });
        });
        
    } catch (error) {
        console.error('❌ Erro na atualização do produto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE - Deletar produto
router.delete('/products/:id', authenticateAdmin, requirePermission('manage_products'), (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erro interno' });
        }
        res.json({ success: true, message: 'Produto deletado' });
    });
});

// GET - Categorias
router.get('/categories', authenticateAdmin, requirePermission('manage_products'), async (req, res) => {
    try {
        const categories = await getCategories();
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('❌ Erro ao buscar categorias:', error);
        res.status(500).json({ success: false, message: 'Erro interno' });
    }
});

module.exports = router;
