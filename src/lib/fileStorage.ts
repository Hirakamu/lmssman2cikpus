import * as fs from 'fs/promises';
import * as path from 'path';
import { lookup as mimeLookup } from 'mime-types';
import { logger } from './logger.js';
import { env } from './env.js';

export interface FileInfo {
	uuid: string;
	filename: string;
	ext: string;
	size: number;
	mimetype: string | false;
	createdAt: Date;
	modifiedAt: Date;
}

export interface WriteResult {
	success: boolean;
	filename: string;
	error?: string;
}

export interface BatchWriteReport {
	succeeded: WriteResult[];
	failed: WriteResult[];
	total: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flat file storage client
 * All files stored as uuid.ext inside a single base directory
 * Pure I/O — no SQL knowledge
 */
export class FileStorageClient {
	private base: string;

	constructor() {
		this.base = env.location;
	}

	private resolvePath(filename: string): string {
		return path.join(this.base, filename);
	}

	// ─── Core Write ──────────────────────────────────────────────────────────────

	/**
	 * Write a single file atomically using temp file + rename
	 * filename should be uuid.ext (e.g. "abc123.webp")
	 */
	async newFile(filename: string, buffer: Buffer): Promise<boolean> {
		const dest = this.resolvePath(filename);
		const tmp = `${dest}.tmp`;
		try {
			await fs.writeFile(tmp, buffer);
			await fs.rename(tmp, dest);
			logger.debug('File written', { filename, size: buffer.length });
			return true;
		} catch (error) {
			logger.error('Failed to write file', { filename, error });
			// clean up temp if it exists
			await fs.unlink(tmp).catch(() => {});
			return false;
		}
	}

	/**
	 * Write multiple files in parallel
	 * Each file retries up to MAX_RETRIES on failure
	 * Other files are not blocked by one failure
	 * Returns a report of succeeded and failed writes
	 */
	async newFiles(
		files: Array<{ filename: string; buffer: Buffer }>
	): Promise<BatchWriteReport> {
		const results = await Promise.all(
			files.map(async ({ filename, buffer }): Promise<WriteResult> => {
				let lastError: string | undefined;

				for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
					const ok = await this.newFile(filename, buffer);
					if (ok) return { success: true, filename };

					lastError = `Failed after attempt ${attempt}`;
					if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
				}

				logger.error('File failed after all retries', { filename });
				return { success: false, filename, error: lastError };
			})
		);

		const succeeded = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);

		logger.debug('Batch write complete', {
			total: files.length,
			succeeded: succeeded.length,
			failed: failed.length,
		});

		return { succeeded, failed, total: files.length };
	}

	// ─── Core Read ───────────────────────────────────────────────────────────────

	/**
	 * Read a file by filename (uuid.ext)
	 */
	async readFile(filename: string): Promise<Buffer | null> {
		try {
			const buffer = await fs.readFile(this.resolvePath(filename));
			logger.debug('File read', { filename, size: buffer.length });
			return buffer;
		} catch (error) {
			logger.error('Failed to read file', { filename, error });
			return null;
		}
	}

	// ─── Metadata ────────────────────────────────────────────────────────────────

	/**
	 * Get file metadata without reading the full buffer
	 */
	async fileInfo(filename: string): Promise<FileInfo | null> {
		try {
			const stat = await fs.stat(this.resolvePath(filename));
			const ext = path.extname(filename).slice(1);

			return {
				uuid: path.basename(filename, path.extname(filename)),
				filename,
				ext,
				size: stat.size,
				mimetype: mimeLookup(filename),
				createdAt: stat.birthtime,
				modifiedAt: stat.mtime,
			};
		} catch (error) {
			logger.error('Failed to get file info', { filename, error });
			return null;
		}
	}

	/**
	 * Check if a file exists by filename
	 */
	async fileExists(filename: string): Promise<boolean> {
		try {
			await fs.access(this.resolvePath(filename));
			return true;
		} catch {
			return false;
		}
	}

	// ─── Delete ──────────────────────────────────────────────────────────────────

	/**
	 * Delete a file by filename
	 */
	async deleteFile(filename: string): Promise<boolean> {
		try {
			await fs.unlink(this.resolvePath(filename));
			logger.debug('File deleted', { filename });
			return true;
		} catch (error) {
			logger.error('Failed to delete file', { filename, error });
			return false;
		}
	}

	// ─── Health ──────────────────────────────────────────────────────────────────

	/**
	 * Verify base directory is accessible and writable
	 */
	async healthCheck(): Promise<boolean> {
		try {
			await fs.access(this.base, fs.constants.R_OK | fs.constants.W_OK);
			logger.info('Storage health check passed', { base: this.base });
			return true;
		} catch (error) {
			logger.error('Storage health check failed', { base: this.base, error });
			return false;
		}
	}
}

export const storage = new FileStorageClient();
