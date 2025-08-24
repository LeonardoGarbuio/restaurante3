const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');

// Criar payment intent
router.post('/create-payment-intent', async (req, res) => {
    try {
        const { amount, currency = 'eur', metadata = {} } = req.body;
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe usa centavos
            currency,
            metadata,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('❌ Erro ao criar payment intent:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar pagamento',
            error: error.message
        });
    }
});

// Webhook para confirmar pagamentos
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('❌ Erro no webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        console.log('✅ Pagamento confirmado:', paymentIntent.id);
        
        // Aqui você pode salvar o pedido no banco de dados
        // await saveOrder(paymentIntent);
    }

    res.json({ received: true });
});

// Histórico de pedidos por cliente
router.get('/history/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        
        const paymentIntents = await stripe.paymentIntents.list({
            customer: customerId,
            limit: 100,
        });

        res.json({
            success: true,
            orders: paymentIntents.data
        });
    } catch (error) {
        console.error('❌ Erro ao buscar histórico:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar histórico',
            error: error.message
        });
    }
});

module.exports = router;
