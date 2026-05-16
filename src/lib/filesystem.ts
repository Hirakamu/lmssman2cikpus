import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID, randomBytes } from 'crypto';
import { logger } from './logger.js';
import { env } from './env.js';

// Types

export type LMSFSCategory = string;

export interface LMSFSNewResult {
	status: boolean;
	uuid: string;
	accesslink: string;
}
export interface LMSFSGetResult {
	status: boolean;
	buffer: Buffer | null;
}
export interface LMSFSDeleteResult {
	status: boolean;
}
export interface LMSFSExistsResult {
	status: boolean;
}
export interface LMSFSInitResult {
	status: boolean;
	initialized: LMSFSCategory[];
	failed: LMSFSCategory[];
}
export interface LMSFSTmpWriteResult {
	status: boolean;
}
export interface LMSFSTmpAssembleResult {
	status: boolean;
	accesslink: string; // lms://temp/uuid.xxxx — ready to pass to lms.new()
}
export interface LMSFSTmpCleanResult {
	status: boolean;
}

// Source for lms.new() — direct buffer, or a lms://temp/... accesslink from tmpAssemble()
export type LMSFSNewSource =
	| { type: 'buffer'; data: Buffer }
	| { type: 'tmplink'; accesslink: string }; // lms://temp/uuid.xxxx

// Categories

const LMSFS_CATEGORIES = new Set<LMSFSCategory>([
	'student',
	'teacher',
	'other',
]);
const LMSFS_TMP_CATEGORY = 'temp';

export function getCategories(): LMSFSCategory[] {
	return Array.from(LMSFS_CATEGORIES);
}

// Paths

const LMSFS_PROTOCOL = 'lmsfs://';
const TMP_SUBDIR = '.tmp';

function parseAccesslink(accesslink: string): { category: string; filename: string } | null {
	if (!accesslink.startsWith(LMSFS_PROTOCOL)) return null;
	const withoutProtocol = accesslink.slice(LMSFS_PROTOCOL.length);
	const slashIndex = withoutProtocol.indexOf('/');
	if (slashIndex === -1) return null;
	const category = withoutProtocol.slice(0, slashIndex);
	const filename = withoutProtocol.slice(slashIndex + 1);
	if (!category || !filename) return null;
	// Allow both permanent categories and temp
	if (!LMSFS_CATEGORIES.has(category) && category !== LMSFS_TMP_CATEGORY) return null;
	return { category, filename };
}
function resolvePath(category: string, filename: string): string {
	if (category === LMSFS_TMP_CATEGORY) {
		return path.join(env.location, TMP_SUBDIR, '_assembled', filename);
	}
	return path.join(env.location, category, filename);
}
function resolveTmpDir(tempId: string): string {
	return path.join(env.location, TMP_SUBDIR, tempId);
}
function resolveChunkPath(tempId: string, index: number): string {
	// Zero-pad index so lexicographic sort = numeric sort (up to 99999 chunks)
	const paddedIndex = String(index).padStart(5, '0');
	return path.join(resolveTmpDir(tempId), `chunk-${paddedIndex}`);
}

// Core: permanent storage

async function lmsNew(category: LMSFSCategory, source: Buffer | LMSFSNewSource): Promise<LMSFSNewResult> {
	if (!LMSFS_CATEGORIES.has(category)) {
		logger.error('LMSFS new: unknown category', { category });
		return { status: false, uuid: '', accesslink: '' };
	}

	// Normalise: accept a raw Buffer directly (backwards-compatible)
	const normalisedSource: LMSFSNewSource =
		Buffer.isBuffer(source)
			? { type: 'buffer', data: source }
			: source;

	let buffer: Buffer;

	if (normalisedSource.type === 'buffer') {
		buffer = normalisedSource.data;
	} else {
		// Read directly from lmsfs://temp/... path — no redundant assembly step
		const { accesslink } = normalisedSource;
		const parsed = parseAccesslink(accesslink);
		if (!parsed || parsed.category !== LMSFS_TMP_CATEGORY) {
			logger.error('LMSFS new: invalid tmplink accesslink', { accesslink });
			return { status: false, uuid: '', accesslink: '' };
		}
		const tmpFilePath = resolvePath(parsed.category, parsed.filename);
		try {
			buffer = await fs.readFile(tmpFilePath);
		} catch (error) {
			logger.error('LMSFS new: could not read tmplink file', { accesslink, error });
			return { status: false, uuid: '', accesslink: '' };
		}
	}

	const uuid = randomUUID();
	const ext = randomBytes(4).toString('hex');
	const filename = `${uuid}.${ext}`;
	const dest = resolvePath(category, filename);
	const tmp = `${dest}.tmp`;

	try {
		await fs.writeFile(tmp, buffer);
		await fs.rename(tmp, dest);

		const accesslink = `${LMSFS_PROTOCOL}${category}/${filename}`;
		logger.debug('LMSFS file stored', { category, filename, size: buffer.length });

		return { status: true, uuid, accesslink };
	} catch (error) {
		logger.error('LMSFS new: write failed', { category, filename, error });
		await fs.unlink(tmp).catch(() => {});
		return { status: false, uuid: '', accesslink: '' };
	}
}

async function lmsGet(accesslink: string): Promise<LMSFSGetResult> {
	const parsed = parseAccesslink(accesslink);
	if (!parsed) {
		logger.error('LMSFS get: invalid accesslink', { accesslink });
		return { status: false, buffer: null };
	}

	const { category, filename } = parsed;
	const filepath = resolvePath(category, filename);

	try {
		const buffer = await fs.readFile(filepath);
		logger.debug('LMSFS file read', { category, filename, size: buffer.length });
		return { status: true, buffer };
	} catch (error) {
		logger.error('LMSFS get: read failed', { category, filename, error });
		return { status: false, buffer: null };
	}
}

async function lmsDelete(accesslink: string): Promise<LMSFSDeleteResult> {
	const parsed = parseAccesslink(accesslink);
	if (!parsed) {
		logger.error('LMSFS delete: invalid accesslink', { accesslink });
		return { status: false };
	}

	const { category, filename } = parsed;
	const filepath = resolvePath(category, filename);

	try {
		await fs.unlink(filepath);
		logger.debug('LMSFS file deleted', { category, filename });
		return { status: true };
	} catch (error) {
		logger.error('LMSFS delete: failed', { category, filename, error });
		return { status: false };
	}
}

async function lmsExists(accesslink: string): Promise<LMSFSExistsResult> {
	const parsed = parseAccesslink(accesslink);
	if (!parsed) return { status: false };

	const { category, filename } = parsed;
	const filepath = resolvePath(category, filename);

	try {
		await fs.access(filepath);
		return { status: true };
	} catch {
		return { status: false };
	}
}

// Core: temp chunk storage

async function lmsTmpWrite(tempId: string, index: number, buffer: Buffer): Promise<LMSFSTmpWriteResult> {
	if (!tempId || index < 0) {
		logger.error('LMSFS tmpWrite: invalid arguments', { tempId, index });
		return { status: false };
	}

	const tmpDir = resolveTmpDir(tempId);
	const chunkPath = resolveChunkPath(tempId, index);

	try {
		await fs.mkdir(tmpDir, { recursive: true });
		await fs.writeFile(chunkPath, buffer);
		logger.debug('LMSFS chunk written', { tempId, index, size: buffer.length });
		return { status: true };
	} catch (error) {
		logger.error('LMSFS tmpWrite: write failed', { tempId, index, error });
		return { status: false };
	}
}

async function lmsTmpAssemble(tempId: string, totalChunks: number): Promise<LMSFSTmpAssembleResult> {
	const tmpDir = resolveTmpDir(tempId);

	try {
		// Verify all chunks exist before attempting assembly
		const expectedChunks = Array.from({ length: totalChunks }, (_, i) =>
			resolveChunkPath(tempId, i)
		);
		const missingChunks: number[] = [];
		for (let i = 0; i < totalChunks; i++) {
			try {
				await fs.access(expectedChunks[i]);
			} catch {
				missingChunks.push(i);
			}
		}
		if (missingChunks.length > 0) {
			logger.error('LMSFS tmpAssemble: missing chunks', { tempId, missingChunks });
			return { status: false, accesslink: '' };
		}

		// Write assembled file as a proper lmsfs://temp entry
		const uuid = randomUUID();
		const ext = randomBytes(4).toString('hex');
		const filename = `${uuid}.${ext}`;
		const assembledDir = path.join(env.location, TMP_SUBDIR, '_assembled');
		await fs.mkdir(assembledDir, { recursive: true });
		const assemblyPath = path.join(assembledDir, filename);

		// Stream-concatenate chunks directly to disk — RAM stays flat
		const { createWriteStream } = await import('fs');
		const writeStream = createWriteStream(assemblyPath);
		await new Promise<void>((resolve, reject) => {
			writeStream.on('error', reject);
			writeStream.on('finish', resolve);

			(async () => {
				for (const chunkPath of expectedChunks) {
					const chunk = await fs.readFile(chunkPath);
					if (!writeStream.write(chunk)) {
						await new Promise<void>((res) => writeStream.once('drain', res));
					}
				}
				writeStream.end();
			})().catch(reject);
		});

		const accesslink = `${LMSFS_PROTOCOL}${LMSFS_TMP_CATEGORY}/${filename}`;
		logger.debug('LMSFS tmpAssemble: complete', { tempId, totalChunks, accesslink });
		return { status: true, accesslink };
	} catch (error) {
		logger.error('LMSFS tmpAssemble: failed', { tempId, error });
		return { status: false, accesslink: '' };
	}
}

async function lmsTmpClean(tempId: string): Promise<LMSFSTmpCleanResult> {
	const tmpDir = resolveTmpDir(tempId);
	try {
		await fs.rm(tmpDir, { recursive: true, force: true });
		logger.debug('LMSFS tmpClean: removed', { tempId });
		return { status: true };
	} catch (error) {
		logger.error('LMSFS tmpClean: failed', { tempId, error });
		return { status: false };
	}
}

// Init & health

async function lmsInit(): Promise<LMSFSInitResult> {
	const initialized: LMSFSCategory[] = [];
	const failed: LMSFSCategory[] = [];

	try {
		await fs.mkdir(env.location, { recursive: true });
		await fs.mkdir(path.join(env.location, TMP_SUBDIR), { recursive: true });
		await fs.mkdir(path.join(env.location, TMP_SUBDIR, '_assembled'), { recursive: true });
	} catch (error) {
		logger.error('LMSFS init: failed to create base directory', { base: env.location, error });
		return { status: false, initialized, failed: Array.from(LMSFS_CATEGORIES) };
	}

	await Promise.all(
		Array.from(LMSFS_CATEGORIES).map(async (category) => {
			try {
				await fs.mkdir(path.join(env.location, category), { recursive: true });
				initialized.push(category);
				logger.debug('LMSFS category directory ready', { category });
			} catch (error) {
				failed.push(category);
				logger.error('LMSFS init: failed to create category directory', { category, error });
			}
		})
	);

	const status = failed.length === 0;
	logger.debug('LMSFS initialized', { initialized, failed });
	return { status, initialized, failed };
}

async function lmsHealthCheck(): Promise<boolean> {
	try {
		await fs.access(env.location, fs.constants.R_OK | fs.constants.W_OK);

		const checks = await Promise.all([
			// Check all category dirs
			...Array.from(LMSFS_CATEGORIES).map(async (category) => {
				try {
					await fs.access(
						path.join(env.location, category),
						fs.constants.R_OK | fs.constants.W_OK
					);
					return true;
				} catch {
					logger.error('LMSFS health check: category inaccessible', { category });
					return false;
				}
			}),
			// Check tmp dir
			fs.access(
				path.join(env.location, TMP_SUBDIR),
				fs.constants.R_OK | fs.constants.W_OK
			).then(() => true).catch(() => {
				logger.error('LMSFS health check: tmp directory inaccessible');
				return false;
			}),
		]);

		const status = checks.every(Boolean);
		if (status) logger.debug('LMSFS health check passed');
		return status;
	} catch (error) {
		logger.error('LMSFS health check: base directory inaccessible', { error });
		return false;
	}
}

export const lmsfs = {
	init: lmsInit,
	healthCheck: lmsHealthCheck,
	new: lmsNew,
	get: lmsGet,
	delete: lmsDelete,
	exists: lmsExists,
	getCategories,
	tmpWrite: lmsTmpWrite,
	tmpAssemble: lmsTmpAssemble,
	tmpClean: lmsTmpClean,
};
