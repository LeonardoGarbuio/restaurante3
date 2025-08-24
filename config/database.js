const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho para o banco de dados
const dbPath = path.join(__dirname, '../data/padaria.db');

// Criar diretório data se não existir
const fs = require('fs');
const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

// Criar conexão com o banco
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
    } else {
        console.log('✅ Conectado ao banco SQLite');
        initializeDatabase();
    }
});

// Inicializar banco de dados
function initializeDatabase() {
    // Habilitar foreign keys
db.run('PRAGMA foreign_keys = ON');

    // Criar tabelas
    createTables();
    
    // Inserir dados iniciais
    insertInitialData();
}
  
  // Criar tabelas
function createTables() {
    // Tabela de categorias
    db.run(`
        CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            description TEXT,
            image_url TEXT,
        is_active BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de produtos
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
            price DECIMAL(10,2) NOT NULL,
            category_id INTEGER NOT NULL,
        image_url TEXT,
        is_available BOOLEAN DEFAULT 1,
            is_featured BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )
    `);

    // Tabela de pedidos
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT,
            customer_email TEXT,
            total_amount DECIMAL(10,2) NOT NULL,
            status TEXT DEFAULT 'pending',
            delivery_address TEXT,
            delivery_type TEXT DEFAULT 'delivery',
            notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de itens do pedido
    db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
        )
    `);



    console.log('✅ Tabelas criadas com sucesso');
}

// Inserir dados iniciais
function insertInitialData() {
    // Verificar se já existem dados
    db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
        if (err) {
            console.error('❌ Erro ao verificar categorias:', err);
            return;
        }
        
        if (row.count === 0) {
            insertCategories();
        }
    });
}

// Inserir categorias
function insertCategories() {
    const categories = [
        {
            name: 'Todos',
            slug: 'all',
            description: 'Todos os produtos disponíveis',
            sort_order: 0
        },
        {
            name: 'Bolos',
            slug: 'bolos',
            description: 'Bolos tradicionais portugueses',
            image_url: 'https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg',
            sort_order: 1
        },
        {
            name: 'Salgados',
            slug: 'salgados',
            description: 'Salgados frescos e tradicionais',
            image_url: 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg',
            sort_order: 2
        },
        {
            name: 'Bebidas',
            slug: 'bebidas',
            description: 'Bebidas quentes e frias',
            image_url: 'https://images.pexels.com/photos/1869820/pexels-photo-1869820.jpeg',
            sort_order: 3
        },
        {
            name: 'Pães',
            slug: 'paes',
            description: 'Pães frescos diariamente',
            image_url: 'https://images.pexels.com/photos/1869343/pexels-photo-1869343.jpeg',
            sort_order: 4
        }
    ];

    const stmt = db.prepare(`
        INSERT INTO categories (name, slug, description, image_url, sort_order)
        VALUES (?, ?, ?, ?, ?)
    `);

    categories.forEach(category => {
        stmt.run(category.name, category.slug, category.description, category.image_url, category.sort_order);
    });

    stmt.finalize();
    console.log('✅ Categorias inseridas');

    // Inserir produtos após as categorias
    setTimeout(insertProducts, 500);
}

// Inserir produtos
function insertProducts() {
    const products = [
        // Bolos
        {
            name: 'Bolo de Pastel de Nata',
            description: 'Bolo tradicional português com creme de pastel de nata',
            price: 8.50,
            category_id: 2,
            image_url: 'https://images.pexels.com/photos/2505997/pexels-photo-2505997.jpeg',
            is_featured: 1,
            sort_order: 1
        },
        {
            name: 'Bolo de Chocolate',
            description: 'Bolo de chocolate caseiro com cobertura',
            price: 12.00,
            category_id: 2,
            image_url: 'https://images.pexels.com/photos/1971552/pexels-photo-1971552.jpeg',
            is_featured: 1,
            sort_order: 2
        },
        {
            name: 'Bolo de Caramelo',
            description: 'Bolo de caramelo com nozes',
            price: 10.50,
            category_id: 2,
            image_url: 'https://images.pexels.com/photos/1721932/pexels-photo-1721932.jpeg',
            sort_order: 3
        },

        // Salgados
        {
            name: 'Coxinha de Frango',
            description: 'Coxinha de frango tradicional',
            price: 3.50,
            category_id: 3,
            image_url: 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg',
            is_featured: 1,
            sort_order: 1
        },
        {
            name: 'Empada de Palmito',
            description: 'Empada de palmito fresca',
            price: 4.00,
            category_id: 3,
            image_url: 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg',
            sort_order: 2
        },
        {
            name: 'Rissole de Carne',
            description: 'Rissole de carne moída',
            price: 3.00,
            category_id: 3,
            image_url: 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg',
            sort_order: 3
        },

        // Bebidas
        {
            name: 'Café Expresso',
            description: 'Café expresso tradicional português',
            price: 1.50,
            category_id: 4,
            image_url: 'https://images.pexels.com/photos/1869820/pexels-photo-1869820.jpeg',
            sort_order: 1
        },
        {
            name: 'Cappuccino',
            description: 'Cappuccino cremoso',
            price: 3.50,
            category_id: 4,
            image_url: 'https://images.pexels.com/photos/1869820/pexels-photo-1869820.jpeg',
            sort_order: 2
        },
        {
            name: 'Chá de Limão',
            description: 'Chá de limão natural',
            price: 2.00,
            category_id: 4,
            image_url: 'https://images.pexels.com/photos/1869820/pexels-photo-1869820.jpeg',
            sort_order: 3
        },

        // Pães
        {
            name: 'Pão Francês',
            description: 'Pão francês tradicional',
            price: 0.50,
            category_id: 5,
            image_url: 'https://images.pexels.com/photos/1869343/pexels-photo-1869343.jpeg',
            sort_order: 1
        },
        {
            name: 'Pão de Queijo',
            description: 'Pão de queijo fresquinho',
            price: 2.50,
            category_id: 5,
            image_url: 'https://images.pexels.com/photos/1869343/pexels-photo-1869343.jpeg',
            sort_order: 2
        },
        {
            name: 'Baguete',
            description: 'Baguete artesanal',
            price: 1.50,
            category_id: 5,
            image_url: 'https://images.pexels.com/photos/1869343/pexels-photo-1869343.jpeg',
            sort_order: 3
        }
    ];

    const stmt = db.prepare(`
        INSERT INTO products (name, description, price, category_id, image_url, is_featured, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    products.forEach(product => {
        stmt.run(product.name, product.description, product.price, product.category_id, product.image_url, product.is_featured, product.sort_order);
    });

    stmt.finalize();
    console.log('✅ Produtos inseridos');
}

// Funções de consulta
function getCategories() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM categories 
            WHERE is_active = 1 
            ORDER BY sort_order, name
        `, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function getProducts(categorySlug = 'all') {
    return new Promise((resolve, reject) => {
        let query = `
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_available = 1
        `;
        
        let params = [];
        
        if (categorySlug !== 'all') {
            query += ' AND c.slug = ?';
            params.push(categorySlug);
        }
        
        query += ' ORDER BY p.sort_order, p.name';
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('❌ Erro na query getProducts:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function getFeaturedProducts() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.is_available = 1 AND p.is_featured = 1
            ORDER BY p.sort_order, p.name
            LIMIT 6
        `, (err, rows) => {
            if (err) {
                reject(err);
    } else {
                resolve(rows);
            }
        });
    });
}

function searchProducts(searchTerm) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.is_available = 1 
            AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)
            ORDER BY p.sort_order, p.name
        `;
        
        const searchPattern = `%${searchTerm}%`;
        const params = [searchPattern, searchPattern, searchPattern];
        
        db.all(query, params, (err, rows) => {
    if (err) {
                reject(err);
    } else {
                resolve(rows);
    }
  });
});
}

// Exportar funções
module.exports = {
    db,
    getCategories,
    getProducts,
    getFeaturedProducts,
    searchProducts
};
