const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome do produto é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  description: {
    type: String,
    required: [true, 'Descrição é obrigatória'],
    trim: true,
    maxlength: [500, 'Descrição não pode ter mais de 500 caracteres']
  },
  category: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    enum: ['bolos', 'salgados', 'bebidas', 'sobremesas', 'pães', 'especialidades']
  },
  subcategory: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Preço é obrigatório'],
    min: [0, 'Preço não pode ser negativo']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Preço original não pode ser negativo']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  ingredients: [{
    name: String,
    allergen: {
      type: Boolean,
      default: false
    },
    allergenType: {
      type: String,
      enum: ['gluten', 'lactose', 'nuts', 'eggs', 'soy', 'fish', 'shellfish', 'none']
    }
  }],
  nutritionalInfo: {
    calories: Number,
    protein: Number,
    carbohydrates: Number,
    fat: Number,
    fiber: Number,
    sugar: Number,
    sodium: Number
  },
  dietaryInfo: {
    isVegetarian: {
      type: Boolean,
      default: false
    },
    isVegan: {
      type: Boolean,
      default: false
    },
    isGlutenFree: {
      type: Boolean,
      default: false
    },
    isLactoseFree: {
      type: Boolean,
      default: false
    },
    isHalal: {
      type: Boolean,
      default: false
    },
    isKosher: {
      type: Boolean,
      default: false
    }
  },
  preparation: {
    preparationTime: {
      type: Number, // em minutos
      default: 0
    },
    cookingTime: {
      type: Number, // em minutos
      default: 0
    },
    servingSize: {
      type: String,
      default: '1 porção'
    },
    instructions: String
  },
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    stockQuantity: {
      type: Number,
      default: -1 // -1 significa estoque ilimitado
    },
    minOrderQuantity: {
      type: Number,
      default: 1
    },
    maxOrderQuantity: {
      type: Number,
      default: 50
    },
    availableDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    availableHours: {
      start: {
        type: String,
        default: '07:00'
      },
      end: {
        type: String,
        default: '19:00'
      }
    }
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    },
    reviews: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },
      comment: {
        type: String,
        maxlength: [500, 'Comentário não pode ter mais de 500 caracteres']
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  tags: [String],
  isFeatured: {
    type: Boolean,
    default: false
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isSeasonal: {
    type: Boolean,
    default: false
  },
  seasonalPeriod: {
    start: Date,
    end: Date
  },
  relatedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
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

// Middleware para calcular rating médio
productSchema.pre('save', function(next) {
  if (this.ratings.reviews.length > 0) {
    const totalRating = this.ratings.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.ratings.average = totalRating / this.ratings.reviews.length;
    this.ratings.count = this.ratings.reviews.length;
  }
  next();
});

// Método para adicionar review
productSchema.methods.addReview = function(userId, rating, comment) {
  // Verificar se o usuário já fez review
  const existingReviewIndex = this.ratings.reviews.findIndex(
    review => review.user.toString() === userId.toString()
  );

  if (existingReviewIndex !== -1) {
    // Atualizar review existente
    this.ratings.reviews[existingReviewIndex].rating = rating;
    this.ratings.reviews[existingReviewIndex].comment = comment;
    this.ratings.reviews[existingReviewIndex].updatedAt = new Date();
  } else {
    // Adicionar novo review
    this.ratings.reviews.push({
      user: userId,
      rating,
      comment,
      createdAt: new Date()
    });
  }

  return this.save();
};

// Método para verificar disponibilidade
productSchema.methods.isAvailableNow = function() {
  if (!this.availability.isAvailable) return false;
  
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'monday' }).toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5);
  
  // Verificar se está no dia disponível
  if (!this.availability.availableDays.includes(currentDay)) return false;
  
  // Verificar se está no horário disponível
  if (currentTime < this.availability.availableHours.start || 
      currentTime > this.availability.availableHours.end) return false;
  
  // Verificar estoque
  if (this.availability.stockQuantity !== -1 && this.availability.stockQuantity <= 0) return false;
  
  return true;
};

// Método para verificar se é sazonal
productSchema.methods.isInSeason = function() {
  if (!this.isSeasonal) return true;
  
  const now = new Date();
  return now >= this.seasonalPeriod.start && now <= this.seasonalPeriod.end;
};

// Índices para melhor performance
productSchema.index({ category: 1, isAvailable: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.average': -1 });
productSchema.index({ isFeatured: 1, isPopular: 1 });
productSchema.index({ tags: 1 });

module.exports = mongoose.model('Product', productSchema);
