const db = require('../config/database');

// Script para testar banco SQLite
async function testSQLiteConnection() {
  try {
    console.log('🔍 Testando banco SQLite...');
    
    // Verificar se as tabelas foram criadas
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    console.log('✅ Tabelas criadas:', tables.map(t => t.name));
    
    // Testar inserção de usuário de teste
    console.log('\n🧪 Testando inserção de usuário...');
    
    const testUser = db.prepare(`
      INSERT INTO users (name, email, phone, password, street, city, postal_code, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Usuário Teste',
      'teste@email.com',
      '+351912345678',
      'password_hash_test',
      'Rua Teste',
      'Lisboa',
      '1000-001',
      'customer'
    );
    
    console.log('✅ Usuário de teste inserido, ID:', testUser.lastInsertRowid);
    
    // Testar busca
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('teste@email.com');
    console.log('✅ Usuário encontrado:', user.name);
    
    // Testar atualização
    db.prepare('UPDATE users SET loyalty_points = 100 WHERE email = ?').run('teste@email.com');
    console.log('✅ Usuário atualizado');
    
    // Testar busca atualizada
    const updatedUser = db.prepare('SELECT name, loyalty_points FROM users WHERE email = ?').get('teste@email.com');
    console.log('✅ Usuário com pontos:', updatedUser.name, '-', updatedUser.loyalty_points, 'pontos');
    
    // Limpar usuário de teste
    db.prepare('DELETE FROM users WHERE email = ?').run('teste@email.com');
    console.log('✅ Usuário de teste removido');
    
    // Verificar estrutura das tabelas principais
    console.log('\n📋 Estrutura das tabelas principais:');
    
    const usersColumns = db.prepare("PRAGMA table_info(users)").all();
    console.log('👥 Users:', usersColumns.map(c => c.name).join(', '));
    
    const productsColumns = db.prepare("PRAGMA table_info(products)").all();
    console.log('🛍️  Products:', productsColumns.map(c => c.name).join(', '));
    
    const ordersColumns = db.prepare("PRAGMA table_info(orders)").all();
    console.log('📦 Orders:', productsColumns.map(c => c.name).join(', '));
    
    console.log('\n🎉 Banco SQLite está funcionando perfeitamente!');
    console.log('📍 Caminho:', db.name);
    
  } catch (error) {
    console.error('❌ Erro ao testar banco SQLite:', error.message);
    process.exit(1);
  }
}

// Executar teste
testSQLiteConnection();
