const express = require('express');
const Contact = require('../models/Contact');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateContact, validateMongoId, validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/contact
// @desc    Enviar mensagem de contacto
// @access  Public
router.post('/', validateContact, async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Criar contacto
    const contact = new Contact({
      name,
      email,
      phone,
      subject,
      message,
      source: 'website',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Atualizar prioridade baseada no assunto
    await contact.updatePriority();

    await contact.save();

    // TODO: Enviar email de confirmação
    // TODO: Enviar notificação para staff

    res.status(201).json({
      success: true,
      message: 'Mensagem enviada com sucesso. Entraremos em contacto em breve.',
      data: {
        contact: {
          _id: contact._id,
          subject: contact.getSubjectInPortuguese(),
          priority: contact.getPriorityInPortuguese()
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
      priority,
      subject,
      assignedTo
    } = req.query;

    // Construir filtros
    const filters = {};

    if (status) {
      filters.status = status;
    }

    if (priority) {
      filters.priority = priority;
    }

    if (subject) {
      filters.subject = subject;
    }

    if (assignedTo) {
      filters.assignedTo = assignedTo;
    }

    // Calcular skip para paginação
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Executar query
    const contacts = await Contact.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedTo', 'name');

    // Contar total de mensagens
    const total = await Contact.countDocuments(filters);

    // Calcular total de páginas
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
router.get('/admin/:id', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('response.respondedBy', 'name');

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

// @route   PUT /api/contact/admin/:id/respond
// @desc    Responder a uma mensagem (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:id/respond', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { responseMessage } = req.body;

    if (!responseMessage) {
      return res.status(400).json({
        success: false,
        message: 'Mensagem de resposta é obrigatória'
      });
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    if (contact.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Mensagem já foi respondida'
      });
    }

    // Marcar como respondida
    await contact.markAsResponded(responseMessage, req.user._id);

    // TODO: Enviar email de resposta para o cliente

    res.json({
      success: true,
      message: 'Resposta enviada com sucesso',
      data: {
        contact: {
          _id: contact._id,
          status: contact.getStatusInPortuguese(),
          response: contact.response
        }
      }
    });
  } catch (error) {
    console.error('Erro ao responder mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/contact/admin/:id/assign
// @desc    Atribuir mensagem a um staff (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:id/assign', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Staff a atribuir é obrigatório'
      });
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    contact.assignedTo = assignedTo;
    contact.status = 'in_progress';
    await contact.save();

    res.json({
      success: true,
      message: 'Mensagem atribuída com sucesso',
      data: {
        contact: {
          _id: contact._id,
          assignedTo: contact.assignedTo,
          status: contact.getStatusInPortuguese()
        }
      }
    });
  } catch (error) {
    console.error('Erro ao atribuir mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/contact/admin/:id/priority
// @desc    Atualizar prioridade da mensagem (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:id/priority', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({
        success: false,
        message: 'Prioridade é obrigatória'
      });
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    contact.priority = priority;
    await contact.save();

    res.json({
      success: true,
      message: 'Prioridade atualizada com sucesso',
      data: {
        contact: {
          _id: contact._id,
          priority: contact.getPriorityInPortuguese()
        }
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar prioridade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   POST /api/contact/admin/:id/follow-up
// @desc    Agendar follow-up (Admin/Staff)
// @access  Private (Staff/Admin)
router.post('/admin/:id/follow-up', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const { scheduledDate, notes } = req.body;

    if (!scheduledDate || !notes) {
      return res.status(400).json({
        success: false,
        message: 'Data e notas são obrigatórias'
      });
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    await contact.scheduleFollowUp(new Date(scheduledDate), notes);

    res.json({
      success: true,
      message: 'Follow-up agendado com sucesso',
      data: {
        contact: {
          _id: contact._id,
          followUp: contact.followUp
        }
      }
    });
  } catch (error) {
    console.error('Erro ao agendar follow-up:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   PUT /api/contact/admin/:id/follow-up/complete
// @desc    Marcar follow-up como completo (Admin/Staff)
// @access  Private (Staff/Admin)
router.put('/admin/:id/follow-up/complete', authenticateToken, requireStaff, validateMongoId, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    if (!contact.followUp.scheduled) {
      return res.status(400).json({
        success: false,
        message: 'Não há follow-up agendado'
      });
    }

    await contact.completeFollowUp();

    res.json({
      success: true,
      message: 'Follow-up marcado como completo',
      data: {
        contact: {
          _id: contact._id,
          followUp: contact.followUp
        }
      }
    });
  } catch (error) {
    console.error('Erro ao completar follow-up:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   GET /api/contact/admin/stats/summary
// @desc    Obter estatísticas das mensagens (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/stats/summary', authenticateToken, requireStaff, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Estatísticas do dia
    const todayStats = await Contact.aggregate([
      {
        $match: {
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          newCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'new'] }, 1, 0]
            }
          },
          urgentCount: {
            $sum: {
              $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Estatísticas do mês
    const monthStats = await Contact.aggregate([
      {
        $match: {
          createdAt: { $gte: thisMonth }
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          resolvedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Mensagens por status
    const statusStats = await Contact.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Mensagens por prioridade
    const priorityStats = await Contact.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Mensagens por assunto
    const subjectStats = await Contact.aggregate([
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 }
        }
      }
    ]);

    // Tempo médio de resposta
    const responseTimeStats = await Contact.getAverageResponseTime();

    res.json({
      success: true,
      data: {
        today: todayStats[0] || { count: 0, newCount: 0, urgentCount: 0 },
        month: monthStats[0] || { count: 0, resolvedCount: 0 },
        byStatus: statusStats,
        byPriority: priorityStats,
        bySubject: subjectStats,
        responseTime: responseTimeStats
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

// @route   GET /api/contact/admin/overdue
// @desc    Obter mensagens em atraso (Admin/Staff)
// @access  Private (Staff/Admin)
router.get('/admin/overdue', authenticateToken, requireStaff, async (req, res) => {
  try {
    const overdueContacts = await Contact.find({
      status: { $in: ['new', 'in_progress'] }
    })
      .sort({ priority: -1, createdAt: 1 })
      .populate('assignedTo', 'name');

    // Filtrar apenas as que estão em atraso
    const overdue = overdueContacts.filter(contact => contact.isOverdue());

    res.json({
      success: true,
      data: {
        contacts: overdue,
        count: overdue.length
      }
    });
  } catch (error) {
    console.error('Erro ao obter mensagens em atraso:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// @route   DELETE /api/contact/admin/:id
// @desc    Eliminar mensagem (Admin)
// @access  Private (Admin)
router.delete('/admin/:id', authenticateToken, requireAdmin, validateMongoId, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Mensagem não encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Mensagem eliminada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao eliminar mensagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
