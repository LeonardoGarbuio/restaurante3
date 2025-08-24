const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateContact, validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/contact
// @desc    Enviar mensagem de contacto
// @access  Public
router.post('/', validateContact, async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Criar contacto
    const stmt = db.prepare(`
      INSERT INTO contacts (name, email, phone, subject, message)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name, email, phone, subject, message);
    const contactId = result.lastInsertRowid;

    // TODO: Enviar email de confirmação
    // TODO: Enviar notificação para staff

    res.status(201).json({
      success: true,
      message: 'Mensagem enviada com sucesso. Entraremos em contacto em breve.',
      data: {
        contact: {
          id: contactId,
          subject: subject,
          status: 'new'
        }
      }
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/contact/admin/all
// @desc    Obter todas as mensagens (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/all', authenticateToken, requireStaff, validatePagination, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      subject
    } = req.query;

    // Construir query SQL
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (subject) {
      whereClause += ' AND subject LIKE ?';
      params.push(`%${subject}%`);
    }

    // Calcular offset para paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Executar query
    const contactsQuery = `
      SELECT * FROM contacts 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const contacts = db.prepare(contactsQuery).all(...params, parseInt(limit), offset);

    // Contar total de mensagens
    const countQuery = `SELECT COUNT(*) as total FROM contacts ${whereClause}`;
    const totalResult = db.prepare(countQuery).get(...params);
    const total = totalResult.total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalContacts: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter mensagens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/contact/admin/:id
// @desc    Obter mensagem por ID (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/:id', authenticateToken, requireStaff, async (req, res) => {
  try {
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        contact
      }
    });
  } catch (error) {
    console.error('Erro ao obter mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/contact/admin/:id/update-status
// @desc    Atualizar status da mensagem (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:id/update-status', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Verificar se mensagem existe
    const existingContact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(id);
    if (!existingContact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    // Atualizar status
    const updateFields = [];
    const params = [];

    if (status) {
      updateFields.push('status = ?');
      params.push(status);
    }

    if (notes) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const updateQuery = `UPDATE contacts SET ${updateFields.join(', ')} WHERE id = ?`;
      db.prepare(updateQuery).run(...params);
    }

    // Buscar mensagem atualizada
    const updatedContact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);

    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: {
        contact: updatedContact
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/contact/admin/:id
// @desc    Excluir mensagem (Admin)
// @access  Private (Admin)
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se mensagem existe
    const existingContact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(id);
    if (!existingContact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    // Excluir mensagem
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);

    res.json({
      success: true,
      message: 'Mensagem excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/contact/admin/stats/summary
// @desc    Obter estatísticas de contactos (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/stats/summary', authenticateToken, requireStaff, async (req, res) => {
  try {
    // Total de mensagens
    const totalContacts = db.prepare('SELECT COUNT(*) as total FROM contacts').get().total;
    const newContacts = db.prepare('SELECT COUNT(*) as total FROM contacts WHERE status = "new"').get().total;
    const readContacts = db.prepare('SELECT COUNT(*) as total FROM contacts WHERE status = "read"').get().total;
    const repliedContacts = db.prepare('SELECT COUNT(*) as total FROM contacts WHERE status = "replied"').get().total;

    // Mensagens por mês (últimos 12 meses)
    const monthlyContacts = db.prepare(`
      SELECT strftime('%m', created_at) as month, COUNT(*) as count 
      FROM contacts 
      WHERE created_at >= date('now', 'start of year')
      GROUP BY strftime('%m', created_at)
      ORDER BY month
    `).all();

    res.json({
      success: true,
      data: {
        summary: {
          totalContacts,
          newContacts,
          readContacts,
          repliedContacts,
          monthlyContacts
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

module.exports = router;
