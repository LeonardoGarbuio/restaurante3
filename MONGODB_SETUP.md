# 🗄️ Configuração do MongoDB Local

## 📥 Instalação do MongoDB Community Server

### Windows
1. **Baixar MongoDB Community Server:**
   - Acesse: https://www.mongodb.com/try/download/community
   - Selecione: Windows x64
   - Clique em "Download"

2. **Instalar:**
   - Execute o arquivo .msi baixado
   - Siga o assistente de instalação
   - **IMPORTANTE:** Marque "Install MongoDB as a Service"

3. **Verificar instalação:**
   ```bash
   # Abrir PowerShell como Administrador
   Get-Service MongoDB
   ```

### macOS
```bash
# Usando Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Iniciar serviço
brew services start mongodb/brew/mongodb-community
```

### Linux (Ubuntu)
```bash
# Importar chave pública
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Adicionar repositório
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Instalar
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar serviço
sudo systemctl start mongod
sudo systemctl enable mongod
```

## 🔧 Configuração do Projeto

1. **Criar arquivo .env:**
   ```bash
   # Copiar o arquivo de exemplo
   cp .env.example .env
   ```

2. **Editar .env:**
   ```env
   # MongoDB Local
   MONGODB_URI=mongodb://localhost:27017/sabores-portugueses
   
   # JWT
   JWT_SECRET=sua_chave_secreta_aqui
   ```

## 🚀 Iniciar o Servidor

1. **Verificar se MongoDB está rodando:**
   ```bash
   # Windows (PowerShell como Admin)
   Get-Service MongoDB
   
   # macOS/Linux
   sudo systemctl status mongod
   ```

2. **Iniciar o projeto:**
   ```bash
   npm install
   npm run dev
   ```

## 🗂️ MongoDB Compass (Interface Gráfica)

1. **Baixar MongoDB Compass:**
   - https://www.mongodb.com/try/download/compass

2. **Conectar ao banco local:**
   - URI: `mongodb://localhost:27017`
   - Clique em "Connect"

3. **Ver o banco:**
   - Banco: `sabores-portugueses`
   - Coleções serão criadas automaticamente

## 📊 Estrutura do Banco

O banco `sabores-portugueses` será criado automaticamente com as seguintes coleções:

- **users** - Utilizadores do sistema
- **products** - Produtos da padaria
- **orders** - Pedidos dos clientes
- **carts** - Carrinhos de compra
- **deliveries** - Entregas
- **contacts** - Mensagens de contacto
- **loyalties** - Sistema de fidelidade

## 🔍 Verificar Conexão

Quando o servidor iniciar, você deve ver:
```
✅ MongoDB conectado: localhost:27017
🗄️  Banco: sabores-portugueses
🚀 Servidor rodando na porta 5000
```

## ❌ Solução de Problemas

### Erro: "MongoDB não está rodando"
```bash
# Windows
Get-Service MongoDB
Start-Service MongoDB

# macOS
brew services start mongodb/brew/mongodb-community

# Linux
sudo systemctl start mongod
```

### Erro: "Porta 27017 em uso"
```bash
# Verificar processos
netstat -ano | findstr :27017

# Matar processo (Windows)
taskkill /PID <PID> /F
```

### Erro: "Permissão negada"
- Execute o terminal como Administrador
- Verifique se o serviço MongoDB está rodando
