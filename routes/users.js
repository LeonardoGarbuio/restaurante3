const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireOwnershipOrAdmin, requireAdmin, requireStaff } = require('../middleware/auth');
const { validateProfileUpdate, validatePasswordChange, validatePagination } = require('../middleware/validation');
const bcrypt = require('bcryptjs');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Obter perfil do usuário autenticado
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, phone, street, city, postal_code, lat, lng, role, loyalty_points, loyalty_tier, is_active, email_verified, phone_verified, dietary_restrictions, delivery_instructions, marketing_emails, sms_notifications, last_login, created_at, updated_at FROM users WHERE id = ?').get(req.user.id);
    
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

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar se o email já está em uso por outro usuário
    if (email && email !== user.email) {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Este email já está em uso'
        });
      }
    }

    // Construir query de atualização
    const updateFields = [];
    const params = [];
    
    if (name) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (email) {
      updateFields.push('email = ?');
      params.push(email);
    }
    if (phone) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    if (address) {
      if (address.street) {
        updateFields.push('street = ?');
        params.push(address.street);
      }
      if (address.city) {
        updateFields.push('city = ?');
        params.push(address.city);
      }
      if (address.postalCode) {
        updateFields.push('postal_code = ?');
        params.push(address.postalCode);
      }
      if (address.coordinates) {
        if (address.coordinates.lat) {
          updateFields.push('lat = ?');
          params.push(address.coordinates.lat);
        }
        if (address.coordinates.lng) {
          updateFields.push('lng = ?');
          params.push(address.coordinates.lng);
        }
      }
    }
    if (preferences) {
      if (preferences.dietaryRestrictions) {
        updateFields.push('dietary_restrictions = ?');
        params.push(JSON.stringify(preferences.dietaryRestrictions));
      }
      if (preferences.deliveryInstructions) {
        updateFields.push('delivery_instructions = ?');
        params.push(preferences.deliveryInstructions);
      }
      if (preferences.marketingEmails !== undefined) {
        updateFields.push('marketing_emails = ?');
        params.push(preferences.marketingEmails ? 1 : 0);
      }
      if (preferences.smsNotifications !== undefined) {
        updateFields.push('sms_notifications = ?');
        params.push(preferences.smsNotifications ? 1 : 0);
      }
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.user.id);

      const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      db.prepare(updateQuery).run(...params);
    }

    // Buscar usuário atualizado
    const updatedUser = db.prepare('SELECT id, name, email, phone, street, city, postal_code, lat, lng, role, loyalty_points, loyalty_tier, is_active, email_verified, phone_verified, dietary_restrictions, delivery_instructions, marketing_emails, sms_notifications, last_login, created_at, updated_at FROM users WHERE id = ?').get(req.user.id);

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: {
        user: updatedUser
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

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Hash da nova senha
    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Atualizar senha
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedNewPassword, req.user.id);

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
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Desativar conta (soft delete)
    db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.user.id);

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
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir query SQL
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }
    if (search) {
      whereClause += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const usersQuery = `
      SELECT id, name, email, phone, street, city, postal_code, role, loyalty_points, loyalty_tier, is_active, created_at, updated_at 
      FROM users 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const users = db.prepare(usersQuery).all(...params, parseInt(limit), offset);

    // Contar total de usuários
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;
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
router.get('/admin/:userId', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = db.prepare('SELECT id, name, email, phone, street, city, postal_code, role, loyalty_points, loyalty_tier, is_active, created_at, updated_at FROM users WHERE id = ?').get(userId);
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
router.put('/admin/:userId/update', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, role, isActive, address, preferences } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar se o email já está em uso por outro usuário
    if (email && email !== user.email) {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Este email já está em uso'
        });
      }
    }

    // Construir query de atualização
    const updateFields = [];
    const params = [];
    
    if (name) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (email) {
      updateFields.push('email = ?');
      params.push(email);
    }
    if (phone) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    if (role) {
      updateFields.push('role = ?');
      params.push(role);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (address) {
      if (address.street) {
        updateFields.push('street = ?');
        params.push(address.street);
      }
      if (address.city) {
        updateFields.push('city = ?');
        params.push(address.city);
      }
      if (address.postalCode) {
        updateFields.push('postal_code = ?');
        params.push(address.postalCode);
      }
      if (address.coordinates) {
        if (address.coordinates.lat) {
          updateFields.push('lat = ?');
          params.push(address.coordinates.lat);
        }
        if (address.coordinates.lng) {
          updateFields.push('lng = ?');
          params.push(address.coordinates.lng);
        }
      }
    }
    if (preferences) {
      if (preferences.dietaryRestrictions) {
        updateFields.push('dietary_restrictions = ?');
        params.push(JSON.stringify(preferences.dietaryRestrictions));
      }
      if (preferences.deliveryInstructions) {
        updateFields.push('delivery_instructions = ?');
        params.push(preferences.deliveryInstructions);
      }
      if (preferences.marketingEmails !== undefined) {
        updateFields.push('marketing_emails = ?');
        params.push(preferences.marketingEmails ? 1 : 0);
      }
      if (preferences.smsNotifications !== undefined) {
        updateFields.push('sms_notifications = ?');
        params.push(preferences.smsNotifications ? 1 : 0);
      }
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(userId);

      const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      db.prepare(updateQuery).run(...params);
    }

    // Buscar usuário atualizado
    const updatedUser = db.prepare('SELECT id, name, email, phone, street, city, postal_code, role, loyalty_points, loyalty_tier, is_active, created_at, updated_at FROM users WHERE id = ?').get(userId);

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: {
        user: updatedUser
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
router.put('/admin/:userId/reset-password', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Nova senha é obrigatória'
      });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Hash da nova senha
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Atualizar senha
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, userId);

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
router.put('/admin/:userId/toggle-status', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = db.prepare('SELECT id, name, email, is_active FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Alternar status
    const newStatus = user.is_active ? 0 : 1;
    
    db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, userId);

    res.json({
      success: true,
      message: `Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso`,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isActive: newStatus === 1
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
    const totalUsers = db.prepare('SELECT COUNT(*) as total FROM users').get().total;
    const activeUsers = db.prepare('SELECT COUNT(*) as total FROM users WHERE is_active = 1').get().total;
    const inactiveUsers = db.prepare('SELECT COUNT(*) as total FROM users WHERE is_active = 0').get().total;

    // Distribuição por role
    const roleDistribution = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all();

    // Usuários por mês (últimos 12 meses)
    const monthlyUsers = db.prepare(`
      SELECT strftime('%m', created_at) as month, COUNT(*) as count 
      FROM users 
      WHERE created_at >= date('now', 'start of year')
      GROUP BY strftime('%m', created_at)
      ORDER BY month
    `).all();

    // Usuários verificados
    const verifiedUsers = db.prepare('SELECT COUNT(*) as total FROM users WHERE email_verified = 1 AND phone_verified = 1').get().total;

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
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está em uso'
      });
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Criar usuário
    const stmt = db.prepare(`
      INSERT INTO users (name, email, phone, password, street, city, postal_code, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      name,
      email,
      phone,
      hashedPassword,
      address?.street || '',
      address?.city || '',
      address?.postalCode || '',
      role || 'customer'
    );

    const userId = result.lastInsertRowid;

    // Buscar usuário criado
    const userResponse = db.prepare('SELECT id, name, email, phone, street, city, postal_code, role, is_active, created_at FROM users WHERE id = ?').get(userId);

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
router.delete('/admin/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar se não está tentando excluir a si mesmo
    if (userId === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível excluir sua própria conta'
      });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Exclusão permanente
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

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

    // Construir query SQL
    let whereClause = 'WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const params = [`%${query}%`, `%${query}%`, `%${query}%`];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    const usersQuery = `
      SELECT id, name, email, phone, street, city, postal_code, role, loyalty_points, loyalty_tier, is_active, created_at, updated_at 
      FROM users 
      ${whereClause} 
      ORDER BY name ASC 
      LIMIT 20
    `;
    
    const users = db.prepare(usersQuery).all(...params);

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
