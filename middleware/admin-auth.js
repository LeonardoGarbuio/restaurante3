const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'admin-secret-key';

function authenticateAdmin(req, res, next) {
    try {
        // Verificar token em diferentes locais
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.admin_token || 
                     req.query.token;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token de autenticação não fornecido'
            });
        }
        
        // Verificar token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Adicionar informações do usuário à requisição
        req.user = decoded;
        
        next();
    } catch (error) {
        console.error('❌ Erro na autenticação admin:', error);
        return res.status(401).json({
            success: false,
            message: 'Token inválido ou expirado'
        });
    }
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                message: 'Permissão insuficiente'
            });
        }
        
        next();
    };
}

module.exports = {
    authenticateAdmin,
    requirePermission
};
