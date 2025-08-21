# 🚀 Configuração Render + SQLite (Automático!)

## 🎯 **Vantagens do SQLite na Render:**

✅ **ZERO configuração** - A Render cria o banco automaticamente  
✅ **ZERO variáveis de ambiente** para banco de dados  
✅ **Funciona imediatamente** após deploy  
✅ **Banco persistente** na pasta `/tmp`  
✅ **Sem serviços externos** para configurar  

## 📋 **Passo a Passo:**

### **1. 🚀 Fazer Deploy na Render**

1. **Conecte seu GitHub** à Render
2. **Crie novo serviço** → **Web Service**
3. **Selecione o repositório** `1_venda`
4. **Branch:** `main`
5. **Build Command:** `npm install && npm run build`
6. **Start Command:** `npm start`
7. **Clique:** "Create Web Service"

### **2. ⚙️ Configurar Variáveis (Opcional)**

**Environment Variables:**
```
JWT_SECRET = sabores_portugueses_super_secret_key_2024
NODE_ENV = production
```

**⚠️ IMPORTANTE:** `MONGODB_URI` NÃO é necessária!

### **3. 🎉 Pronto!**

O banco SQLite será criado automaticamente na primeira execução!

## 🔍 **Verificar Funcionamento:**

### **Logs de Sucesso:**
```
🗄️  Inicializando banco SQLite...
✅ Banco SQLite inicializado com sucesso!
📍 Caminho: /tmp/sabores-portugueses.db
🌐 Ambiente: PRODUÇÃO (Render)
```

### **Testar API:**
```bash
# Registrar usuário
curl -X POST https://seu-app.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "email": "teste@email.com",
    "phone": "+351912345678",
    "password": "123456",
    "address": {
      "street": "Rua Teste",
      "city": "Lisboa",
      "postalCode": "1000-001"
    }
  }'
```

## 🗄️ **Estrutura do Banco:**

O SQLite criará automaticamente estas tabelas:
- 👥 **users** - Usuários e clientes
- 🛍️ **products** - Produtos do menu
- 📦 **orders** - Pedidos dos clientes
- 🛒 **cart_items** - Carrinho de compras
- 🎁 **loyalty_transactions** - Sistema de fidelidade
- 🚚 **deliveries** - Rastreamento de entregas
- 📞 **contacts** - Mensagens de contato

## ❌ **Solução de Problemas:**

### **Erro: "Cannot find module 'better-sqlite3'"**
- **Solução:** A Render instalará automaticamente via `package.json`

### **Erro: "Database locked"**
- **Solução:** Normalmente resolve sozinho, é temporário

### **Erro: "Permission denied"**
- **Solução:** A Render usa `/tmp` que tem permissões corretas

## 🎯 **Resultado Final:**

✅ **Backend funcionando** na Render  
✅ **Banco SQLite** criado automaticamente  
✅ **API completa** disponível  
✅ **Sistema de padaria** online funcionando  

## 📱 **URLs:**

- **Frontend:** https://seu-app.onrender.com
- **API:** https://seu-app.onrender.com/api
- **Landing Page:** https://seu-app.onrender.com/landing

## 🚀 **Próximos Passos:**

1. **Testar todos os endpoints** da API
2. **Configurar domínio personalizado** (opcional)
3. **Implementar monitoramento** e logs
4. **Configurar backup** do banco (opcional)

---

**🎉 É isso! Com SQLite, a Render faz tudo automaticamente!**
