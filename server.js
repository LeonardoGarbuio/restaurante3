const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware de segurança com CSP personalizado
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requests por IP
});
app.use(limiter);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static('public'));
app.use('/css', express.static('css'));
app.use('/pages', express.static('pages'));

// Conectar ao banco SQLite
const db = require('./config/database');

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/delivery', require('./routes/delivery'));
app.use('/api/loyalty', require('./routes/loyalty'));
app.use('/api/contact', require('./routes/contact'));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Rota para a landing page
app.get('/landing', (req, res) => {
  res.sendFile(__dirname + '/pages/landing_page.html');
});

// Rota para o menu completo
app.get('/menu-completo', (req, res) => {
  res.sendFile(__dirname + '/pages/menu_simples.html');
});

// Rota para teste de sincronização
app.get('/teste-sincronizacao', (req, res) => {
  res.sendFile(__dirname + '/pages/teste_sincronizacao.html');
});

// Rota para teste de persistência
app.get('/teste-persistencia', (req, res) => {
  res.sendFile(__dirname + '/pages/teste_persistencia.html');
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Rota não encontrada' 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Frontend disponível em: http://localhost:${PORT}`);
  console.log(`🔧 API disponível em: http://localhost:${PORT}/api`);
});
