const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateLoyaltyPoints, validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/loyalty/profile
// @desc    Obter perfil de fidelidade do usuário
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, loyalty_points, loyalty_tier FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Calcular próximo tier
    let nextTier = null;
    let pointsToNextTier = 0;

    if (user.loyalty_tier === 'bronze') {
      nextTier = 'silver';
      pointsToNextTier = 100 - user.loyalty_points;
    } else if (user.loyalty_tier === 'silver') {
      nextTier = 'gold';
      pointsToNextTier = 250 - user.loyalty_points;
    }

    res.json({
      success: true,
      data: {
        profile: {
          currentTier: user.loyalty_tier,
          currentPoints: user.loyalty_points,
          nextTier,
          pointsToNextTier: Math.max(0, pointsToNextTier)
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
router.get('/transactions', authenticateToken, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const transactions = db.prepare(`
      SELECT * FROM loyalty_transactions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(req.user.id, parseInt(limit), offset);

    // Contar total de transações
    const totalResult = db.prepare('SELECT COUNT(*) as total FROM loyalty_transactions WHERE user_id = ?').get(req.user.id);
    const total = totalResult.total;
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
    const rewards = db.prepare('SELECT * FROM loyalty_rewards WHERE is_active = 1 ORDER BY points_required ASC').all();

    res.json({
      success: true,
      data: {
        rewards
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
    const goals = db.prepare('SELECT * FROM loyalty_goals WHERE is_active = 1 ORDER BY points_target ASC').all();

    res.json({
      success: true,
      data: {
        goals
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
    const { points, description } = req.body;

    // Verificar se o usuário tem pontos suficientes
    const user = db.prepare('SELECT loyalty_points FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (user.loyalty_points < points) {
      return res.status(400).json({
        success: false,
        message: 'Pontos insuficientes'
      });
    }

    // Registrar transação
    const stmt = db.prepare(`
      INSERT INTO loyalty_transactions (user_id, points, type, description)
      VALUES (?, ?, 'used', ?)
    `);

    stmt.run(req.user.id, -points, description || 'Pontos utilizados');

    // Atualizar pontos do usuário
    db.prepare('UPDATE users SET loyalty_points = loyalty_points - ? WHERE id = ?').run(points, req.user.id);

    // Atualizar tier se necessário
    const updatedUser = db.prepare('SELECT loyalty_points, loyalty_tier FROM users WHERE id = ?').get(req.user.id);
    
    let newTier = updatedUser.loyalty_tier;
    if (updatedUser.loyalty_points < 100 && updatedUser.loyalty_tier !== 'bronze') {
      newTier = 'bronze';
    } else if (updatedUser.loyalty_points < 250 && updatedUser.loyalty_tier !== 'silver') {
      newTier = 'silver';
    } else if (updatedUser.loyalty_points >= 250 && updatedUser.loyalty_tier !== 'gold') {
      newTier = 'gold';
    }

    if (newTier !== updatedUser.loyalty_tier) {
      db.prepare('UPDATE users SET loyalty_tier = ? WHERE id = ?').run(newTier, req.user.id);
    }

    res.json({
      success: true,
      message: 'Pontos utilizados com sucesso',
      data: {
        pointsUsed: points,
        remainingPoints: updatedUser.loyalty_points,
        currentTier: newTier
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
router.post('/admin/add-points', authenticateToken, requireStaff, validateLoyaltyPoints, async (req, res) => {
  try {
    const { userId, points, type, description } = req.body;

    // Verificar se o usuário existe
    const user = db.prepare('SELECT id, loyalty_points FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Registrar transação
    const stmt = db.prepare(`
      INSERT INTO loyalty_transactions (user_id, points, type, description)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(userId, points, type || 'bonus', description || 'Pontos adicionados por staff');

    // Atualizar pontos do usuário
    const newPoints = user.loyalty_points + points;
    db.prepare('UPDATE users SET loyalty_points = ? WHERE id = ?').run(newPoints, userId);

    // Atualizar tier se necessário
    let newTier = 'bronze';
    if (newPoints >= 250) {
      newTier = 'gold';
    } else if (newPoints >= 100) {
      newTier = 'silver';
    }

    db.prepare('UPDATE users SET loyalty_tier = ? WHERE id = ?').run(newTier, userId);

    res.json({
      success: true,
      message: 'Pontos adicionados com sucesso',
      data: {
        userId,
        pointsAdded: points,
        newTotal: newPoints,
        newTier
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

// @route   GET /api/loyalty/admin/user/:userId
// @desc    Obter perfil de fidelidade de um usuário (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/user/:userId', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = db.prepare('SELECT id, name, loyalty_points, loyalty_tier FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Obter transações recentes
    const recentTransactions = db.prepare(`
      SELECT * FROM loyalty_transactions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          loyaltyPoints: user.loyalty_points,
          loyaltyTier: user.loyalty_tier
        },
        recentTransactions
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
    // Total de usuários por tier
    const tierStats = db.prepare(`
      SELECT loyalty_tier, COUNT(*) as count 
      FROM users 
      GROUP BY loyalty_tier
    `).all();

    // Total de pontos distribuídos
    const totalPointsResult = db.prepare('SELECT SUM(loyalty_points) as total FROM users').get();
    const totalPoints = totalPointsResult.total || 0;

    // Transações do mês
    const monthlyTransactions = db.prepare(`
      SELECT COUNT(*) as count, SUM(points) as total 
      FROM loyalty_transactions 
      WHERE created_at >= date('now', 'start of month')
    `).get();

    // Usuários ativos (com pontos > 0)
    const activeUsersResult = db.prepare('SELECT COUNT(*) as count FROM users WHERE loyalty_points > 0').get();
    const activeUsers = activeUsersResult.count;

    res.json({
      success: true,
      data: {
        summary: {
          tierDistribution: tierStats,
          totalPoints,
          monthlyTransactions: {
            count: monthlyTransactions.count,
            total: monthlyTransactions.total || 0
          },
          activeUsers
        }
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

// @route   POST /api/loyalty/admin/rewards
// @desc    Criar nova recompensa (Admin)
// @access  Private (Admin)
router.post('/admin/rewards', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, pointsRequired, discountPercentage, discountAmount } = req.body;

    if (!name || !pointsRequired) {
      return res.status(400).json({
        success: false,
        message: 'Nome e pontos necessários são obrigatórios'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO loyalty_rewards (name, description, points_required, discount_percentage, discount_amount)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name, description, pointsRequired, discountPercentage || null, discountAmount || null);
    const rewardId = result.lastInsertRowid;

    const newReward = db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').get(rewardId);

    res.status(201).json({
      success: true,
      message: 'Recompensa criada com sucesso',
      data: {
        reward: newReward
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

// @route   POST /api/loyalty/admin/goals
// @desc    Criar nova meta de fidelidade (Admin)
// @access  Private (Admin)
router.post('/admin/goals', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, pointsTarget, rewardDescription } = req.body;

    if (!name || !pointsTarget) {
      return res.status(400).json({
        success: false,
        message: 'Nome e pontos alvo são obrigatórios'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO loyalty_goals (name, description, points_target, reward_description)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(name, description, pointsTarget, rewardDescription || null);
    const goalId = result.lastInsertRowid;

    const newGoal = db.prepare('SELECT * FROM loyalty_goals WHERE id = ?').get(goalId);

    res.status(201).json({
      success: true,
      message: 'Meta criada com sucesso',
      data: {
        goal: newGoal
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

module.exports = router;
