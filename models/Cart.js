const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantidade deve ser pelo menos 1']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Preço unitário não pode ser negativo']
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Preço total não pode ser negativo']
    },
    specialInstructions: String,
    customization: [{
      name: String,
      value: String,
      additionalCost: {
        type: Number,
        default: 0
      }
    }],
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  delivery: {
    type: {
      type: String,
      enum: ['delivery', 'pickup', 'dine-in'],
      default: 'delivery'
    },
    address: {
      street: String,
      city: String,
      postalCode: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    instructions: String,
    preferredTime: {
      type: String,
      enum: ['asap', 'specific'],
      default: 'asap'
    },
    specificTime: Date,
    deliveryFee: {
      type: Number,
      default: 0
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['card', 'cash', 'mbway', 'transfer', 'paypal'],
      default: 'card'
    },
    loyaltyPointsUsed: {
      type: Number,
      default: 0
    }
  },
  totals: {
    subtotal: {
      type: Number,
      default: 0
    },
    deliveryFee: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    loyaltyDiscount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Carrinho expira em 24 horas
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
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

// Middleware para calcular totais
cartSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

// Método para calcular totais
cartSchema.methods.calculateTotals = function() {
  // Calcular subtotal
  this.totals.subtotal = this.items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unitPrice;
    const customizationCost = item.customization.reduce((cost, custom) => cost + (custom.additionalCost || 0), 0);
    return sum + itemTotal + customizationCost;
  }, 0);

  // Aplicar taxa de entrega
  this.totals.deliveryFee = this.delivery.deliveryFee || 0;

  // Calcular imposto (IVA 23% em Portugal)
  this.totals.tax = this.totals.subtotal * 0.23;

  // Aplicar desconto de fidelidade
  this.totals.loyaltyDiscount = this.payment.loyaltyPointsUsed * 0.01; // 1 cêntimo por ponto

  // Calcular total final
  this.totals.total = Math.max(0, 
    this.totals.subtotal + 
    this.totals.deliveryFee + 
    this.totals.tax - 
    this.totals.discount - 
    this.totals.loyaltyDiscount
  );

  return this.totals;
};

// Método para adicionar item ao carrinho
cartSchema.methods.addItem = function(productId, quantity, unitPrice, specialInstructions = '', customization = []) {
  // Verificar se o produto já existe no carrinho
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );

  if (existingItemIndex !== -1) {
    // Atualizar quantidade do item existente
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].totalPrice = this.items[existingItemIndex].quantity * unitPrice;
    this.items[existingItemIndex].specialInstructions = specialInstructions;
    this.items[existingItemIndex].customization = customization;
    this.items[existingItemIndex].addedAt = new Date();
  } else {
    // Adicionar novo item
    const totalPrice = quantity * unitPrice;
    const customizationCost = customization.reduce((sum, custom) => sum + (custom.additionalCost || 0), 0);

    this.items.push({
      product: productId,
      quantity,
      unitPrice,
      totalPrice: totalPrice + customizationCost,
      specialInstructions,
      customization,
      addedAt: new Date()
    });
  }

  this.calculateTotals();
  return this.save();
};

// Método para remover item do carrinho
cartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(
    item => item.product.toString() !== productId.toString()
  );
  this.calculateTotals();
  return this.save();
};

// Método para atualizar quantidade de um item
cartSchema.methods.updateItemQuantity = function(productId, newQuantity) {
  if (newQuantity <= 0) {
    return this.removeItem(productId);
  }

  const item = this.items.find(
    item => item.product.toString() === productId.toString()
  );

  if (item) {
    item.quantity = newQuantity;
    item.totalPrice = newQuantity * item.unitPrice;
    this.calculateTotals();
    return this.save();
  }

  throw new Error('Produto não encontrado no carrinho');
};

// Método para limpar carrinho
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.calculateTotals();
  return this.save();
};

// Método para verificar se o carrinho está vazio
cartSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

// Método para obter número total de itens
cartSchema.methods.getItemCount = function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
};

// Método para verificar se o carrinho expirou
cartSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Método para renovar expiração
cartSchema.methods.renewExpiration = function() {
  this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return this.save();
};

// Método para aplicar desconto
cartSchema.methods.applyDiscount = function(discountAmount) {
  this.totals.discount = Math.min(discountAmount, this.totals.subtotal);
  this.calculateTotals();
  return this.save();
};

// Método para usar pontos de fidelidade
cartSchema.methods.useLoyaltyPoints = function(points) {
  this.payment.loyaltyPointsUsed = Math.max(0, points);
  this.calculateTotals();
  return this.save();
};

// Índices para melhor performance
cartSchema.index({ user: 1 });
cartSchema.index({ expiresAt: 1 });
cartSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Cart', cartSchema);
