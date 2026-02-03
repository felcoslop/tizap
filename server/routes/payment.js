import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/index.js';

const router = express.Router();

// Initialize MP (Lazy load or check env)
const getClient = () => {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return null;
    return new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
};

// Create Preference
router.post('/payment/preference', authenticateToken, async (req, res) => {
    try {
        const client = getClient();
        if (!client) return res.status(500).json({ error: 'Mercado Pago not configured' });

        const preference = new Preference(client);

        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + 30); // 30 min expiration for link

        const body = {
            items: [
                {
                    id: 'subscription_full_access',
                    title: 'Acesso Completo - Sistema de Automação',
                    quantity: 1,
                    unit_price: 129.99
                }
            ],
            payer: {
                name: user.name || 'Cliente',
                email: user.email
            },
            back_urls: {
                success: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?status=success`,
                failure: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/locked?status=failure`,
                pending: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/locked?status=pending`
            },
            auto_return: 'approved',
            notification_url: `${process.env.BACKEND_URL || 'https://seu-backend.com'}/api/payment/webhook`,
            external_reference: String(user.id),
            date_of_expiration: expiryDate.toISOString()
        };

        const result = await preference.create({ body });
        res.json({ id: result.id, init_point: result.init_point });

    } catch (err) {
        console.error('MP Create Preference Error:', err);
        res.status(500).json({ error: 'Erro ao criar pagamento' });
    }
});

// Webhook
router.post('/payment/webhook', async (req, res) => {
    try {
        const { type, data } = req.body;

        if (type === 'payment') {
            const client = getClient();
            if (client) {
                const preference = new Preference(client);
                // Fetch payment details to get external_reference
                const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
                    headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
                });

                if (paymentRes.ok) {
                    const payment = await paymentRes.json();
                    if (payment.status === 'approved' && payment.external_reference) {
                        const userId = parseInt(payment.external_reference);
                        const expiry = new Date();
                        expiry.setDate(expiry.getDate() + 30); // 30 days subscription

                        await prisma.user.update({
                            where: { id: userId },
                            data: {
                                planType: 'paid',
                                subscriptionStatus: 'active',
                                subscriptionExpiresAt: expiry,
                                lastPaymentId: String(data.id)
                            }
                        });
                        console.log(`[PAYMENT] User ${userId} subscription activated for 30 days.`);
                    }
                }
            }
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook Error:', err);
        res.status(500).send('Error');
    }
});

export default router;
