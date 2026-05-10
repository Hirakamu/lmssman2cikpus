import sharp from 'sharp';
import { createHash } from 'crypto';

export interface ProcessedImage {
	buffer: Buffer;
	hash: string;
	ext: 'webp';
	size: number;
	mimetype: 'image/webp';
}

/**
 * Strip EXIF, convert to WebP, return buffer + hash
 * Hash is computed AFTER conversion for proper dedup
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
	const buffer = await sharp(input)
		.rotate() // auto-rotate based on EXIF orientation before stripping
		.withMetadata({}) // strip all EXIF/metadata
		.webp({ quality: 85 })
		.toBuffer();

	const hash = createHash('sha256').update(buffer).digest('hex');

	return {
		buffer,
		hash,
		ext: 'webp',
		size: buffer.length,
		mimetype: 'image/webp',
	};
}

/**
 * Hash a document buffer (no conversion)
 */
export function hashDocument(buffer: Buffer): string {
	return createHash('sha256').update(buffer).digest('hex');
}

export const IMAGE_MIMETYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/tiff',
	'image/bmp',
	'image/heic',
	'image/heif',
]);

export function isImage(mimetype: string): boolean {
	return IMAGE_MIMETYPES.has(mimetype);
}
