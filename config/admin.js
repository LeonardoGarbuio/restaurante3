const bcrypt = require('bcryptjs');

const adminCredentials = {
    admin: {
        username: 'admin',
        password: 'admin123', // Em produção, usar senha forte
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'manage_users', 'manage_orders', 'manage_products']
    },
    manager: {
        username: 'manager',
        password: 'manager123',
        role: 'manager',
        permissions: ['read', 'write', 'manage_orders', 'manage_products']
    }
};

async function verifyCredentials(username, password) {
    const user = adminCredentials[username];
    
    if (!user) {
        return null;
    }
    
    // Em produção, comparar hash da senha
    if (user.password === password) {
        return {
            id: username,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        };
    }
    
    return null;
}

module.exports = {
    adminCredentials,
    verifyCredentials
};
