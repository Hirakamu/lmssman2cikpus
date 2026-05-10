/**
 * Database Configuration
 * This file is maintained for backward compatibility
 * All database operations should now use the DatabaseClient from src/database/client.ts
 */

import { db } from './db.js';

// Re-export the database client
export { db };

/**
 * Legacy export for backward compatibility
 * @deprecated Use `db` from '../database/client.js' instead
 */
export const databasePool = db.getPool();
