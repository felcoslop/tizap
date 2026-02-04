
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true }
    });
    console.log('User IDs:', users.map(u => u.id));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
