
import { PrismaClient as PrismaClientSQLite } from '@prisma/client'; // Will use default schema (which is currently sqlite)
import { PrismaClient as PrismaClientPG } from '@prisma/client'; // We need a way to instantiate PG client dynamically or use a raw query builder
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Since we cannot have two generated Prisma Clients with different providers easily in one project without complex setup,
// We will use:
// 1. Prisma Client for READ (SQLite) - assuming generated client is currently SQLite.
// 2. 'pg' library for WRITE (PostgreSQL) - using raw INSERTs for speed and simplicity.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB Configuration
const SQLITE_URL = process.env.DATABASE_URL || 'file:./database.sqlite';
const PG_CONNECTION_STRING = process.env.DATABASE_URL_PG || 'postgresql://user:password@localhost:5432/tizap_db';

async function migrate() {
    console.log('🚀 Starting Migration: SQLite -> PostgreSQL');

    // 1. Initialize SQLite Client
    const prismaSqlite = new PrismaClientSQLite({
        datasources: { db: { url: SQLITE_URL } }
    });

    // 2. Initialize Postgres Client
    const pgPool = new pg.Pool({
        connectionString: PG_CONNECTION_STRING,
    });

    try {
        // Test Connections
        await prismaSqlite.$connect();
        console.log('✅ Connected to SQLite');

        const pgClient = await pgPool.connect();
        console.log('✅ Connected to PostgreSQL');
        pgClient.release();

        // 3. Define Tables in Order (for Foreign Keys)
        // Order matters! Parents first.
        const tables = [
            'User',
            'UserConfig',
            'Flow',
            'Automation',
            'FlowSession',
            'Dispatch',
            'DispatchLog',
            'EmailTemplate',
            'EmailCampaign',
            'EmailCampaignLog',
            'Message'
        ];

        for (const table of tables) {
            console.log(`\n📦 Migrating table: ${table}...`);

            // Read from SQLite
            // Dynamic access like prismaSqlite[table.toLowerCase()] required mapping casing
            // Prisma Client properties are usually camelCase (user, userConfig)
            const modelName = table.charAt(0).toLowerCase() + table.slice(1);

            if (!prismaSqlite[modelName]) {
                console.error(`❌ Model ${modelName} not found in Prisma Client`);
                continue;
            }

            const records = await prismaSqlite[modelName].findMany();
            console.log(`   Found ${records.length} records in SQLite.`);

            if (records.length === 0) continue;

            // Write to Postgres
            // We'll use a transaction for safety
            const client = await pgPool.connect();
            try {
                await client.query('BEGIN');

                for (const record of records) {
                    const keys = Object.keys(record);
                    const values = Object.values(record);

                    // Construct param placeholders ($1, $2, ...)
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                    const columns = keys.map(k => `"${k}"`).join(', '); // Quote columns for safety

                    const query = `
                        INSERT INTO "${table}" (${columns}) 
                        VALUES (${placeholders})
                        ON CONFLICT ("id") DO NOTHING;
                    `;

                    await client.query(query, values);
                }

                await client.query('COMMIT');
                console.log(`   ✅ Imported ${records.length} records to Postgres.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`   ❌ Failed to import table ${table}:`, err.message);
                throw err;
            } finally {
                client.release();
            }
        }

        console.log('\n🎉 Migration Completed Successfully!');

    } catch (err) {
        console.error('\n❌ Migration Failed:', err);
    } finally {
        await prismaSqlite.$disconnect();
        await pgPool.end();
    }
}

migrate();
