import prisma from './server/db.js';

async function main() {
    console.log('Clearing ALL flow sessions...');
    const deleted = await prisma.flowSession.deleteMany({});
    console.log(`Deleted ${deleted.count} sessions.`);

    // Also clear logs to be clean
    const deletedLogs = await prisma.flowSessionLog.deleteMany({});
    console.log(`Deleted ${deletedLogs.count} logs.`);

    // Also clear received messages related to flows
    const deletedMsgs = await prisma.receivedMessage.deleteMany({
        where: { messageBody: { contains: '[Fluxo]' } }
    });
    console.log(`Deleted ${deletedMsgs.count} flow messages.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
