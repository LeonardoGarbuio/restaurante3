const express = require('express');
const User = require('../models/User');
const { authenticateToken, requireOwnershipOrAdmin, requireAdmin, requireStaff } = require('../middleware/auth');
const { validateProfileUpdate, validatePasswordChange, validateMongoId, validatePagination } = require('../middleware/validation');
const bcrypt = require('bcryptjs');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Obter perfil do usuário autenticado
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-hashedPassword');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Atualizar perfil do usuário
// @access  Private
router.put('/profile', authenticateToken, validateProfileUpdate, async (req, res) => {
  try {
    const { name, email, phone, address, preferences } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar se o email já está em uso por outro usuário
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Este email já está em uso'
        });
      }
    }

    // Atualizar campos
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();

    // Retornar usuário sem senha
    const userResponse = user.toObject();
    delete userResponse.hashedPassword;

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/users/change-password
// @desc    Alterar senha do usuário
// @access  Private
router.put('/change-password', authenticateToken, validatePasswordChange, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Hash da nova senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    user.hashedPassword = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Desativar conta do usuário
// @access  Private
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Desativar conta (soft delete)
    user.isActive = false;
    user.deactivatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Conta desativada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao desativar conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/users/admin/all
// @desc    Obter todos os usuários (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/all', authenticateToken, requireStaff, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros
    const filters = {};
    if (role) filters.role = role;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filters)
      .select('-hashedPassword')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filters);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/users/admin/:userId
// @desc    Obter usuário específico (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/:userId', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-hashedPassword');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/users/admin/:userId/update
// @desc    Atualizar usuário (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:userId/update', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, role, isActive, address, preferences } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar se o email já está em uso por outro usuário
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Este email já está em uso'
        });
      }
    }

    // Atualizar campos
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (address) user.address = address;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();

    // Retornar usuário sem senha
    const userResponse = user.toObject();
    delete userResponse.hashedPassword;

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/users/admin/:userId/reset-password
// @desc    Redefinir senha do usuário (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:userId/reset-password', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Nova senha é obrigatória'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Hash da nova senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    user.hashedPassword = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/users/admin/:userId/toggle-status
// @desc    Ativar/Desativar usuário (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:userId/toggle-status', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Alternar status
    user.isActive = !user.isActive;
    if (!user.isActive) {
      user.deactivatedAt = new Date();
    } else {
      user.deactivatedAt = undefined;
    }

    await user.save();

    res.json({
      success: true,
      message: `Usuário ${user.isActive ? 'ativado' : 'desativado'} com sucesso`,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    console.error('Erro ao alternar status do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/users/admin/stats/summary
// @desc    Obter estatísticas de usuários (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/stats/summary', authenticateToken, requireStaff, async (req, res) => {
  try {
    // Total de usuários
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });

    // Distribuição por role
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Usuários por mês (últimos 12 meses)
    const monthlyUsers = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().getFullYear(), 0, 1)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Usuários verificados
    const verifiedUsers = await User.countDocuments({
      'verification.emailVerified': true,
      'verification.phoneVerified': true
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          verifiedUsers
        },
        roleDistribution,
        monthlyUsers
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/users/admin/create
// @desc    Criar novo usuário (Admin)
// @access  Private (Admin)
router.post('/admin/create', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, role, address } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email, senha e role são obrigatórios'
      });
    }

    // Verificar se o email já está em uso
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está em uso'
      });
    }

    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const user = new User({
      name,
      email,
      phone,
      hashedPassword,
      role,
      address,
      isActive: true
    });

    await user.save();

    // Retornar usuário sem senha
    const userResponse = user.toObject();
    delete userResponse.hashedPassword;

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/users/admin/:userId
// @desc    Excluir usuário permanentemente (Admin)
// @access  Private (Admin)
router.delete('/admin/:userId', authenticateToken, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar se não está tentando excluir a si mesmo
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível excluir sua própria conta'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Exclusão permanente
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Usuário excluído permanentemente'
    });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/users/admin/search
// @desc    Pesquisar usuários (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/search', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { query, role, isActive } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query de pesquisa é obrigatória'
      });
    }

    // Construir filtros
    const filters = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ]
    };

    if (role) filters.role = role;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const users = await User.find(filters)
      .select('-hashedPassword')
      .limit(20)
      .sort({ name: 1 });

    res.json({
      success: true,
      data: {
        users,
        totalResults: users.length
      }
    });
  } catch (error) {
    console.error('Erro ao pesquisar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
