const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyCredentials } = require('../config/admin');

const JWT_SECRET = process.env.JWT_SECRET || 'admin-secret-key';

// Login admin
router.post('/login', async (req, res) => {
    try {
        console.log('🔐 Login request:', req.body);
        const { username, password } = req.body;
        
        if (!username || !password) {
            console.log('❌ Dados faltando');
            return res.status(400).json({
                success: false,
                message: 'Usuário e senha são obrigatórios'
            });
        }
        
        console.log('🔍 Verificando credenciais...');
        const user = await verifyCredentials(username, password);
        
        if (!user) {
            console.log('❌ Credenciais inválidas');
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }
        
        // Gerar JWT token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log('✅ Token gerado:', token);
        
        // Definir cookie
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
        });
        
        console.log('✅ Cookie definido, enviando resposta...');
        
        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Verificar token
router.get('/verify', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || 
                     req.cookies?.admin_token || 
                     req.query.token;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token não fornecido'
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        res.json({
            success: true,
            user: decoded
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar token:', error);
        res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({
        success: true,
        message: 'Logout realizado com sucesso'
    });
});

module.exports = router;
