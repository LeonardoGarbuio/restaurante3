const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
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
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já está registado'
      });
    }

    // Verificar se o telefone já está em uso
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'Telefone já está registado'
      });
    }

    // Criar novo usuário
    const user = new User({
      name,
      email,
      phone,
      password,
      address
    });

    await user.save();

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remover password da resposta
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Utilizador registado com sucesso',
      data: {
        user: userResponse,
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
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada. Contacte o suporte.'
      });
    }

    // Verificar password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Atualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remover password da resposta
    const userResponse = user.toObject();
    delete userResponse.password;

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
      { userId: req.user._id },
      process.env.JWT_SECRET,
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
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    // Verificar password atual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password atual incorreta'
      });
    }

    // Atualizar password
    user.password = newPassword;
    await user.save();

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
    const user = await User.findOne({ email });
    if (!user) {
      // Por segurança, não revelar se o email existe ou não
      return res.json({
        success: true,
        message: 'Se o email estiver registado, receberá instruções para reset da password'
      });
    }

    // Gerar token de reset (válido por 1 hora)
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password_reset' },
      process.env.JWT_SECRET,
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Buscar usuário
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    // Atualizar password
    user.password = newPassword;
    await user.save();

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
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('preferences.favoriteProducts', 'name images price');

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
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email já está verificado'
      });
    }

    // Simular verificação de email
    user.emailVerified = true;
    await user.save();

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

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    if (user.phoneVerified) {
      return res.status(400).json({
        success: false,
        message: 'Telefone já está verificado'
      });
    }

    // Simular verificação de código (qualquer código funciona)
    if (code.length === 6) {
      user.phoneVerified = true;
      await user.save();

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
