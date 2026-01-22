import prisma from './server/db.js';

async function migratePhones() {
    console.log('[MIGRATION] Starting phone normalization...');

    try {
        // Get all flow sessions
        const sessions = await prisma.flowSession.findMany({
            select: { id: true, contactPhone: true }
        });

        console.log(`[MIGRATION] Found ${sessions.length} sessions to check`);

        let updated = 0;
        for (const session of sessions) {
            let phone = String(session.contactPhone).replace(/\D/g, '');

            // If doesn't start with 55, add it
            if (!phone.startsWith('55')) {
                const normalizedPhone = '55' + phone;
                await prisma.flowSession.update({
                    where: { id: session.id },
                    data: { contactPhone: normalizedPhone }
                });
                console.log(`[MIGRATION] Updated session ${session.id}: ${session.contactPhone} -> ${normalizedPhone}`);
                updated++;
            }
        }

        console.log(`[MIGRATION] ✅ Complete! Updated ${updated} sessions`);
    } catch (err) {
        console.error('[MIGRATION ERROR]', err);
    } finally {
        await prisma.$disconnect();
    }
}

migratePhones();
