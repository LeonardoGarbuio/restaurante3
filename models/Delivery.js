const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Staff com role 'driver'
    default: null
  },
  address: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    postalCode: {
      type: String,
      required: true,
      trim: true
    },
    coordinates: {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      }
    },
    instructions: String,
    landmark: String
  },
  timing: {
    orderPlaced: {
      type: Date,
      default: Date.now
    },
    estimatedReady: Date,
    actualReady: Date,
    estimatedPickup: Date,
    actualPickup: Date,
    estimatedDelivery: Date,
    actualDelivery: Date,
    deliveryWindow: {
      start: Date,
      end: Date
    }
  },
  status: {
    current: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'cancelled'],
      default: 'pending'
    },
    history: [{
      status: {
        type: String,
        enum: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'cancelled']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      note: String,
      location: {
        lat: Number,
        lng: Number
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },
  deliveryFee: {
    type: Number,
    required: true,
    min: [0, 'Taxa de entrega não pode ser negativa']
  },
  distance: {
    type: Number, // em quilómetros
    required: true,
    min: [0, 'Distância não pode ser negativa']
  },
  estimatedDuration: {
    type: Number, // em minutos
    required: true,
    min: [0, 'Duração estimada não pode ser negativa']
  },
  actualDuration: Number, // em minutos
  route: {
    waypoints: [{
      lat: Number,
      lng: Number,
      address: String,
      type: {
        type: String,
        enum: ['pickup', 'delivery', 'waypoint']
      }
    }],
    polyline: String, // Google Maps polyline
    distance: Number,
    duration: Number
  },
  tracking: {
    isActive: {
      type: Boolean,
      default: false
    },
    lastLocation: {
      lat: Number,
      lng: Number,
      timestamp: Date,
      accuracy: Number
    },
    locationHistory: [{
      lat: Number,
      lng: Number,
      timestamp: Date,
      accuracy: Number
    }]
  },
  customerContact: {
    phone: {
      type: String,
      required: true
    },
    alternativePhone: String,
    preferredContactMethod: {
      type: String,
      enum: ['phone', 'sms', 'whatsapp'],
      default: 'phone'
    }
  },
  specialInstructions: String,
  deliveryNotes: String,
  isUrgent: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
  },
  weatherConditions: {
    temperature: Number,
    conditions: String,
    windSpeed: Number,
    visibility: Number
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

// Middleware para atualizar status history
deliverySchema.pre('save', function(next) {
  if (this.isModified('status.current')) {
    this.status.history.push({
      status: this.status.current,
      timestamp: new Date(),
      note: this.deliveryNotes || 'Status atualizado',
      updatedBy: this.driver
    });
  }
  next();
});

// Método para calcular distância entre dois pontos (fórmula de Haversine)
deliverySchema.methods.calculateDistance = function(lat1, lng1, lat2, lng2) {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Método para atualizar localização do tracking
deliverySchema.methods.updateLocation = function(lat, lng, accuracy = 0) {
  this.tracking.lastLocation = {
    lat,
    lng,
    timestamp: new Date(),
    accuracy
  };
  
  this.tracking.locationHistory.push({
    lat,
    lng,
    timestamp: new Date(),
    accuracy
  });
  
  // Manter apenas as últimas 100 localizações
  if (this.tracking.locationHistory.length > 100) {
    this.tracking.locationHistory = this.tracking.locationHistory.slice(-100);
  }
  
  return this.save();
};

// Método para atualizar status
deliverySchema.methods.updateStatus = function(newStatus, note = '', location = null) {
  this.status.current = newStatus;
  this.deliveryNotes = note;
  
  if (location) {
    this.status.history[this.status.history.length - 1].location = location;
  }
  
  return this.save();
};

// Método para atribuir motorista
deliverySchema.methods.assignDriver = function(driverId) {
  this.driver = driverId;
  this.status.current = 'assigned';
  return this.save();
};

// Método para calcular tempo estimado de entrega
deliverySchema.methods.calculateEstimatedDelivery = function() {
  const now = new Date();
  const estimatedReady = this.timing.estimatedReady || now;
  const pickupTime = new Date(estimatedReady.getTime() + 15 * 60000); // +15 min para pickup
  const deliveryTime = new Date(pickupTime.getTime() + this.estimatedDuration * 60000);
  
  this.timing.estimatedPickup = pickupTime;
  this.timing.estimatedDelivery = deliveryTime;
  
  return deliveryTime;
};

// Método para verificar se está dentro da janela de entrega
deliverySchema.methods.isWithinDeliveryWindow = function() {
  if (!this.timing.deliveryWindow.start || !this.timing.deliveryWindow.end) {
    return true; // Sem janela específica
  }
  
  const now = new Date();
  return now >= this.timing.deliveryWindow.start && now <= this.timing.deliveryWindow.end;
};

// Método para calcular atraso
deliverySchema.methods.calculateDelay = function() {
  if (!this.timing.estimatedDelivery || !this.timing.actualDelivery) {
    return 0;
  }
  
  const delay = this.timing.actualDelivery - this.timing.estimatedDelivery;
  return Math.max(0, delay); // Retorna apenas atrasos positivos
};

// Método para obter status em português
deliverySchema.methods.getStatusInPortuguese = function() {
  const statusMap = {
    'pending': 'Pendente',
    'confirmed': 'Confirmado',
    'preparing': 'Em Preparação',
    'ready': 'Pronto',
    'assigned': 'Atribuído',
    'picked_up': 'Recolhido',
    'out_for_delivery': 'Em Entrega',
    'delivered': 'Entregue',
    'failed': 'Falhou',
    'cancelled': 'Cancelado'
  };
  
  return statusMap[this.status.current] || this.status.current;
};

// Índices para melhor performance
deliverySchema.index({ order: 1 });
deliverySchema.index({ user: 1 });
deliverySchema.index({ driver: 1 });
deliverySchema.index({ 'status.current': 1 });
deliverySchema.index({ 'timing.estimatedDelivery': 1 });
deliverySchema.index({ 'address.city': 1 });
deliverySchema.index({ createdAt: -1 });
deliverySchema.index({ isUrgent: 1, priority: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
