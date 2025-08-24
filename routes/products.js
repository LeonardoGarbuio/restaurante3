const express = require('express');
const router = express.Router();
const { getCategories, getProducts, getFeaturedProducts, searchProducts } = require('../config/database');

// GET /api/products/categories - Listar todas as categorias
router.get('/categories', async (req, res) => {
    try {
        const categories = await getCategories();
        
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('❌ Erro ao buscar categorias:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/products - Listar produtos (com filtro de categoria opcional)
router.get('/', async (req, res) => {
    try {
        const { category, search, featured } = req.query;
        
        let products;
        const categories = await getCategories();
        
        if (featured === 'true') {
            // Produtos em destaque
            products = await getFeaturedProducts();
        } else if (search) {
            // Busca por termo
            products = await searchProducts(search);
        } else if (category && category !== 'all') {
            // Produtos por categoria
            products = await getProducts(category);
        } else {
            // Todos os produtos
            products = await getProducts();
        }
        
        // Adicionar slug da categoria aos produtos
        const productsWithCategory = products.map(product => ({
            ...product,
            category_slug: categories.find(cat => cat.id === product.category_id)?.slug || 'uncategorized'
        }));
        
        res.json({
            success: true,
            products: productsWithCategory,
            categories: categories,
            count: products.length,
            filters: {
                category: category || 'all',
                search: search || null,
                featured: featured === 'true'
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/products/featured - Produtos em destaque
router.get('/featured', async (req, res) => {
    try {
        const products = await getFeaturedProducts();
        
        res.json({
            success: true,
            data: products,
            count: products.length
        });
    } catch (error) {
        console.error('❌ Erro ao buscar produtos em destaque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/products/search - Buscar produtos
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Termo de busca é obrigatório'
            });
        }
        
        const products = await searchProducts(q);
        
        res.json({
            success: true,
            data: products,
            count: products.length,
            searchTerm: q
        });
    } catch (error) {
        console.error('❌ Erro na busca:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/products/category/:slug - Produtos por categoria
router.get('/category/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        if (slug === 'all') {
            const products = await getProducts();
            return res.json({
                success: true,
                data: products,
                count: products.length,
                category: 'all'
            });
        }
        
        const products = await getProducts(slug);
        
        res.json({
            success: true,
            data: products,
            count: products.length,
            category: slug
        });
    } catch (error) {
        console.error('❌ Erro ao buscar produtos por categoria:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET /api/products/stats - Estatísticas dos produtos
router.get('/stats', async (req, res) => {
    try {
        const { db } = require('../config/database');
        
        // Contar produtos por categoria
        const categoryStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT c.name, c.slug, COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.id = p.category_id AND p.is_available = 1
                WHERE c.is_active = 1 AND c.slug != 'all'
                GROUP BY c.id, c.name, c.slug
                ORDER BY c.sort_order
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Total de produtos
        const totalProducts = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM products WHERE is_available = 1', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        // Produtos em destaque
        const featuredCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM products WHERE is_available = 1 AND is_featured = 1', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        res.json({
            success: true,
            data: {
                totalProducts,
                featuredCount,
                categories: categoryStats
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
