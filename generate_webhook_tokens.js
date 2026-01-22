import prisma from './server/db.js';
import { generateWebhookToken } from './server/utils/webhookToken.js';

async function generateTokens() {
    console.log('[MIGRATION] Generating webhook tokens for existing users...');

    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true },
            include: { config: true }
        });

        console.log(`[MIGRATION] Found ${users.length} users`);

        for (const user of users) {
            const webhookToken = generateWebhookToken(user.email);

            if (user.config) {
                await prisma.userConfig.update({
                    where: { userId: user.id },
                    data: { webhookToken }
                });
                console.log(`[MIGRATION] Updated user ${user.id} (${user.email}): ${webhookToken}`);
            } else {
                await prisma.userConfig.create({
                    data: {
                        userId: user.id,
                        webhookToken
                    }
                });
                console.log(`[MIGRATION] Created config for user ${user.id} (${user.email}): ${webhookToken}`);
            }
        }

        console.log(`[MIGRATION] ✅ Complete! Generated tokens for ${users.length} users`);
    } catch (err) {
        console.error('[MIGRATION ERROR]', err);
    } finally {
        await prisma.$disconnect();
    }
}

generateTokens();
