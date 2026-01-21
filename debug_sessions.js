import prisma from './server/db.js';

async function main() {
    console.log('Checking Flow Sessions...');
    const count = await prisma.flowSession.count();
    console.log(`Total Sessions in DB: ${count}`);

    const sessions = await prisma.flowSession.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { flow: true }
    });

    const fs = await import('fs');
    let output = `Total Sessions in DB: ${count}\n\nRecent 10 Sessions:\n`;
    sessions.forEach(s => {
        output += `ID: ${s.id} | Phone: ${s.contactPhone} | Status: ${s.status} | Updated: ${s.updatedAt} | FlowID: ${s.flowId} | FlowUser: ${s.flow?.userId}\n`;
    });
    fs.writeFileSync('session_dump.txt', output);
    console.log('Dumped to session_dump.txt');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
