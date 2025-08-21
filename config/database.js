const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Configurações do banco SQLite
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/sabores-portugueses.db'  // Render usa /tmp
  : path.join(__dirname, '../data/sabores-portugueses.db');

// Criar diretório data se não existir (apenas local)
if (process.env.NODE_ENV !== 'production') {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Conectar ao banco
const db = new Database(dbPath);

// Configurações do banco
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Função para inicializar o banco
const initDatabase = () => {
  try {
    console.log('🗄️  Inicializando banco SQLite...');
    
    // Criar tabelas
    db.exec(`
      -- Tabela de usuários
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password TEXT NOT NULL,
        street TEXT NOT NULL,
        city TEXT NOT NULL,
        postal_code TEXT NOT NULL,
        lat REAL,
        lng REAL,
        role TEXT DEFAULT 'customer' CHECK(role IN ('customer', 'admin', 'staff')),
        loyalty_points INTEGER DEFAULT 0,
        loyalty_tier TEXT DEFAULT 'bronze' CHECK(loyalty_tier IN ('bronze', 'silver', 'gold')),
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        phone_verified BOOLEAN DEFAULT 0,
        dietary_restrictions TEXT,
        delivery_instructions TEXT,
        marketing_emails BOOLEAN DEFAULT 1,
        sms_notifications BOOLEAN DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabela de produtos
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        image_url TEXT,
        is_available BOOLEAN DEFAULT 1,
        stock_quantity INTEGER DEFAULT 0,
        allergens TEXT,
        nutritional_info TEXT,
        preparation_time INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabela de pedidos
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded')),
        delivery_type TEXT NOT NULL CHECK(delivery_type IN ('delivery', 'pickup', 'dine-in')),
        delivery_street TEXT,
        delivery_city TEXT,
        delivery_postal_code TEXT,
        delivery_instructions TEXT,
        preferred_time TEXT CHECK(preferred_time IN ('asap', 'specific')),
        specific_time DATETIME,
        estimated_delivery DATETIME,
        actual_delivery DATETIME,
        delivery_fee REAL DEFAULT 0,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('card', 'cash', 'mbway', 'transfer', 'paypal')),
        payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded')),
        transaction_id TEXT,
        subtotal REAL NOT NULL,
        tax REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        loyalty_discount REAL DEFAULT 0,
        final_amount REAL NOT NULL,
        customer_notes TEXT,
        staff_notes TEXT,
        loyalty_points_earned INTEGER DEFAULT 0,
        loyalty_points_used INTEGER DEFAULT 0,
        is_urgent BOOLEAN DEFAULT 0,
        source TEXT DEFAULT 'website' CHECK(source IN ('website', 'phone', 'whatsapp', 'in-store', 'mobile-app')),
        order_placed DATETIME DEFAULT CURRENT_TIMESTAMP,
        estimated_ready DATETIME,
        actual_ready DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- Tabela de itens do pedido
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price REAL NOT NULL CHECK(unit_price >= 0),
        total_price REAL NOT NULL CHECK(total_price >= 0),
        special_instructions TEXT,
        customization TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
      );

      -- Tabela de histórico de status
      CREATE TABLE IF NOT EXISTS order_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        updated_by INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (updated_by) REFERENCES users (id)
      );

      -- Tabela de carrinho
      CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        special_instructions TEXT,
        customization TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
      );

      -- Tabela de fidelidade
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        order_id INTEGER,
        points INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('earned', 'used', 'bonus', 'expired')),
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (order_id) REFERENCES orders (id)
      );

      -- Tabela de recompensas
      CREATE TABLE IF NOT EXISTS loyalty_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        points_required INTEGER NOT NULL,
        discount_percentage REAL,
        discount_amount REAL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabela de metas de fidelidade
      CREATE TABLE IF NOT EXISTS loyalty_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        points_target INTEGER NOT NULL,
        reward_description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabela de entregas
      CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        driver_id INTEGER,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed')),
        pickup_time DATETIME,
        delivery_time DATETIME,
        current_lat REAL,
        current_lng REAL,
        estimated_delivery DATETIME,
        actual_delivery DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (driver_id) REFERENCES users (id)
      );

      -- Tabela de contatos
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'new' CHECK(status IN ('new', 'read', 'replied', 'closed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Índices para melhor performance
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
      CREATE INDEX IF NOT EXISTS idx_users_loyalty_points ON users(loyalty_points);
      
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available);
      
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON orders(delivery_type);
      CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
      CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
      
      CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
      
      CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user ON loyalty_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order ON loyalty_transactions(order_id);
      
      CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    `);

    console.log('✅ Banco SQLite inicializado com sucesso!');
    console.log(`📍 Caminho: ${dbPath}`);
    
    // Verificar se é produção
    if (process.env.NODE_ENV === 'production') {
      console.log('🌐 Ambiente: PRODUÇÃO (Render)');
    } else {
      console.log('💻 Ambiente: DESENVOLVIMENTO (Local)');
    }

  } catch (error) {
    console.error('❌ Erro ao inicializar banco SQLite:', error.message);
    process.exit(1);
  }
};

// Inicializar banco
initDatabase();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Fechando conexão com banco SQLite...');
  db.close();
  console.log('✅ Conexão fechada');
  process.exit(0);
});

module.exports = db;
