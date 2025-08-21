const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [50, 'Nome não pode ter mais de 50 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  phone: {
    type: String,
    required: [true, 'Telefone é obrigatório'],
    trim: true,
    match: [/^(\+351|00351)?[9][0-9]{8}$/, 'Telefone inválido']
  },
  password: {
    type: String,
    required: [true, 'Password é obrigatória'],
    minlength: [6, 'Password deve ter pelo menos 6 caracteres'],
    select: false
  },
  address: {
    street: {
      type: String,
      required: [true, 'Rua é obrigatória'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'Cidade é obrigatória'],
      trim: true
    },
    postalCode: {
      type: String,
      required: [true, 'Código postal é obrigatório'],
      trim: true
    },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  role: {
    type: String,
    enum: ['customer', 'admin', 'staff'],
    default: 'customer'
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  loyaltyTier: {
    type: String,
    enum: ['bronze', 'silver', 'gold'],
    default: 'bronze'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  preferences: {
    dietaryRestrictions: [String],
    favoriteProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    deliveryInstructions: String,
    marketingEmails: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: true
    }
  },
  lastLogin: Date,
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

// Middleware para hash da password antes de salvar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para calcular tier de fidelidade
userSchema.methods.calculateLoyaltyTier = function() {
  if (this.loyaltyPoints >= 300) {
    this.loyaltyTier = 'gold';
  } else if (this.loyaltyPoints >= 100) {
    this.loyaltyTier = 'silver';
  } else {
    this.loyaltyTier = 'bronze';
  }
  return this.loyaltyTier;
};

// Método para adicionar pontos de fidelidade
userSchema.methods.addLoyaltyPoints = function(points) {
  this.loyaltyPoints += points;
  this.calculateLoyaltyTier();
  return this.save();
};

// Método para obter desconto baseado no tier
userSchema.methods.getLoyaltyDiscount = function() {
  const discounts = {
    bronze: 0.05, // 5%
    silver: 0.10, // 10%
    gold: 0.15    // 15%
  };
  return discounts[this.loyaltyTier] || 0;
};

// Índices para melhor performance
userSchema.index({ phone: 1 });
userSchema.index({ 'address.city': 1 });
userSchema.index({ loyaltyPoints: -1 });

module.exports = mongoose.model('User', userSchema);
