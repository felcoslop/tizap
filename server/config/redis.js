import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    // TLS is often required for managed Redis (like Upstash or some Cloud providers)
    // If EasyPanel provides a rediss:// URL, we might need to adjust, but usually separate fields work.
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null, // Critical for BullMQ
    enableReadyCheck: false
};

const connection = new Redis(redisConfig);

connection.on('connect', () => {
    console.log('[REDIS] Connected to', redisConfig.host);
});

connection.on('error', (err) => {
    console.error('[REDIS ERROR]', err.message);
});

export default connection;
