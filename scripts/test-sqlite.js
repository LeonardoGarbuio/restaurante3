const db = require('../config/database');

// Função helper para executar queries de forma síncrona
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const runQuerySingle = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const runQueryExec = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastInsertRowid: this.lastInsertRowid, changes: this.changes });
    });
  });
};

// Script para testar banco SQLite
async function testSQLiteConnection() {
  try {
    console.log('🔍 Testando banco SQLite...');
    
    // Verificar se as tabelas foram criadas
    const tables = await runQuery(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log('✅ Tabelas criadas:', tables.map(t => t.name));
    
    // Testar inserção de usuário de teste
    console.log('\n🧪 Testando inserção de usuário...');
    
    const testUser = await runQueryExec(`
      INSERT INTO users (name, email, phone, password, street, city, postal_code, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'Usuário Teste',
      'teste@email.com',
      '+351912345678',
      'password_hash_test',
      'Rua Teste',
      'Lisboa',
      '1000-001',
      'customer'
    ]);
    
    console.log('✅ Usuário de teste inserido, ID:', testUser.lastInsertRowid);
    
    // Testar busca
    const user = await runQuerySingle('SELECT * FROM users WHERE email = ?', ['teste@email.com']);
    console.log('✅ Usuário encontrado:', user.name);
    
    // Testar atualização
    await runQueryExec('UPDATE users SET loyalty_points = 100 WHERE email = ?', ['teste@email.com']);
    console.log('✅ Usuário atualizado');
    
    // Testar busca atualizada
    const updatedUser = await runQuerySingle('SELECT name, loyalty_points FROM users WHERE email = ?', ['teste@email.com']);
    console.log('✅ Usuário com pontos:', updatedUser.name, '-', updatedUser.loyalty_points, 'pontos');
    
    // Limpar usuário de teste
    await runQueryExec('DELETE FROM users WHERE email = ?', ['teste@email.com']);
    console.log('✅ Usuário de teste removido');
    
    // Verificar estrutura das tabelas principais
    console.log('\n📋 Estrutura das tabelas principais:');
    
    const usersColumns = await runQuery("PRAGMA table_info(users)");
    console.log('👥 Users:', usersColumns.map(c => c.name).join(', '));
    
    const productsColumns = await runQuery("PRAGMA table_info(products)");
    console.log('🛍️  Products:', productsColumns.map(c => c.name).join(', '));
    
    const ordersColumns = await runQuery("PRAGMA table_info(orders)");
    console.log('📦 Orders:', ordersColumns.map(c => c.name).join(', '));
    
    console.log('\n🎉 Banco SQLite está funcionando perfeitamente!');
    console.log('📍 Caminho:', db.filename);
    
  } catch (error) {
    console.error('❌ Erro ao testar banco SQLite:', error.message);
    process.exit(1);
  }
}

// Executar teste
testSQLiteConnection();
