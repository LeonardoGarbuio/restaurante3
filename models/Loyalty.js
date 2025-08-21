const mongoose = require('mongoose');

const loyaltySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  points: {
    current: {
      type: Number,
      default: 0,
      min: [0, 'Pontos não podem ser negativos']
    },
    total: {
      type: Number,
      default: 0,
      min: [0, 'Total de pontos não pode ser negativo']
    },
    used: {
      type: Number,
      default: 0,
      min: [0, 'Pontos usados não podem ser negativos']
    },
    expired: {
      type: Number,
      default: 0,
      min: [0, 'Pontos expirados não podem ser negativos']
    }
  },
  tier: {
    current: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze'
    },
    history: [{
      tier: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum']
      },
      achievedAt: {
        type: Date,
        default: Date.now
      },
      pointsRequired: Number,
      pointsAchieved: Number
    }]
  },
  benefits: {
    discountPercentage: {
      type: Number,
      default: 0.05, // 5% para bronze
      min: [0, 'Percentagem de desconto não pode ser negativa'],
      max: [1, 'Percentagem de desconto não pode exceder 100%']
    },
    freeDelivery: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    exclusiveOffers: {
      type: Boolean,
      default: false
    },
    birthdayReward: {
      type: Boolean,
      default: false
    },
    earlyAccess: {
      type: Boolean,
      default: false
    }
  },
  transactions: [{
    type: {
      type: String,
      enum: ['earned', 'used', 'expired', 'bonus', 'adjustment'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    expiresAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  rewards: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    pointsCost: {
      type: Number,
      required: true,
      min: [0, 'Custo em pontos não pode ser negativo']
    },
    discountAmount: Number,
    discountPercentage: Number,
    freeProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    expiresAt: Date,
    usedAt: Date,
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }
  }],
  goals: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    targetPoints: {
      type: Number,
      required: true,
      min: [1, 'Meta deve ser pelo menos 1 ponto']
    },
    currentPoints: {
      type: Number,
      default: 0,
      min: [0, 'Pontos atuais não podem ser negativos']
    },
    reward: {
      type: String,
      required: true
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    expiresAt: Date
  }],
  statistics: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: [0, 'Total gasto não pode ser negativo']
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    lastOrderDate: Date,
    favoriteCategories: [{
      category: String,
      count: Number
    }]
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: true
    },
    birthdayRewards: {
      type: Boolean,
      default: true
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

// Middleware para atualizar tier baseado nos pontos
loyaltySchema.pre('save', function(next) {
  this.updateTier();
  next();
});

// Método para atualizar tier
loyaltySchema.methods.updateTier = function() {
  const newTier = this.calculateTier();
  
  if (newTier !== this.tier.current) {
    this.tier.history.push({
      tier: newTier,
      achievedAt: new Date(),
      pointsRequired: this.getPointsRequiredForTier(newTier),
      pointsAchieved: this.points.current
    });
    
    this.tier.current = newTier;
    this.updateBenefits();
  }
  
  return this.tier.current;
};

// Método para calcular tier baseado nos pontos
loyaltySchema.methods.calculateTier = function() {
  if (this.points.current >= 1000) return 'platinum';
  if (this.points.current >= 500) return 'gold';
  if (this.points.current >= 200) return 'silver';
  return 'bronze';
};

// Método para obter pontos necessários para um tier
loyaltySchema.methods.getPointsRequiredForTier = function(tier) {
  const tierRequirements = {
    'bronze': 0,
    'silver': 200,
    'gold': 500,
    'platinum': 1000
  };
  
  return tierRequirements[tier] || 0;
};

// Método para atualizar benefícios baseado no tier
loyaltySchema.methods.updateBenefits = function() {
  const tierBenefits = {
    'bronze': {
      discountPercentage: 0.05,
      freeDelivery: false,
      prioritySupport: false,
      exclusiveOffers: false,
      birthdayReward: false,
      earlyAccess: false
    },
    'silver': {
      discountPercentage: 0.10,
      freeDelivery: true,
      prioritySupport: false,
      exclusiveOffers: true,
      birthdayReward: true,
      earlyAccess: false
    },
    'gold': {
      discountPercentage: 0.15,
      freeDelivery: true,
      prioritySupport: true,
      exclusiveOffers: true,
      birthdayReward: true,
      earlyAccess: true
    },
    'platinum': {
      discountPercentage: 0.20,
      freeDelivery: true,
      prioritySupport: true,
      exclusiveOffers: true,
      birthdayReward: true,
      earlyAccess: true
    }
  };
  
  this.benefits = tierBenefits[this.tier.current];
};

// Método para adicionar pontos
loyaltySchema.methods.addPoints = function(amount, description, orderId = null, expiresIn = null) {
  const transaction = {
    type: 'earned',
    amount,
    description,
    order: orderId,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null
  };
  
  this.points.current += amount;
  this.points.total += amount;
  this.transactions.push(transaction);
  
  // Atualizar estatísticas
  this.statistics.totalOrders += 1;
  if (orderId) {
    this.statistics.lastOrderDate = new Date();
  }
  
  return this.save();
};

// Método para usar pontos
loyaltySchema.methods.usePoints = function(amount, description, orderId = null) {
  if (amount > this.points.current) {
    throw new Error('Pontos insuficientes');
  }
  
  const transaction = {
    type: 'used',
    amount: -amount,
    description,
    order: orderId
  };
  
  this.points.current -= amount;
  this.points.used += amount;
  this.transactions.push(transaction);
  
  return this.save();
};

// Método para verificar se pode usar pontos
loyaltySchema.methods.canUsePoints = function(amount) {
  return this.points.current >= amount;
};

// Método para obter desconto disponível
loyaltySchema.methods.getAvailableDiscount = function(orderAmount) {
  return orderAmount * this.benefits.discountPercentage;
};

// Método para verificar se entrega é gratuita
loyaltySchema.methods.hasFreeDelivery = function() {
  return this.benefits.freeDelivery;
};

// Método para obter tier em português
loyaltySchema.methods.getTierInPortuguese = function() {
  const tierMap = {
    'bronze': 'Bronze',
    'silver': 'Prata',
    'gold': 'Ouro',
    'platinum': 'Platina'
  };
  
  return tierMap[this.tier.current] || this.tier.current;
};

// Método para obter próximo tier
loyaltySchema.methods.getNextTier = function() {
  const tiers = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tiers.indexOf(this.tier.current);
  
  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null;
  }
  
  return tiers[currentIndex + 1];
};

// Método para obter progresso para o próximo tier
loyaltySchema.methods.getProgressToNextTier = function() {
  const nextTier = this.getNextTier();
  if (!nextTier) return 100;
  
  const currentPoints = this.points.current;
  const nextTierPoints = this.getPointsRequiredForTier(nextTier);
  const currentTierPoints = this.getPointsRequiredForTier(this.tier.current);
  
  const progress = ((currentPoints - currentTierPoints) / (nextTierPoints - currentTierPoints)) * 100;
  return Math.min(100, Math.max(0, progress));
};

// Método para verificar se tem benefícios especiais
loyaltySchema.methods.hasSpecialBenefits = function() {
  return this.tier.current === 'gold' || this.tier.current === 'platinum';
};

// Índices para melhor performance
loyaltySchema.index({ user: 1 });
loyaltySchema.index({ 'tier.current': 1 });
loyaltySchema.index({ 'points.current': -1 });
loyaltySchema.index({ 'statistics.lastOrderDate': -1 });

module.exports = mongoose.model('Loyalty', loyaltySchema);
