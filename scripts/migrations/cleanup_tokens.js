
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
    console.log('Iniciando limpeza de tokens...');

    const allConfigs = await prisma.userConfig.findMany();

    for (const config of allConfigs) {
        if (config.token) {
            const trimmedToken = config.token.trim();
            if (trimmedToken !== config.token) {
                console.log(`Corrigindo token para usuário ${config.userId}...`);
                try {
                    await prisma.userConfig.update({
                        where: { userId: config.userId },
                        data: { token: trimmedToken }
                    });
                    console.log(`Token corrigido para usuário ${config.userId}`);
                } catch (e) {
                    console.error(`Erro ao corrigir token para usuário ${config.userId}:`, e.message);
                }
            }
        }
    }

    console.log('Limpeza concluída.');
}

cleanup()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
