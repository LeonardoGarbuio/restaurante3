const mongoose = require('mongoose');

// Configurações de conexão
const connectDB = async () => {
  try {
    // Usar MongoDB local
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sabores-portugueses';
    
    const conn = await mongoose.connect(MONGODB_URI);

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    console.log(`🗄️  Banco: ${conn.connection.name}`);
    
    // Configurações adicionais
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erro na conexão MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB desconectado');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔄 Conexão MongoDB fechada devido ao encerramento da aplicação');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error.message);
    console.log('💡 Certifique-se de que o MongoDB está rodando localmente');
    console.log('💡 Instale o MongoDB Community Server e inicie o serviço');
    process.exit(1);
  }
};

module.exports = connectDB;
