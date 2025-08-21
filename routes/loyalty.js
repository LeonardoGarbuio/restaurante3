const express = require('express');
const Loyalty = require('../models/Loyalty');
const User = require('../models/User');
const { authenticateToken, requireLoyaltyOwnershipOrStaff, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateLoyaltyPoints, validateMongoId } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/loyalty/profile
// @desc    Obter perfil de fidelidade do usuário
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    let loyalty = await Loyalty.findOne({ user: req.user._id });

    if (!loyalty) {
      // Criar perfil de fidelidade se não existir
      loyalty = new Loyalty({
        user: req.user._id
      });
      await loyalty.save();
    }

    // Buscar usuário para informações adicionais
    const user = await User.findById(req.user._id).select('name email');

    res.json({
      success: true,
      data: {
        loyalty: {
          _id: loyalty._id,
          points: loyalty.points,
          tier: loyalty.tier.current,
          tierInPortuguese: loyalty.getTierInPortuguese(),
          benefits: loyalty.benefits,
          nextTier: loyalty.getNextTier(),
          progressToNextTier: loyalty.getProgressToNextTier(),
          statistics: loyalty.statistics
        },
        user: {
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter perfil de fidelidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/loyalty/transactions
// @desc    Obter histórico de transações de fidelidade
// @access  Private
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const loyalty = await Loyalty.findOne({ user: req.user._id });
    
    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de fidelidade não encontrado'
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Paginar transações
    const transactions = loyalty.transactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + parseInt(limit));

    const total = loyalty.transactions.length;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTransactions: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter transações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/loyalty/rewards
// @desc    Obter recompensas disponíveis
// @access  Private
router.get('/rewards', authenticateToken, async (req, res) => {
  try {
    const loyalty = await Loyalty.findOne({ user: req.user._id });
    
    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de fidelidade não encontrado'
      });
    }

    // Filtrar recompensas ativas
    const activeRewards = loyalty.rewards.filter(reward => 
      reward.isActive && (!reward.expiresAt || reward.expiresAt > new Date())
    );

    res.json({
      success: true,
      data: {
        rewards: activeRewards,
        availablePoints: loyalty.points.current
      }
    });
  } catch (error) {
    console.error('Erro ao obter recompensas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/loyalty/goals
// @desc    Obter metas de fidelidade
// @access  Private
router.get('/goals', authenticateToken, async (req, res) => {
  try {
    const loyalty = await Loyalty.findOne({ user: req.user._id });
    
    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de fidelidade não encontrado'
      });
    }

    // Filtrar metas ativas
    const activeGoals = loyalty.goals.filter(goal => 
      !goal.isCompleted && (!goal.expiresAt || goal.expiresAt > new Date())
    );

    res.json({
      success: true,
      data: {
        goals: activeGoals,
        completedGoals: loyalty.goals.filter(goal => goal.isCompleted)
      }
    });
  } catch (error) {
    console.error('Erro ao obter metas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/loyalty/use-points
// @desc    Usar pontos de fidelidade
// @access  Private
router.post('/use-points', authenticateToken, validateLoyaltyPoints, async (req, res) => {
  try {
    const { points, description, orderId } = req.body;

    const loyalty = await Loyalty.findOne({ user: req.user._id });
    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de fidelidade não encontrado'
      });
    }

    if (!loyalty.canUsePoints(points)) {
      return res.status(400).json({
        success: false,
        message: 'Pontos insuficientes'
      });
    }

    // Usar pontos
    await loyalty.usePoints(points, description, orderId);

    res.json({
      success: true,
      message: 'Pontos utilizados com sucesso',
      data: {
        loyalty: {
          points: loyalty.points.current,
          tier: loyalty.tier.current,
          tierInPortuguese: loyalty.getTierInPortuguese()
        }
      }
    });
  } catch (error) {
    console.error('Erro ao usar pontos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/loyalty/admin/add-points
// @desc    Adicionar pontos de fidelidade (Admin/Staff)
// @access  Private (Staff/Admin)
router.post('/admin/add-points', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { userId, points, description, expiresIn } = req.body;

    if (!userId || !points || !description) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário, pontos e descrição são obrigatórios'
      });
    }

    // Verificar se o usuário existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Buscar ou criar perfil de fidelidade
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) {
      loyalty = new Loyalty({ user: userId });
    }

    // Adicionar pontos
    await loyalty.addPoints(points, description, null, expiresIn);

    res.json({
      success: true,
      message: 'Pontos adicionados com sucesso',
      data: {
        loyalty: {
          _id: loyalty._id,
          points: loyalty.points.current,
          tier: loyalty.tier.current,
          tierInPortuguese: loyalty.getTierInPortuguese()
        },
        user: {
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('Erro ao adicionar pontos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/loyalty/admin/adjust-points
// @desc    Ajustar pontos de fidelidade (Admin)
// @access  Private (Admin)
router.post('/admin/adjust-points', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, points, description, reason } = req.body;

    if (!userId || !points || !description || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos são obrigatórios'
      });
    }

    // Verificar se o usuário existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Buscar perfil de fidelidade
    const loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de fidelidade não encontrado'
      });
    }

    // Adicionar transação de ajuste
    const transaction = {
      type: 'adjustment',
      amount: points,
      description: `${description} - ${reason}`,
      createdAt: new Date()
    };

    loyalty.transactions.push(transaction);
    loyalty.points.current += points;
    loyalty.points.total += points;

    // Atualizar tier se necessário
    loyalty.updateTier();

    await loyalty.save();

    res.json({
      success: true,
      message: 'Pontos ajustados com sucesso',
      data: {
        loyalty: {
          _id: loyalty._id,
          points: loyalty.points.current,
          tier: loyalty.tier.current,
          tierInPortuguese: loyalty.getTierInPortuguese()
        },
        user: {
          name: user.name,
          email: user.email
        },
        adjustment: {
          points,
          reason,
          newTotal: loyalty.points.current
        }
      }
    });
  } catch (error) {
    console.error('Erro ao ajustar pontos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/loyalty/admin/user/:userId
// @desc    Obter perfil de fidelidade de um usuário (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/user/:userId', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { userId } = req.params;

    const loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de fidelidade não encontrado'
      });
    }

    const user = await User.findById(userId).select('name email phone');

    res.json({
      success: true,
      data: {
        loyalty: {
          _id: loyalty._id,
          points: loyalty.points,
          tier: loyalty.tier,
          benefits: loyalty.benefits,
          statistics: loyalty.statistics,
          transactions: loyalty.transactions.slice(-10), // Últimas 10 transações
          rewards: loyalty.rewards,
          goals: loyalty.goals
        },
        user
      }
    });
  } catch (error) {
    console.error('Erro ao obter perfil de fidelidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/loyalty/admin/stats/summary
// @desc    Obter estatísticas de fidelidade (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/stats/summary', authenticateToken, requireStaff, async (req, res) => {
  try {
    // Estatísticas gerais
    const totalUsers = await Loyalty.countDocuments();
    const totalPoints = await Loyalty.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$points.current' }
        }
      }
    ]);

    // Distribuição por tier
    const tierDistribution = await Loyalty.aggregate([
      {
        $group: {
          _id: '$tier.current',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points.current' }
        }
      }
    ]);

    // Top usuários por pontos
    const topUsers = await Loyalty.find()
      .sort({ 'points.current': -1 })
      .limit(10)
      .populate('user', 'name email')
      .select('points.current tier.current user');

    // Estatísticas de transações
    const transactionStats = await Loyalty.aggregate([
      {
        $unwind: '$transactions'
      },
      {
        $group: {
          _id: '$transactions.type',
          count: { $sum: 1 },
          totalPoints: { $sum: '$transactions.amount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers,
          totalPoints: totalPoints[0]?.total || 0,
          averagePoints: totalPoints[0]?.total / totalUsers || 0
        },
        tierDistribution,
        topUsers,
        transactionStats
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

// @route   POST /api/loyalty/admin/create-reward
// @desc    Criar nova recompensa (Admin)
// @access  Private (Admin)
router.post('/admin/create-reward', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, pointsCost, discountAmount, discountPercentage, freeProduct } = req.body;

    if (!name || !pointsCost) {
      return res.status(400).json({
        success: false,
        message: 'Nome e custo em pontos são obrigatórios'
      });
    }

    // Criar recompensa global (será aplicada a todos os usuários)
    const reward = {
      name,
      description,
      pointsCost: parseInt(pointsCost),
      discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
      discountPercentage: discountPercentage ? parseFloat(discountPercentage) : undefined,
      freeProduct: freeProduct || undefined,
      isActive: true
    };

    // Aplicar a todos os usuários
    await Loyalty.updateMany(
      {},
      { $push: { rewards: reward } }
    );

    res.json({
      success: true,
      message: 'Recompensa criada com sucesso',
      data: {
        reward
      }
    });
  } catch (error) {
    console.error('Erro ao criar recompensa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/loyalty/admin/create-goal
// @desc    Criar nova meta (Admin)
// @access  Private (Admin)
router.post('/admin/create-goal', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, targetPoints, reward, expiresIn } = req.body;

    if (!name || !targetPoints || !reward) {
      return res.status(400).json({
        success: false,
        message: 'Nome, pontos alvo e recompensa são obrigatórios'
      });
    }

    // Criar meta global
    const goal = {
      name,
      description,
      targetPoints: parseInt(targetPoints),
      reward,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : undefined,
      isCompleted: false
    };

    // Aplicar a todos os usuários
    await Loyalty.updateMany(
      {},
      { $push: { goals: goal } }
    );

    res.json({
      success: true,
      message: 'Meta criada com sucesso',
      data: {
        goal
      }
    });
  } catch (error) {
    console.error('Erro ao criar meta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/loyalty/preferences
// @desc    Atualizar preferências de fidelidade
// @access  Private
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { emailNotifications, smsNotifications, pushNotifications, marketingEmails, birthdayRewards } = req.body;

    const loyalty = await Loyalty.findOne({ user: req.user._id });
    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de fidelidade não encontrado'
      });
    }

    // Atualizar preferências
    if (emailNotifications !== undefined) loyalty.preferences.emailNotifications = emailNotifications;
    if (smsNotifications !== undefined) loyalty.preferences.smsNotifications = smsNotifications;
    if (pushNotifications !== undefined) loyalty.preferences.pushNotifications = pushNotifications;
    if (marketingEmails !== undefined) loyalty.preferences.marketingEmails = marketingEmails;
    if (birthdayRewards !== undefined) loyalty.preferences.birthdayRewards = birthdayRewards;

    await loyalty.save();

    res.json({
      success: true,
      message: 'Preferências atualizadas com sucesso',
      data: {
        preferences: loyalty.preferences
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar preferências:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
