const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateRegister, validateLogin, validatePasswordChange } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Registar novo usuário
// @access  Public
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { name, email, phone, password, address } = req.body;

    // Verificar se o usuário já existe
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já está registado'
      });
    }

    // Verificar se o telefone já está em uso
    const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'Telefone já está registado'
      });
    }

    // Hash da password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Criar novo usuário
    const stmt = db.prepare(`
      INSERT INTO users (name, email, phone, password, street, city, postal_code, lat, lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      name, 
      email, 
      phone, 
      hashedPassword, 
      address.street, 
      address.city, 
      address.postalCode,
      address.coordinates?.lat || null,
      address.coordinates?.lng || null
    );

    const userId = result.lastInsertRowid;

    // Gerar token JWT
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    // Buscar usuário criado (sem password)
    const user = db.prepare('SELECT id, name, email, phone, street, city, postal_code, role, loyalty_points, loyalty_tier, created_at FROM users WHERE id = ?').get(userId);

    res.status(201).json({
      success: true,
      message: 'Utilizador registado com sucesso',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Erro no registo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Autenticar usuário
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuário com password
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada. Contacte o suporte.'
      });
    }

    // Verificar password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Atualizar último login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    // Remover password da resposta
    const { password: _, ...userResponse } = user;

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Renovar token JWT
// @access  Private
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Gerar novo token
    const token = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      data: {
        token
      }
    });
  } catch (error) {
    console.error('Erro na renovação do token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Fazer logout (invalidar token no frontend)
// @access  Private
router.post('/logout', authenticateToken, (req, res) => {
  // No JWT, o logout é feito no frontend removendo o token
  // Aqui podemos registrar o logout para auditoria se necessário
  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
});

// @route   POST /api/auth/change-password
// @desc    Alterar password
// @access  Private
router.post('/change-password', authenticateToken, validatePasswordChange, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Buscar usuário com password atual
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    // Verificar password atual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password atual incorreta'
      });
    }

    // Hash da nova password
    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Atualizar password
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedNewPassword, req.user.id);

    res.json({
      success: true,
      message: 'Password alterada com sucesso'
    });
  } catch (error) {
    console.error('Erro na alteração de password:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Solicitar reset de password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email é obrigatório'
      });
    }

    // Verificar se o usuário existe
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) {
      // Por segurança, não revelar se o email existe ou não
      return res.json({
        success: true,
        message: 'Se o email estiver registado, receberá instruções para reset da password'
      });
    }

    // Gerar token de reset (válido por 1 hora)
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' }
    );

    // TODO: Enviar email com link de reset
    // Por agora, apenas retornar sucesso
    res.json({
      success: true,
      message: 'Se o email estiver registado, receberá instruções para reset da password'
    });
  } catch (error) {
    console.error('Erro no forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset de password com token
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token e nova password são obrigatórios'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Buscar usuário
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    // Hash da nova password
    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Atualizar password
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedNewPassword, decoded.userId);

    res.json({
      success: true,
      message: 'Password alterada com sucesso'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Token expirado'
      });
    }

    console.error('Erro no reset de password:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Obter dados do usuário autenticado
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Buscar usuário com dados atualizados
    const user = db.prepare(`
      SELECT id, name, email, phone, street, city, postal_code, lat, lng, 
             role, loyalty_points, loyalty_tier, is_active, email_verified, 
             phone_verified, dietary_restrictions, delivery_instructions, 
             marketing_emails, sms_notifications, last_login, created_at, updated_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verificar email (simulado)
// @access  Private
router.post('/verify-email', authenticateToken, async (req, res) => {
  try {
    const user = db.prepare('SELECT id, email_verified FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email já está verificado'
      });
    }

    // Simular verificação de email
    db.prepare('UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.user.id);

    res.json({
      success: true,
      message: 'Email verificado com sucesso'
    });
  } catch (error) {
    console.error('Erro na verificação de email:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/auth/verify-phone
// @desc    Verificar telefone (simulado)
// @access  Private
router.post('/verify-phone', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Código de verificação é obrigatório'
      });
    }

    const user = db.prepare('SELECT id, phone_verified FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    if (user.phone_verified) {
      return res.status(400).json({
        success: false,
        message: 'Telefone já está verificado'
      });
    }

    // Simular verificação de código (qualquer código funciona)
    if (code.length === 6) {
      db.prepare('UPDATE users SET phone_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.user.id);

      res.json({
        success: true,
        message: 'Telefone verificado com sucesso'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Código de verificação inválido'
      });
    }
  } catch (error) {
    console.error('Erro na verificação de telefone:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
