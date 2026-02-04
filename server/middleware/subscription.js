import prisma from '../db.js';

// Hardcoded Master Emails
const MASTERS = [
    'felipecostalopes44@gmail.com',
    'felipevibelink@gmail.com',
    'xmitox@live.com'
];

export const checkSubscription = async (req, res, next) => {
    try {
        const userId = req.userId; // From authenticateToken
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // 1. MASTER Check (Always Allowed)
        if (user.email && MASTERS.includes(user.email.toLowerCase())) {
            req.isMaster = true;
            return next();
        }

        // 2. FREE Tier Check (Always Allowed)
        if (user.planType === 'free') {
            return next();
        }

        // 3. TRIAL Check (High Priority for new users)
        if (user.trialExpiresAt && new Date() < new Date(user.trialExpiresAt)) {
            return next();
        }

        // 4. PAID Tier Check
        if (user.planType === 'paid') {
            // Check Subscription Status & Expiry
            if (user.subscriptionStatus === 'active') {
                // If they are active, they must have an expiry in the future
                if (user.subscriptionExpiresAt && new Date() < new Date(user.subscriptionExpiresAt)) {
                    return next();
                }
            }

            // If we get here, they are blocked
            return res.status(403).json({
                error: 'Subscription Required',
                code: 'SUBSCRIPTION_REQUIRED',
                message: 'Seu período de teste expirou. Assine para continuar usando o sistema.'
            });
        }

        // Fallback (Shouldn't happen, but allow or block? Block safer)
        return next();

    } catch (err) {
        console.error('Subscription Check Error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const isMaster = (req, res, next) => {
    if (req.isMaster) return next();
    return res.status(403).json({ error: 'Access Denied: Master Role Required' });
};
