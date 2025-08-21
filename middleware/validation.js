const { body, param, query, validationResult } = require('express-validator');

// Middleware para verificar erros de validação
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados de entrada inválidos',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Validações para autenticação
const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras e espaços'),
  
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email muito longo'),
  
  body('phone')
    .matches(/^(\+351|00351)?[9][0-9]{8}$/)
    .withMessage('Telefone deve ser um número português válido'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password deve conter pelo menos uma letra maiúscula, uma minúscula e um número'),
  
  body('address.street')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Rua deve ter entre 5 e 100 caracteres'),
  
  body('address.city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Cidade deve ter entre 2 e 50 caracteres'),
  
  body('address.postalCode')
    .matches(/^\d{4}-\d{3}$/)
    .withMessage('Código postal deve estar no formato 0000-000'),
  
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password é obrigatória'),
  
  handleValidationErrors
];

// Validações para produtos
const validateProduct = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Descrição deve ter entre 10 e 500 caracteres'),
  
  body('category')
    .isIn(['bolos', 'salgados', 'bebidas', 'sobremesas', 'pães', 'especialidades'])
    .withMessage('Categoria inválida'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Preço deve ser um número positivo'),
  
  body('images.*.url')
    .isURL()
    .withMessage('URL da imagem inválida'),
  
  body('availability.isAvailable')
    .isBoolean()
    .withMessage('Disponibilidade deve ser um valor booleano'),
  
  body('availability.stockQuantity')
    .optional()
    .isInt({ min: -1 })
    .withMessage('Quantidade em stock deve ser -1 (ilimitado) ou um número positivo'),
  
  handleValidationErrors
];

// Validações para pedidos
const validateOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Pedido deve ter pelo menos um item'),
  
  body('items.*.product')
    .isMongoId()
    .withMessage('ID do produto inválido'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantidade deve ser pelo menos 1'),
  
  body('delivery.type')
    .isIn(['delivery', 'pickup', 'dine-in'])
    .withMessage('Tipo de entrega inválido'),
  
  body('delivery.address')
    .if(body('delivery.type').equals('delivery'))
    .notEmpty()
    .withMessage('Endereço é obrigatório para entrega'),
  
  body('delivery.address.street')
    .if(body('delivery.type').equals('delivery'))
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Rua deve ter entre 5 e 100 caracteres'),
  
  body('delivery.address.city')
    .if(body('delivery.type').equals('delivery'))
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Cidade deve ter entre 2 e 50 caracteres'),
  
  body('delivery.address.postalCode')
    .if(body('delivery.type').equals('delivery'))
    .matches(/^\d{4}-\d{3}$/)
    .withMessage('Código postal deve estar no formato 0000-000'),
  
  body('payment.method')
    .isIn(['card', 'cash', 'mbway', 'transfer', 'paypal'])
    .withMessage('Método de pagamento inválido'),
  
  handleValidationErrors
];

// Validações para carrinho
const validateCartItem = [
  body('productId')
    .isMongoId()
    .withMessage('ID do produto inválido'),
  
  body('quantity')
    .isInt({ min: 1, max: 50 })
    .withMessage('Quantidade deve ser entre 1 e 50'),
  
  body('specialInstructions')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Instruções especiais não podem exceder 200 caracteres'),
  
  handleValidationErrors
];

// Validações para entrega
const validateDelivery = [
  body('address.street')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Rua deve ter entre 5 e 100 caracteres'),
  
  body('address.city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Cidade deve ter entre 2 e 50 caracteres'),
  
  body('address.postalCode')
    .matches(/^\d{4}-\d{3}$/)
    .withMessage('Código postal deve estar no formato 0000-000'),
  
  body('address.coordinates.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude deve estar entre -90 e 90'),
  
  body('address.coordinates.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude deve estar entre -180 e 180'),
  
  body('deliveryFee')
    .isFloat({ min: 0 })
    .withMessage('Taxa de entrega deve ser um número positivo'),
  
  body('distance')
    .isFloat({ min: 0 })
    .withMessage('Distância deve ser um número positivo'),
  
  body('estimatedDuration')
    .isInt({ min: 1 })
    .withMessage('Duração estimada deve ser um número positivo'),
  
  handleValidationErrors
];

// Validações para contacto
const validateContact = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras e espaços'),
  
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email muito longo'),
  
  body('phone')
    .optional()
    .matches(/^(\+351|00351)?[9][0-9]{8}$/)
    .withMessage('Telefone deve ser um número português válido'),
  
  body('subject')
    .isIn(['encomenda_especial', 'catering', 'informacoes', 'reclamacao', 'sugestao', 'parceria', 'outro'])
    .withMessage('Assunto inválido'),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Mensagem deve ter entre 10 e 1000 caracteres'),
  
  handleValidationErrors
];

// Validações para fidelidade
const validateLoyaltyPoints = [
  body('points')
    .isInt({ min: 1 })
    .withMessage('Pontos devem ser um número positivo'),
  
  body('description')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Descrição deve ter entre 5 e 200 caracteres'),
  
  handleValidationErrors
];

// Validações para atualização de perfil
const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve ter entre 2 e 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras e espaços'),
  
  body('phone')
    .optional()
    .matches(/^(\+351|00351)?[9][0-9]{8}$/)
    .withMessage('Telefone deve ser um número português válido'),
  
  body('address.street')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Rua deve ter entre 5 e 100 caracteres'),
  
  body('address.city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Cidade deve ter entre 2 e 50 caracteres'),
  
  body('address.postalCode')
    .optional()
    .matches(/^\d{4}-\d{3}$/)
    .withMessage('Código postal deve estar no formato 0000-000'),
  
  handleValidationErrors
];

// Validações para alteração de password
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Password atual é obrigatória'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nova password deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Nova password deve conter pelo menos uma letra maiúscula, uma minúscula e um número'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Confirmação de password não coincide');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validações para IDs MongoDB
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('ID inválido'),
  
  handleValidationErrors
];

// Validações para paginação
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número positivo'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser entre 1 e 100'),
  
  query('sort')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Ordenação deve ser "asc" ou "desc"'),
  
  handleValidationErrors
];

// Validações para filtros de produtos
const validateProductFilters = [
  query('category')
    .optional()
    .isIn(['bolos', 'salgados', 'bebidas', 'sobremesas', 'pães', 'especialidades'])
    .withMessage('Categoria inválida'),
  
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Preço mínimo deve ser um número positivo'),
  
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Preço máximo deve ser um número positivo'),
  
  query('available')
    .optional()
    .isBoolean()
    .withMessage('Disponibilidade deve ser um valor booleano'),
  
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Destaque deve ser um valor booleano'),
  
  handleValidationErrors
];

// Validações para filtros de pedidos
const validateOrderFilters = [
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Status inválido'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data de início deve estar no formato ISO'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data de fim deve estar no formato ISO'),
  
  query('deliveryType')
    .optional()
    .isIn(['delivery', 'pickup', 'dine-in'])
    .withMessage('Tipo de entrega inválido'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateProduct,
  validateOrder,
  validateCartItem,
  validateDelivery,
  validateContact,
  validateLoyaltyPoints,
  validateProfileUpdate,
  validatePasswordChange,
  validateMongoId,
  validatePagination,
  validateProductFilters,
  validateOrderFilters
};
