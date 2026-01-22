import prisma from './server/db.js';

async function main() {
    console.log('Force stopping ALL active flow sessions in database...');

    // Update active sessions
    const sessions = await prisma.flowSession.updateMany({
        where: { status: { in: ['active', 'waiting_reply'] } },
        data: { status: 'stopped' }
    });

    console.log(`Stopped ${sessions.count} stuck sessions.`);

    // Also stop running dispatches just in case
    const dispatches = await prisma.dispatch.updateMany({
        where: { status: { in: ['running', 'idle'] } },
        data: { status: 'stopped' }
    });

    console.log(`Stopped ${dispatches.count} stuck dispatches.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
