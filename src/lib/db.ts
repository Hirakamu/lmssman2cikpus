import { Pool, QueryResult, PoolClient, QueryResultRow } from 'pg';
import { logger } from './logger.js';
import { env } from './env.js';

/**
 * PostgreSQL Database Client
 * Provides a wrapper around the pg Pool with error handling and logging
 */
export class DatabaseClient {
	private pool: Pool;
	private isConnected: boolean = false;

	constructor() {
		this.pool = new Pool({
			connectionString: env.DATABASE_URL,
			max: 20, // Maximum connections in pool
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 2000,
		});

		this.setupPoolEventListeners();
	}

	/**
	 * Setup event listeners for the pool
	 */
	private setupPoolEventListeners(): void {
		this.pool.on('error', (err: Error) => {
			logger.error('Unexpected error on idle client', { error: err });
		});

		this.pool.on('connect', () => {
			logger.debug('New client connected to pool');
		});

		this.pool.on('remove', () => {
			logger.debug('Client removed from pool');
		});
	}

	/**
	 * Execute a single query
	 */
	async query<T extends QueryResultRow = QueryResultRow>(
		text: string,
		values?: any[]
	): Promise<QueryResult<T>> {
		const startTime = Date.now();
		try {
			const result = await this.pool.query<T>(text, values);
			const duration = Date.now() - startTime;
			logger.debug('Query executed', { duration, rowCount: result.rowCount });
			return result;
		} catch (error) {
			logger.error('Query execution failed', { error, text, duration: Date.now() - startTime });
			throw error;
		}
	}

	/**
	 * Execute a query and return the first row
	 */
	async queryOne<T extends QueryResultRow = QueryResultRow>(
		text: string,
		values?: any[]
	): Promise<T | null> {
		const result = await this.query<T>(text, values);
		return result.rows[0] || null;
	}

	/**
	 * Execute a query and return all rows
	 */
	async queryAll<T extends QueryResultRow = QueryResultRow>(
		text: string,
		values?: any[]
	): Promise<T[]> {
		const result = await this.query<T>(text, values);
		return result.rows;
	}

	/**
	 * Execute a transaction
	 */
	async transaction<T>(
		callback: (client: PoolClient) => Promise<T>
	): Promise<T> {
		const client = await this.pool.connect();
		try {
			await client.query('BEGIN');
			const result = await callback(client);
			await client.query('COMMIT');
			logger.debug('Database transaction committed');
			return result;
		} catch (error) {
			await client.query('ROLLBACK');
			logger.error('Database transaction rolled back', { error });
			throw error;
		} finally {
			client.release();
		}
	}

	/**
	 * Check if database is connected
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const result = await this.query('SELECT NOW()');
			this.isConnected = !!result.rows[0];
			logger.info('Database health check passed');
			return this.isConnected;
		} catch (error) {
			this.isConnected = false;
			logger.error('Database health check failed', { error });
			return false;
		}
	}

	/**
	 * Get the raw pool for advanced operations
	 */
	getPool(): Pool {
		return this.pool;
	}

	/**
	 * Get pool statistics
	 */
	getPoolStats() {
		return {
			totalConnections: this.pool.totalCount,
			idleConnections: this.pool.idleCount,
			waitingRequests: this.pool.waitingCount,
		};
	}

	/**
	 * Close all connections
	 */
	async close(): Promise<void> {
		try {
			await this.pool.end();
			this.isConnected = false;
			logger.info('Database pool closed');
		} catch (error) {
			logger.error('Error closing database pool', { error });
			throw error;
		}
	}

	/**
	 * Check if connected
	 */
	getConnected(): boolean {
		return this.isConnected;
	}
}

// Export singleton instance
export const db = new DatabaseClient();
