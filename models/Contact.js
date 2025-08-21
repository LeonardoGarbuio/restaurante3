const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^(\+351|00351)?[9][0-9]{8}$/, 'Telefone inválido']
  },
  subject: {
    type: String,
    required: [true, 'Assunto é obrigatório'],
    enum: ['encomenda_especial', 'catering', 'informacoes', 'reclamacao', 'sugestao', 'parceria', 'outro'],
    default: 'outro'
  },
  message: {
    type: String,
    required: [true, 'Mensagem é obrigatória'],
    trim: true,
    maxlength: [1000, 'Mensagem não pode ter mais de 1000 caracteres']
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'resolved', 'closed'],
    default: 'new'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Staff/admin
    default: null
  },
  category: {
    type: String,
    enum: ['customer_service', 'sales', 'technical', 'complaint', 'feedback', 'general'],
    default: 'general'
  },
  tags: [String],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String
  }],
  response: {
    message: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date,
    responseTime: Number // em horas desde a criação
  },
  followUp: {
    scheduled: Date,
    notes: String,
    completed: {
      type: Boolean,
      default: false
    }
  },
  customerSatisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    respondedAt: Date
  },
  source: {
    type: String,
    enum: ['website', 'email', 'phone', 'whatsapp', 'social_media', 'in_store'],
    default: 'website'
  },
  ipAddress: String,
  userAgent: String,
  location: {
    country: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Middleware para calcular tempo de resposta
contactSchema.pre('save', function(next) {
  if (this.response.respondedAt && !this.response.responseTime) {
    const responseTime = (this.response.respondedAt - this.createdAt) / (1000 * 60 * 60); // em horas
    this.response.responseTime = Math.round(responseTime * 100) / 100;
  }
  next();
});

// Método para marcar como respondido
contactSchema.methods.markAsResponded = function(responseMessage, respondedBy) {
  this.status = 'resolved';
  this.response = {
    message: responseMessage,
    respondedBy,
    respondedAt: new Date()
  };
  
  return this.save();
};

// Método para agendar follow-up
contactSchema.methods.scheduleFollowUp = function(scheduledDate, notes) {
  this.followUp = {
    scheduled: scheduledDate,
    notes,
    completed: false
  };
  
  return this.save();
};

// Método para marcar follow-up como completo
contactSchema.methods.completeFollowUp = function() {
  this.followUp.completed = true;
  return this.save();
};

// Método para atualizar prioridade baseada no assunto
contactSchema.methods.updatePriority = function() {
  const priorityMap = {
    'reclamacao': 'high',
    'catering': 'normal',
    'encomenda_especial': 'normal',
    'informacoes': 'low',
    'sugestao': 'low',
    'parceria': 'normal',
    'outro': 'normal'
  };
  
  this.priority = priorityMap[this.subject] || 'normal';
  return this.save();
};

// Método para obter assunto em português
contactSchema.methods.getSubjectInPortuguese = function() {
  const subjectMap = {
    'encomenda_especial': 'Encomenda Especial',
    'catering': 'Catering',
    'informacoes': 'Informações',
    'reclamacao': 'Reclamação',
    'sugestao': 'Sugestão',
    'parceria': 'Parceria',
    'outro': 'Outro'
  };
  
  return subjectMap[this.subject] || this.subject;
};

// Método para obter status em português
contactSchema.methods.getStatusInPortuguese = function() {
  const statusMap = {
    'new': 'Novo',
    'in_progress': 'Em Progresso',
    'resolved': 'Resolvido',
    'closed': 'Fechado'
  };
  
  return statusMap[this.status] || this.status;
};

// Método para obter prioridade em português
contactSchema.methods.getPriorityInPortuguese = function() {
  const priorityMap = {
    'low': 'Baixa',
    'normal': 'Normal',
    'high': 'Alta',
    'urgent': 'Urgente'
  };
  
  return priorityMap[this.priority] || this.priority;
};

// Método para verificar se está atrasado
contactSchema.methods.isOverdue = function() {
  if (this.status !== 'new' && this.status !== 'in_progress') {
    return false;
  }
  
  const now = new Date();
  const hoursSinceCreation = (now - this.createdAt) / (1000 * 60 * 60);
  
  // Definir limites de tempo baseados na prioridade
  const timeLimits = {
    'low': 72,      // 3 dias
    'normal': 48,   // 2 dias
    'high': 24,     // 1 dia
    'urgent': 4     // 4 horas
  };
  
  return hoursSinceCreation > timeLimits[this.priority];
};

// Método para calcular tempo de resposta médio
contactSchema.statics.getAverageResponseTime = async function() {
  const result = await this.aggregate([
    {
      $match: {
        'response.responseTime': { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        averageResponseTime: { $avg: '$response.responseTime' },
        totalResponses: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { averageResponseTime: 0, totalResponses: 0 };
};

// Índices para melhor performance
contactSchema.index({ status: 1, priority: 1 });
contactSchema.index({ subject: 1 });
contactSchema.index({ assignedTo: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ email: 1 });
contactSchema.index({ 'followUp.scheduled': 1 });
contactSchema.index({ 'followUp.completed': 1 });

module.exports = mongoose.model('Contact', contactSchema);
