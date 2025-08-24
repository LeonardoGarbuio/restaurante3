const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_...');

module.exports = stripe;
