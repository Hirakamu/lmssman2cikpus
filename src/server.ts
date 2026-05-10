import { createServer } from 'node:http';
import { app } from './app.js';
import { db } from './lib/db.js';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
const server = createServer(app);
server.listen(env.PORT, env.HOST, async () => {
    try {
        await db.query('SELECT 1');
    } catch (error) {
        logger.error('Database connection check failed on startup', error);
        process.exit(1);
    }
    logger.info(`Running.`);
});