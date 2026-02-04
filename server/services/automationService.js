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

        // CONSOLIDATED PROTECTION: Active or Waiting sessions
        const existingSession = await prisma.flowSession.findFirst({
            where: {
                contactPhone: { in: possibleNumbers },
                status: { in: ['active', 'waiting_reply'] },
                OR: [{ flow: { userId } }, { automation: { userId } }]
            },
            include: { automation: true, flow: true },
            orderBy: { updatedAt: 'desc' }
        });

        if (existingSession) {
            const sessionAge = Date.now() - new Date(existingSession.updatedAt).getTime();
            const automationWaitTime = existingSession.automation?.sessionWaitTime;
            const waitTimeMinutes = automationWaitTime !== undefined ? automationWaitTime : (userConfig?.sessionWaitTime || 1440);
            const expirationLimit = waitTimeMinutes * 60 * 1000;

            console.log(`[AUTOMATION DEBUG] Session ${existingSession.id} (${existingSession.status}) age: ${Math.round(sessionAge / 1000)}s | Limit: ${Math.round(expirationLimit / 1000)}s`);

            if (sessionAge > expirationLimit) {
                console.log(`[AUTOMATION DEBUG] Session ${existingSession.id} EXPIRED. Updating status.`);
                await prisma.flowSession.update({
                    where: { id: existingSession.id },
                    data: { status: 'expired' }
                });
                // After expiring, we let the logic continue to check new triggers
            } else {
                if (existingSession.status === 'waiting_reply') {
                    const sessionProcessed = await FlowEngine.processMessage(contactPhone, messageBody, null, userId, 'evolution');
                    if (sessionProcessed) return;
                }

                console.log(`[AUTOMATION] Contact has an existing ${existingSession.status} session. Blocking other triggers.`);
                return;
            }
        }

        // PRIORITY 2: Check keyword automations
        for (const automation of keywordAutomations) {
            const keywords = (automation.triggerKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            if (keywords.length === 0) continue;

            for (const kw of keywords) {
                if (messageBody.toLowerCase().includes(kw)) {
                    // Check Anti-Loop for THIS SPECIFIC automation
                    const lastExecution = await prisma.flowSession.findFirst({
                        where: {
                            contactPhone: { in: possibleNumbers },
                            automationId: automation.id,
                            status: 'completed'
                        },
                        orderBy: { updatedAt: 'desc' }
                    });

                    if (lastExecution) {
                        const delayMinutes = userConfig?.automationDelay || 1440;
                        const age = Date.now() - new Date(lastExecution.updatedAt).getTime();
                        if (age < delayMinutes * 60 * 1000) {
                            console.log(`[AUTOMATION] Keyword match skipped by Anti-Loop for "${automation.name}"`);
                            continue; // Skip this automation but could check others
                        }
                    }

                    console.log(`[AUTOMATION] Matched "${automation.name}" via keyword: ${kw}`);

                    await FlowEngine.startFlow(null, contactPhone, userId, 'evolution', automation.id);
                    return;
                }
            }
        }

        // PRIORITY 3: Global message automations
        if (!isFromMe) {
            for (const automation of messageAutomations) {
                // Check Anti-Loop for THIS SPECIFIC global automation
                const lastExecution = await prisma.flowSession.findFirst({
                    where: {
                        contactPhone: { in: possibleNumbers },
                        automationId: automation.id,
                        status: { in: ['completed', 'expired', 'stopped'] }
                    },
                    orderBy: { updatedAt: 'desc' }
                });

                if (lastExecution) {
                    const delayMinutes = userConfig?.automationDelay || 1440;
                    const diff = Date.now() - new Date(lastExecution.updatedAt).getTime();
                    const age = Math.max(0, diff);
                    if (age < delayMinutes * 60 * 1000) {
                        console.log(`[AUTOMATION] Global trigger skipped by Anti-Loop for "${automation.name}"`);
                        continue;
                    }
                }

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
