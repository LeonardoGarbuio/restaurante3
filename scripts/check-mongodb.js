const mongoose = require('mongoose');

// Script para verificar conexão com MongoDB
async function checkMongoDB() {
  try {
    console.log('🔍 Verificando conexão com MongoDB...');
    
    const conn = await mongoose.connect('mongodb://localhost:27017/sabores-portugueses', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos
    });

    console.log('✅ MongoDB conectado com sucesso!');
    console.log(`📍 Host: ${conn.connection.host}`);
    console.log(`🗄️  Banco: ${conn.connection.name}`);
    console.log(`🔌 Porta: ${conn.connection.port}`);
    
    // Fechar conexão
    await mongoose.connection.close();
    console.log('🔌 Conexão fechada');
    
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:');
    console.error(error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Soluções:');
      console.log('1. Verifique se o MongoDB está instalado');
      console.log('2. Verifique se o serviço MongoDB está rodando');
      console.log('3. Windows: Execute PowerShell como Administrador e use: Get-Service MongoDB');
      console.log('4. macOS: brew services start mongodb/brew/mongodb-community');
      console.log('5. Linux: sudo systemctl start mongod');
    }
    
    process.exit(1);
  }
}

// Executar verificação
checkMongoDB();
