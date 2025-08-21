const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
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
    }]
  }],
  delivery: {
    type: {
      type: String,
      enum: ['delivery', 'pickup', 'dine-in'],
      required: true
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
      enum: ['asap', 'specific']
    },
    specificTime: Date,
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    deliveryFee: {
      type: Number,
      default: 0
    }
  },
  payment: {
    method: {
      type: String,
      enum: ['card', 'cash', 'mbway', 'transfer', 'paypal'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    amount: {
      type: Number,
      required: true,
      min: [0, 'Valor não pode ser negativo']
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
    finalAmount: {
      type: Number,
      required: true,
      min: [0, 'Valor final não pode ser negativo']
    }
  },
  status: {
    current: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
      default: 'pending'
    },
    history: [{
      status: {
        type: String,
        enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      note: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },
  timing: {
    orderPlaced: {
      type: Date,
      default: Date.now
    },
    estimatedReady: Date,
    actualReady: Date,
    estimatedDelivery: Date,
    actualDelivery: Date
  },
  customerNotes: String,
  staffNotes: String,
  loyaltyPoints: {
    earned: {
      type: Number,
      default: 0
    },
    used: {
      type: Number,
      default: 0
    }
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  source: {
    type: String,
    enum: ['website', 'phone', 'whatsapp', 'in-store', 'mobile-app'],
    default: 'website'
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

// Middleware para gerar número de pedido único
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Buscar último pedido do dia
    const lastOrder = await this.constructor.findOne({
      orderNumber: new RegExp(`^SP${year}${month}${day}`)
    }).sort({ orderNumber: -1 });
    
    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-3));
      sequence = lastSequence + 1;
    }
    
    this.orderNumber = `SP${year}${month}${day}${sequence.toString().padStart(3, '0')}`;
  }
  next();
});

// Middleware para atualizar status history
orderSchema.pre('save', function(next) {
  if (this.isModified('status.current')) {
    this.status.history.push({
      status: this.status.current,
      timestamp: new Date(),
      note: this.staffNotes || 'Status atualizado'
    });
  }
  next();
});

// Método para calcular total do pedido
orderSchema.methods.calculateTotal = function() {
  const subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const total = subtotal + this.delivery.deliveryFee + this.payment.tax - this.payment.discount - this.payment.loyaltyDiscount;
  
  this.payment.amount = subtotal;
  this.payment.finalAmount = Math.max(0, total);
  
  return this.payment.finalAmount;
};

// Método para adicionar item ao pedido
orderSchema.methods.addItem = function(productId, quantity, unitPrice, specialInstructions = '', customization = []) {
  const totalPrice = quantity * unitPrice;
  const customizationCost = customization.reduce((sum, custom) => sum + (custom.additionalCost || 0), 0);
  
  this.items.push({
    product: productId,
    quantity,
    unitPrice,
    totalPrice: totalPrice + customizationCost,
    specialInstructions,
    customization
  });
  
  this.calculateTotal();
  return this.save();
};

// Método para remover item do pedido
orderSchema.methods.removeItem = function(itemIndex) {
  if (itemIndex >= 0 && itemIndex < this.items.length) {
    this.items.splice(itemIndex, 1);
    this.calculateTotal();
    return this.save();
  }
  throw new Error('Índice de item inválido');
};

// Método para atualizar status
orderSchema.methods.updateStatus = function(newStatus, note = '', updatedBy = null) {
  this.status.current = newStatus;
  this.staffNotes = note;
  
  if (updatedBy) {
    this.status.history[this.status.history.length - 1].updatedBy = updatedBy;
  }
  
  return this.save();
};

// Método para calcular pontos de fidelidade
orderSchema.methods.calculateLoyaltyPoints = function() {
  const pointsPerEuro = 1;
  this.loyaltyPoints.earned = Math.floor(this.payment.finalAmount * pointsPerEuro);
  return this.loyaltyPoints.earned;
};

// Método para aplicar desconto de fidelidade
orderSchema.methods.applyLoyaltyDiscount = function(discountPercentage) {
  this.payment.loyaltyDiscount = (this.payment.amount * discountPercentage);
  this.calculateTotal();
  return this.save();
};

// Índices para melhor performance
orderSchema.index({ 'status.current': 1 });
orderSchema.index({ 'delivery.type': 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'timing.orderPlaced': -1 });

module.exports = mongoose.model('Order', orderSchema);
