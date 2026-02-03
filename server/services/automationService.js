import prisma from '../db.js';

export const processAutomations = async (userId, contactPhone, messageBody, isFromMe = false) => {
    try {
        const FlowEngine = (await import('./flowEngine.js')).default;

        console.log(`[AUTOMATION DEBUG] [START] Phone: ${contactPhone} | User: ${userId} | isFromMe: ${isFromMe} | Body: "${messageBody}"`);
        let normalizedPhone = String(contactPhone).replace(/\D/g, '');
        if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;

        const possibleNumbers = [normalizedPhone, normalizedPhone.replace('55', '')];
        if (normalizedPhone.length === 13 && normalizedPhone.startsWith('55')) {
            const withoutNine = normalizedPhone.slice(0, 4) + normalizedPhone.slice(5);
            possibleNumbers.push(withoutNine, withoutNine.replace('55', ''));
        }
        if (normalizedPhone.length === 12 && normalizedPhone.startsWith('55')) {
            const withNine = normalizedPhone.slice(0, 4) + '9' + normalizedPhone.slice(4);
            possibleNumbers.push(withNine, withNine.replace('55', ''));
        }

        const [automations, userConfig] = await Promise.all([
            prisma.automation.findMany({
                where: { userId, isActive: true }
            }),
            prisma.userConfig.findUnique({ where: { userId } })
        ]);

        console.log(`[AUTOMATION DEBUG] [RESOURCES] Automations: ${automations.length} | Config found: ${!!userConfig}`);

        const keywordAutomations = automations.filter(a => a.triggerType === 'keyword');
        const messageAutomations = automations.filter(a => a.triggerType === 'message' || a.triggerType === 'new_message');

        // PRIORITY 1: Check keyword automations first
        for (const automation of keywordAutomations) {
            const keywords = (automation.triggerKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            if (keywords.length === 0) continue;

            for (const kw of keywords) {
                if (messageBody.toLowerCase().includes(kw)) {
                    console.log(`[AUTOMATION] Matched "${automation.name}" via keyword: ${kw}`);

                    const activeSessions = await prisma.flowSession.findMany({
                        where: {
                            contactPhone: { in: possibleNumbers },
                            status: { in: ['active', 'waiting_reply'] },
                            OR: [{ flow: { userId } }, { automation: { userId } }]
                        }
                    });

                    if (activeSessions.length > 0) {
                        await prisma.flowSession.updateMany({
                            where: { id: { in: activeSessions.map(s => s.id) } },
                            data: { status: 'expired' }
                        });
                    }

                    await FlowEngine.startFlow(null, contactPhone, userId, 'evolution', automation.id);
                    return;
                }
            }
        }

        // Check for existing active session
        const existingSession = await prisma.flowSession.findFirst({
            where: {
                contactPhone: { in: possibleNumbers },
                status: 'waiting_reply',
                OR: [{ flow: { userId } }, { automation: { userId } }]
            },
            include: { automation: true, flow: true },
            orderBy: { updatedAt: 'desc' }
        });

        if (existingSession) {
            const sessionAge = Date.now() - new Date(existingSession.updatedAt).getTime();
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (sessionAge > twentyFourHours) {
                await prisma.flowSession.update({
                    where: { id: existingSession.id },
                    data: { status: 'expired' }
                });
            } else {
                const sessionProcessed = await FlowEngine.processMessage(contactPhone, messageBody, null, userId, 'evolution');
                if (sessionProcessed) return;
            }
        }

        // PROTECTION: Running or recently completed session
        const protectionSession = await prisma.flowSession.findFirst({
            where: {
                contactPhone: { in: possibleNumbers },
                status: { in: ['active', 'completed'] },
                OR: [{ flow: { userId } }, { automation: { userId } }]
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (protectionSession) {
            const sessionAge = Date.now() - new Date(protectionSession.updatedAt).getTime();
            if (protectionSession.status === 'active') {
                if (sessionAge < 5 * 60 * 1000) return;
            } else if (protectionSession.status === 'completed') {
                const delayMinutes = userConfig?.automationDelay || 1440;
                if (sessionAge < delayMinutes * 60 * 1000) return;
            }
        }

        // PRIORITY 2: Global message automations
        if (!isFromMe) {
            for (const automation of messageAutomations) {
                await FlowEngine.startFlow(null, contactPhone, userId, 'evolution', automation.id);
                return;
            }
        }

    } catch (err) {
        console.error('[AUTOMATION PROCESS ERROR]', err);
    }
};

export const processEventAutomations = async (userId, triggerType, context = '', contactPhone = null) => {
    try {
        const FlowEngine = (await import('./flowEngine.js')).default;
        const automations = await prisma.automation.findMany({
            where: { userId, triggerType, isActive: true }
        });

        for (const auto of automations) {
            const targetPhone = contactPhone || 'system';
            await FlowEngine.startFlow(null, targetPhone, userId, 'evolution', auto.id);
            console.log(`[EVENT] Triggered ${triggerType} automation for ${targetPhone}`);
        }
    } catch (err) {
        console.error('[EVENT PROCESS ERROR]', err);
    }
};
