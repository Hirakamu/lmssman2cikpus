import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID, randomBytes } from 'crypto';
import { logger } from './logger.js';
import { env } from './env.js';

// Types

export type LMSCategory = string;

export interface LMSNewResult {
	status: boolean;
	uuid: string;
	accesslink: string;
}
export interface LMSGetResult {
	status: boolean;
	buffer: Buffer | null;
}
export interface LMSDeleteResult {
	status: boolean;
}
export interface LMSExistsResult {
	status: boolean;
}
export interface LMSInitResult {
	status: boolean;
	initialized: LMSCategory[];
	failed: LMSCategory[];
}
export interface LMSTmpWriteResult {
	status: boolean;
}
export interface LMSTmpAssembleResult {
	status: boolean;
	accesslink: string; // lms://temp/uuid.xxxx — ready to pass to lms.new()
}
export interface LMSTmpCleanResult {
	status: boolean;
}

// Source for lms.new() — direct buffer, or a lms://temp/... accesslink from tmpAssemble()
export type LMSNewSource =
	| { type: 'buffer'; data: Buffer }
	| { type: 'tmplink'; accesslink: string }; // lms://temp/uuid.xxxx

// Categories

const LMS_CATEGORIES = new Set<LMSCategory>([
	'student',
	'teacher',
	'other',
]);
const LMS_TMP_CATEGORY = 'temp';

export function getCategories(): LMSCategory[] {
	return Array.from(LMS_CATEGORIES);
}

// Paths

const LMS_PROTOCOL = 'lms://';
const TMP_SUBDIR = '.tmp';

function parseAccesslink(accesslink: string): { category: string; filename: string } | null {
	if (!accesslink.startsWith(LMS_PROTOCOL)) return null;
	const withoutProtocol = accesslink.slice(LMS_PROTOCOL.length);
	const slashIndex = withoutProtocol.indexOf('/');
	if (slashIndex === -1) return null;
	const category = withoutProtocol.slice(0, slashIndex);
	const filename = withoutProtocol.slice(slashIndex + 1);
	if (!category || !filename) return null;
	// Allow both permanent categories and temp
	if (!LMS_CATEGORIES.has(category) && category !== LMS_TMP_CATEGORY) return null;
	return { category, filename };
}
function resolvePath(category: string, filename: string): string {
	if (category === LMS_TMP_CATEGORY) {
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

async function lmsNew(category: LMSCategory, source: Buffer | LMSNewSource): Promise<LMSNewResult> {
	if (!LMS_CATEGORIES.has(category)) {
		logger.error('LMS new: unknown category', { category });
		return { status: false, uuid: '', accesslink: '' };
	}

	// Normalise: accept a raw Buffer directly (backwards-compatible)
	const normalisedSource: LMSNewSource =
		Buffer.isBuffer(source)
			? { type: 'buffer', data: source }
			: source;

	let buffer: Buffer;

	if (normalisedSource.type === 'buffer') {
		buffer = normalisedSource.data;
	} else {
		// Read directly from lms://temp/... path — no redundant assembly step
		const { accesslink } = normalisedSource;
		const parsed = parseAccesslink(accesslink);
		if (!parsed || parsed.category !== LMS_TMP_CATEGORY) {
			logger.error('LMS new: invalid tmplink accesslink', { accesslink });
			return { status: false, uuid: '', accesslink: '' };
		}
		const tmpFilePath = resolvePath(parsed.category, parsed.filename);
		try {
			buffer = await fs.readFile(tmpFilePath);
		} catch (error) {
			logger.error('LMS new: could not read tmplink file', { accesslink, error });
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

		const accesslink = `${LMS_PROTOCOL}${category}/${filename}`;
		logger.debug('LMS file stored', { category, filename, size: buffer.length });

		return { status: true, uuid, accesslink };
	} catch (error) {
		logger.error('LMS new: write failed', { category, filename, error });
		await fs.unlink(tmp).catch(() => {});
		return { status: false, uuid: '', accesslink: '' };
	}
}

async function lmsGet(accesslink: string): Promise<LMSGetResult> {
	const parsed = parseAccesslink(accesslink);
	if (!parsed) {
		logger.error('LMS get: invalid accesslink', { accesslink });
		return { status: false, buffer: null };
	}

	const { category, filename } = parsed;
	const filepath = resolvePath(category, filename);

	try {
		const buffer = await fs.readFile(filepath);
		logger.debug('LMS file read', { category, filename, size: buffer.length });
		return { status: true, buffer };
	} catch (error) {
		logger.error('LMS get: read failed', { category, filename, error });
		return { status: false, buffer: null };
	}
}

async function lmsDelete(accesslink: string): Promise<LMSDeleteResult> {
	const parsed = parseAccesslink(accesslink);
	if (!parsed) {
		logger.error('LMS delete: invalid accesslink', { accesslink });
		return { status: false };
	}

	const { category, filename } = parsed;
	const filepath = resolvePath(category, filename);

	try {
		await fs.unlink(filepath);
		logger.debug('LMS file deleted', { category, filename });
		return { status: true };
	} catch (error) {
		logger.error('LMS delete: failed', { category, filename, error });
		return { status: false };
	}
}

async function lmsExists(accesslink: string): Promise<LMSExistsResult> {
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

async function lmsTmpWrite(tempId: string, index: number, buffer: Buffer): Promise<LMSTmpWriteResult> {
	if (!tempId || index < 0) {
		logger.error('LMS tmpWrite: invalid arguments', { tempId, index });
		return { status: false };
	}

	const tmpDir = resolveTmpDir(tempId);
	const chunkPath = resolveChunkPath(tempId, index);

	try {
		await fs.mkdir(tmpDir, { recursive: true });
		await fs.writeFile(chunkPath, buffer);
		logger.debug('LMS chunk written', { tempId, index, size: buffer.length });
		return { status: true };
	} catch (error) {
		logger.error('LMS tmpWrite: write failed', { tempId, index, error });
		return { status: false };
	}
}

async function lmsTmpAssemble(tempId: string, totalChunks: number): Promise<LMSTmpAssembleResult> {
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
			logger.error('LMS tmpAssemble: missing chunks', { tempId, missingChunks });
			return { status: false, accesslink: '' };
		}

		// Write assembled file as a proper lms://temp entry
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

		const accesslink = `${LMS_PROTOCOL}${LMS_TMP_CATEGORY}/${filename}`;
		logger.debug('LMS tmpAssemble: complete', { tempId, totalChunks, accesslink });
		return { status: true, accesslink };
	} catch (error) {
		logger.error('LMS tmpAssemble: failed', { tempId, error });
		return { status: false, accesslink: '' };
	}
}

async function lmsTmpClean(tempId: string): Promise<LMSTmpCleanResult> {
	const tmpDir = resolveTmpDir(tempId);
	try {
		await fs.rm(tmpDir, { recursive: true, force: true });
		logger.debug('LMS tmpClean: removed', { tempId });
		return { status: true };
	} catch (error) {
		logger.error('LMS tmpClean: failed', { tempId, error });
		return { status: false };
	}
}

// Init & health

async function lmsInit(): Promise<LMSInitResult> {
	const initialized: LMSCategory[] = [];
	const failed: LMSCategory[] = [];

	try {
		await fs.mkdir(env.location, { recursive: true });
		await fs.mkdir(path.join(env.location, TMP_SUBDIR), { recursive: true });
		await fs.mkdir(path.join(env.location, TMP_SUBDIR, '_assembled'), { recursive: true });
	} catch (error) {
		logger.error('LMS init: failed to create base directory', { base: env.location, error });
		return { status: false, initialized, failed: Array.from(LMS_CATEGORIES) };
	}

	await Promise.all(
		Array.from(LMS_CATEGORIES).map(async (category) => {
			try {
				await fs.mkdir(path.join(env.location, category), { recursive: true });
				initialized.push(category);
				logger.debug('LMS category directory ready', { category });
			} catch (error) {
				failed.push(category);
				logger.error('LMS init: failed to create category directory', { category, error });
			}
		})
	);

	const status = failed.length === 0;
	logger.debug('LMS initialized', { initialized, failed });
	return { status, initialized, failed };
}

async function lmsHealthCheck(): Promise<boolean> {
	try {
		await fs.access(env.location, fs.constants.R_OK | fs.constants.W_OK);

		const checks = await Promise.all([
			// Check all category dirs
			...Array.from(LMS_CATEGORIES).map(async (category) => {
				try {
					await fs.access(
						path.join(env.location, category),
						fs.constants.R_OK | fs.constants.W_OK
					);
					return true;
				} catch {
					logger.error('LMS health check: category inaccessible', { category });
					return false;
				}
			}),
			// Check tmp dir
			fs.access(
				path.join(env.location, TMP_SUBDIR),
				fs.constants.R_OK | fs.constants.W_OK
			).then(() => true).catch(() => {
				logger.error('LMS health check: tmp directory inaccessible');
				return false;
			}),
		]);

		const status = checks.every(Boolean);
		if (status) logger.debug('LMS health check passed');
		return status;
	} catch (error) {
		logger.error('LMS health check: base directory inaccessible', { error });
		return false;
	}
}

export const lms = {
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
