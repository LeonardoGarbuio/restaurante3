# 🥖 Sabores Portugueses - Sistema de Padaria

Sistema completo de e-commerce para padaria portuguesa com gestão administrativa, carrinho de compras e produtos em destaque.

## 🚀 Funcionalidades

### **Frontend**
- ✅ Landing page responsiva com produtos em destaque
- ✅ Menu completo com filtros por categoria
- ✅ Carrinho de compras sincronizado
- ✅ Sistema de navegação intuitivo
- ✅ Design moderno e responsivo

### **Backend**
- ✅ API RESTful completa
- ✅ Sistema de autenticação JWT
- ✅ Gestão de produtos (CRUD)
- ✅ Upload de imagens
- ✅ Banco de dados SQLite
- ✅ Painel administrativo

### **Administração**
- ✅ Login seguro
- ✅ Gestão de produtos
- ✅ Sistema de destaque (máximo 6 produtos)
- ✅ Upload e gestão de imagens
- ✅ Reordenação de produtos
- ✅ Dashboard com estatísticas

## 🛠️ Tecnologias

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Banco de Dados**: SQLite3
- **Autenticação**: JWT (JSON Web Tokens)
- **Upload**: Multer
- **Estilização**: CSS Custom + Tailwind CSS

## 📦 Instalação

### **Pré-requisitos**
- Node.js (versão 14 ou superior)
- npm ou yarn

### **Passos**

1. **Clone o repositório**
```bash
git clone [URL_DO_REPOSITORIO]
cd sabores-portugueses
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
# Crie um arquivo .env na raiz do projeto
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. **Inicie o servidor**
```bash
npm start
# ou
node server.js
```

5. **Acesse a aplicação**
- Frontend: http://localhost:5000
- API: http://localhost:5000/api

## 🔧 Configuração

### **Variáveis de Ambiente**
Crie um arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=24h

# Banco de Dados
DB_PATH=./data/padaria.db

# Upload
UPLOAD_PATH=./public/uploads
MAX_FILE_SIZE=5242880
```

### **Estrutura de Pastas**
```
sabores-portugueses/
├── config/
│   ├── database.js
│   └── admin.js
├── routes/
│   ├── admin-auth.js
│   ├── admin-products.js
│   └── delivery.js
├── middleware/
│   └── admin-auth.js
├── pages/
│   ├── landing_page.html
│   ├── menu_simples.html
│   ├── admin-login.html
│   └── admin-panel.html
├── css/
│   ├── main.css
│   └── admin.css
├── public/
│   └── uploads/
├── data/
├── server.js
└── package.json
```

## 🎯 Como Usar

### **Acesso Administrativo**
1. Acesse a landing page
2. Role até o footer
3. Clique no ícone ⚙️ (engrenagem)
4. Faça login com suas credenciais

### **Gestão de Produtos**
- **Adicionar Produto**: Preencha o formulário e faça upload da imagem
- **Editar Produto**: Clique em "Editar" na tabela de produtos
- **Produtos em Destaque**: Marque até 6 produtos para aparecer na landing page
- **Reordenar**: Use as setas ↑↓ para reordenar produtos em destaque

### **Carrinho de Compras**
- Adicione produtos ao carrinho
- Visualize itens no modal do carrinho
- Quantidades são sincronizadas entre páginas
- Dados persistem no localStorage

## 🔒 Segurança

- Autenticação JWT com expiração
- Validação de entrada de dados
- Sanitização de uploads
- Proteção contra XSS básica
- Rotas administrativas protegidas

## 📱 Responsividade

O sistema é totalmente responsivo e funciona em:
- 📱 Dispositivos móveis
- 💻 Tablets
- 🖥️ Desktops

## 🚀 Deploy

### **Local**
```bash
npm start
```

### **Produção**
1. Configure variáveis de ambiente para produção
2. Use PM2 ou similar para gerenciar processos
3. Configure HTTPS
4. Configure backup do banco de dados

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte, entre em contato através dos canais oficiais da padaria.

---

**Desenvolvido com ❤️ para Sabores Portugueses**
