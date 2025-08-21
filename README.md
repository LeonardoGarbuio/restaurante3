# Sabores Portugueses - Backend API

Backend completo para o sistema de padaria portuguesa "Sabores Portugueses", incluindo sistema de pedidos online, gestão de produtos, sistema de fidelidade, entregas e gestão de utilizadores.

## 🚀 Funcionalidades

- **Sistema de Autenticação**: Registro, login, JWT tokens
- **Gestão de Utilizadores**: Perfis, roles (cliente, staff, admin, motorista)
- **Catálogo de Produtos**: Gestão de produtos, categorias, avaliações
- **Sistema de Pedidos**: Carrinho de compras, checkout, histórico
- **Sistema de Fidelidade**: Pontos, tiers, recompensas, metas
- **Gestão de Entregas**: Rastreamento em tempo real, atribuição de motoristas
- **Sistema de Contacto**: Formulários, gestão de mensagens
- **API RESTful**: Endpoints bem documentados e seguros

## 🛠️ Tecnologias

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **MongoDB** - Base de dados NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticação baseada em tokens
- **bcryptjs** - Hash de senhas
- **express-validator** - Validação de dados
- **Helmet** - Segurança HTTP
- **CORS** - Cross-Origin Resource Sharing

## 📁 Estrutura do Projeto

```
├── models/           # Modelos Mongoose
│   ├── User.js      # Modelo de utilizador
│   ├── Product.js   # Modelo de produto
│   ├── Order.js     # Modelo de pedido
│   ├── Cart.js      # Modelo de carrinho
│   ├── Delivery.js  # Modelo de entrega
│   ├── Contact.js   # Modelo de contacto
│   └── Loyalty.js   # Modelo de fidelidade
├── routes/          # Rotas da API
│   ├── auth.js      # Autenticação
│   ├── users.js     # Gestão de utilizadores
│   ├── products.js  # Gestão de produtos
│   ├── orders.js    # Gestão de pedidos
│   ├── cart.js      # Gestão de carrinho
│   ├── delivery.js  # Gestão de entregas
│   ├── contact.js   # Gestão de contactos
│   └── loyalty.js   # Sistema de fidelidade
├── middleware/      # Middleware personalizado
│   ├── auth.js      # Autenticação e autorização
│   └── validation.js # Validação de dados
├── server.js        # Servidor principal
├── .env             # Variáveis de ambiente
└── package.json     # Dependências e scripts
```

## 🚀 Instalação

1. **Clonar o repositório**
```bash
git clone <repository-url>
cd sabores-portugueses
```

2. **Instalar dependências**
```bash
npm install
```

3. **Configurar variáveis de ambiente**
```bash
cp .env.example .env
# Editar .env com suas configurações
```

4. **Configurar MongoDB**
- Instalar MongoDB localmente ou usar MongoDB Atlas
- Atualizar `MONGODB_URI` no arquivo `.env`

5. **Executar o servidor**
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 🔧 Configuração

### Variáveis de Ambiente (.env)

```env
# Servidor
PORT=5000
NODE_ENV=development

# Base de Dados
MONGODB_URI=mongodb://localhost:27017/sabores-portugueses

# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=7d

# Email (Nodemailer)
EMAIL_SERVICE=gmail
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_app

# Stripe (Pagamentos)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Google Maps
GOOGLE_MAPS_API_KEY=sua_chave_api_aqui

# WhatsApp Business
WHATSAPP_API_KEY=sua_chave_api_aqui
WHATSAPP_PHONE_NUMBER=+351123456789

# Upload de Ficheiros
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📚 Documentação da API

### Base URL
```
http://localhost:5000/api
```

### Autenticação

#### Registro
```http
POST /auth/register
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "+351123456789",
  "password": "senha123",
  "address": {
    "street": "Rua das Flores",
    "city": "Lisboa",
    "postalCode": "1000-001",
    "country": "Portugal"
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "joao@email.com",
  "password": "senha123"
}
```

### Produtos

#### Listar Produtos
```http
GET /products?page=1&limit=20&category=pastries&featured=true
Authorization: Bearer <token>
```

#### Obter Produto
```http
GET /products/:id
Authorization: Bearer <token>
```

#### Criar Produto (Admin/Staff)
```http
POST /products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Pastel de Nata",
  "description": "Pastel de nata tradicional português",
  "category": "pastries",
  "price": 1.50,
  "ingredients": ["massa folhada", "natas", "açúcar"],
  "isAvailable": true
}
```

### Pedidos

#### Criar Pedido
```http
POST /orders/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "deliveryAddress": {
    "street": "Rua das Flores",
    "city": "Lisboa",
    "postalCode": "1000-001"
  },
  "deliveryInstructions": "Entregar na portaria",
  "paymentMethod": "card"
}
```

#### Listar Pedidos do Utilizador
```http
GET /orders
Authorization: Bearer <token>
```

### Carrinho

#### Adicionar Item
```http
POST /cart/add-item
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "quantity": 2,
  "specialInstructions": "Sem açúcar"
}
```

#### Obter Carrinho
```http
GET /cart
Authorization: Bearer <token>
```

### Fidelidade

#### Obter Perfil de Fidelidade
```http
GET /loyalty/profile
Authorization: Bearer <token>
```

#### Usar Pontos
```http
POST /loyalty/use-points
Authorization: Bearer <token>
Content-Type: application/json

{
  "points": 100,
  "description": "Desconto em pedido"
}
```

### Entregas

#### Rastrear Entrega
```http
GET /delivery/tracking/:deliveryId
Authorization: Bearer <token>
```

#### Atualizar Localização (Motorista)
```http
PUT /delivery/driver/:deliveryId/update-location
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 38.7223,
  "longitude": -9.1393,
  "address": "Rua Augusta, Lisboa"
}
```

### Utilizadores

#### Obter Perfil
```http
GET /users/profile
Authorization: Bearer <token>
```

#### Atualizar Perfil
```http
PUT /users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "João Silva Santos",
  "phone": "+351987654321"
}
```

### Contacto

#### Enviar Mensagem
```http
POST /contact
Content-Type: application/json

{
  "name": "Maria Santos",
  "email": "maria@email.com",
  "subject": "Dúvida sobre encomendas",
  "message": "Gostaria de saber se fazem entregas aos domingos."
}
```

## 🔐 Autenticação e Autorização

### Roles de Utilizador
- **customer**: Cliente (padrão)
- **staff**: Funcionário da padaria
- **admin**: Administrador do sistema
- **driver**: Motorista de entrega

### Middleware de Autorização
- `authenticateToken`: Verifica JWT válido
- `requireAdmin`: Apenas administradores
- `requireStaff`: Staff e administradores
- `requireDriver`: Motoristas, staff e administradores
- `requireOwnershipOrAdmin`: Dono do recurso ou admin

## 📊 Modelos de Dados

### User
- Informações pessoais (nome, email, telefone)
- Endereço de entrega
- Role e status de atividade
- Sistema de fidelidade integrado
- Preferências e configurações

### Product
- Detalhes do produto (nome, descrição, preço)
- Categorias e tags
- Informações nutricionais e ingredientes
- Imagens e disponibilidade
- Sistema de avaliações

### Order
- Itens do pedido e quantidades
- Informações de entrega e pagamento
- Histórico de status
- Integração com sistema de fidelidade

### Cart
- Itens selecionados
- Cálculos automáticos (subtotal, taxas, descontos)
- Expiração automática
- Preferências de entrega

### Delivery
- Rastreamento em tempo real
- Atribuição de motoristas
- Histórico de status
- Cálculo de distâncias e tempos

### Loyalty
- Sistema de pontos
- Tiers e benefícios
- Histórico de transações
- Metas e recompensas

### Contact
- Gestão de mensagens
- Sistema de prioridades
- Atribuição a staff
- Histórico de respostas

## 🚀 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Servidor com nodemon

# Produção
npm start            # Servidor de produção
npm run build        # Build do projeto

# CSS
npm run build:css    # Build do CSS
npm run watch:css    # Watch do CSS
```

## 🔒 Segurança

- **Helmet**: Headers de segurança HTTP
- **Rate Limiting**: Proteção contra ataques de força bruta
- **CORS**: Configuração segura de Cross-Origin
- **JWT**: Tokens seguros com expiração
- **bcryptjs**: Hash seguro de senhas
- **Validação**: Sanitização de dados de entrada

## 📱 Integrações

- **Email**: Nodemailer para notificações
- **Pagamentos**: Stripe para processamento de cartões
- **Maps**: Google Maps API para localização
- **WhatsApp**: API Business para comunicação
- **Upload**: Multer para ficheiros

## 🧪 Testes

```bash
# Executar testes (quando implementados)
npm test

# Testes com coverage
npm run test:coverage
```

## 📈 Monitorização

- Logs estruturados
- Tratamento de erros centralizado
- Métricas de performance
- Health checks

## 🚀 Deploy

### Produção
```bash
# Build
npm run build

# Start
npm start

# PM2 (recomendado)
pm2 start server.js --name "sabores-portugueses"
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

Para suporte e dúvidas:
- Email: suporte@saboresportugueses.pt
- WhatsApp: +351123456789
- Documentação: [Wiki do Projeto](wiki-url)

## 🙏 Agradecimentos

- Equipa de desenvolvimento
- Comunidade open source
- Clientes e utilizadores
- Padaria "Sabores Portugueses"
