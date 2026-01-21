import prisma from './server/db.js';

async function main() {
    const userId = 2;
    console.log(`Querying sessions for User ID: ${userId}`);

    try {
        const sessions = await prisma.flowSession.findMany({
            where: { flow: { userId } },
            orderBy: { updatedAt: 'desc' },
            include: { flow: true }
        });

        console.log(`Found ${sessions.length} sessions.`);

        sessions.forEach(s => {
            console.log('--- Session ---');
            console.log(`ID: ${s.id}`);
            console.log(`Phone: ${s.contactPhone}`);
            console.log(`Status: ${s.status}`);
            console.log(`Flow ID: ${s.flowId}`);
            console.log(`Flow Found: ${!!s.flow}`);
            if (s.flow) {
                console.log(`Flow Name: ${s.flow.name}`);
                console.log(`Flow UserID: ${s.flow.userId}`);
            }
        });

    } catch (e) {
        console.error('Query Error:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
