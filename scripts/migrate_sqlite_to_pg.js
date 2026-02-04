import pg from 'pg';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB Configuration
// Normalize SQLite path to remove "file:" prefix if present
let sqlitePath = process.env.DATABASE_URL || './database.sqlite';
sqlitePath = sqlitePath.replace('file:', '');
if (!path.isAbsolute(sqlitePath)) {
    sqlitePath = path.resolve(process.cwd(), sqlitePath);
}

const PG_CONNECTION_STRING = process.env.DATABASE_URL_PG;

async function migrate() {
    if (!PG_CONNECTION_STRING) {
        console.error('❌ DATABASE_URL_PG not set. Skipping migration.');
        return;
    }

    console.log('🚀 Starting Migration: SQLite -> PostgreSQL');
    console.log(`📂 SQLite File: ${sqlitePath}`);

    // 1. Initialize SQLite (Raw Driver)
    let db;
    try {
        db = await open({
            filename: sqlitePath,
            driver: sqlite3.Database
        });
        console.log('✅ Connected to SQLite');
    } catch (err) {
        console.error('❌ Failed to open SQLite:', err.message);
        return;
    }

    // 2. Initialize Postgres Client
    const pgPool = new pg.Pool({
        connectionString: PG_CONNECTION_STRING,
    });

    try {
        const pgClient = await pgPool.connect();
        console.log('✅ Connected to PostgreSQL');
        pgClient.release();

        // 3. Define Tables in Order (for Foreign Keys)
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

            // Check if table exists in SQLite
            const tableExists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
            if (!tableExists) {
                console.log(`   ⏩ Table ${table} does not exist in SQLite. Skipping...`);
                continue;
            }

            // Read from SQLite using raw SQL
            const records = await db.all(`SELECT * FROM "${table}"`);
            console.log(`   Found ${records.length} records in SQLite.`);

            if (records.length === 0) continue;

            // Write to Postgres
            const client = await pgPool.connect();
            try {
                await client.query('BEGIN');

                for (const record of records) {
                    const keys = Object.keys(record);
                    const values = keys.map(key => record[key]);

                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                    const columns = keys.map(k => `"${k}"`).join(', ');

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
        if (db) await db.close();
        await pgPool.end();
    }
}

migrate();
