const express = require('express');
const router = express.Router();
const { authenticateAdmin, requirePermission } = require('../middleware/admin-auth');

// Listar todas as entregas
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        // Simular dados de delivery (em produção, viria do banco)
        const deliveries = [
            {
                id: 1,
                orderId: '001',
                customerName: 'João Silva',
                address: 'Rua das Flores, 123',
                status: 'pending',
                driver: null,
                estimatedTime: null,
                createdAt: new Date().toISOString()
            },
            {
                id: 2,
                orderId: '002',
                customerName: 'Maria Santos',
                address: 'Av. Principal, 456',
                status: 'active',
                driver: 'João Entregador',
                estimatedTime: '15:30',
                createdAt: new Date().toISOString()
            }
        ];

        res.json({
            success: true,
            deliveries
        });
    } catch (error) {
        console.error('❌ Erro ao buscar entregas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Criar nova entrega
router.post('/', authenticateAdmin, requirePermission('manage_orders'), async (req, res) => {
    try {
        const { orderId, customerName, address, estimatedTime } = req.body;
        
        if (!orderId || !customerName || !address) {
            return res.status(400).json({
                success: false,
                message: 'Dados obrigatórios não fornecidos'
            });
        }

        // Simular criação de entrega
        const newDelivery = {
            id: Date.now(),
            orderId,
            customerName,
            address,
            status: 'pending',
            driver: null,
            estimatedTime: estimatedTime || null,
            createdAt: new Date().toISOString()
        };

        res.status(201).json({
            success: true,
            message: 'Entrega criada com sucesso',
            delivery: newDelivery
        });

    } catch (error) {
        console.error('❌ Erro ao criar entrega:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Atualizar status da entrega
router.patch('/:id/status', authenticateAdmin, requirePermission('manage_orders'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, driver, estimatedTime } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status é obrigatório'
            });
        }

        // Simular atualização
        const updatedDelivery = {
            id: parseInt(id),
            status,
            driver: driver || null,
            estimatedTime: estimatedTime || null,
            updatedAt: new Date().toISOString()
        };

        res.json({
            success: true,
            message: 'Status atualizado com sucesso',
            delivery: updatedDelivery
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Atribuir entregador
router.patch('/:id/assign', authenticateAdmin, requirePermission('manage_orders'), async (req, res) => {
    try {
        const { id } = req.params;
        const { driverId, driverName } = req.body;
        
        if (!driverId || !driverName) {
            return res.status(400).json({
                success: false,
                message: 'Dados do entregador são obrigatórios'
            });
        }

        // Simular atribuição
        const assignment = {
            deliveryId: parseInt(id),
            driverId,
            driverName,
            assignedAt: new Date().toISOString(),
            status: 'assigned'
        };

        res.json({
            success: true,
            message: 'Entregador atribuído com sucesso',
            assignment
        });

    } catch (error) {
        console.error('❌ Erro ao atribuir entregador:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Rota de entrega (para entregadores)
router.get('/driver/:driverId', async (req, res) => {
    try {
        const { driverId } = req.params;
        
        // Simular entregas do entregador
        const driverDeliveries = [
            {
                id: 1,
                orderId: '001',
                customerName: 'João Silva',
                address: 'Rua das Flores, 123',
                status: 'active',
                estimatedTime: '15:30'
            }
        ];

        res.json({
            success: true,
            deliveries: driverDeliveries
        });

    } catch (error) {
        console.error('❌ Erro ao buscar entregas do entregador:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Atualizar localização da entrega (GPS)
router.post('/:id/location', async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, timestamp } = req.body;
        
        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Coordenadas são obrigatórias'
            });
        }

        // Simular atualização de localização
        const locationUpdate = {
            deliveryId: parseInt(id),
            latitude,
            longitude,
            timestamp: timestamp || new Date().toISOString()
        };

        res.json({
            success: true,
            message: 'Localização atualizada',
            location: locationUpdate
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar localização:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Calcular rota otimizada
router.post('/optimize-route', authenticateAdmin, requirePermission('manage_orders'), async (req, res) => {
    try {
        const { deliveries } = req.body;
        
        if (!deliveries || !Array.isArray(deliveries)) {
            return res.status(400).json({
                success: false,
                message: 'Lista de entregas é obrigatória'
            });
        }

        // Simular cálculo de rota otimizada
        const optimizedRoute = {
            totalDistance: '12.5 km',
            estimatedTime: '45 min',
            route: deliveries.map((delivery, index) => ({
                order: index + 1,
                address: delivery.address,
                estimatedTime: `${index * 15 + 10}:00`
            }))
        };

        res.json({
            success: true,
            message: 'Rota otimizada calculada',
            route: optimizedRoute
        });

    } catch (error) {
        console.error('❌ Erro ao calcular rota:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
