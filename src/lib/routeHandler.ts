import type { NextFunction, Request, Response, RequestHandler } from 'express';

import { logger } from './logger.js';

export class ApiResponse {
	statusCode: number;
	message: string;
	data: Record<string, any> | Array<any> | null;

	constructor(statusCode: number, message: string, data: Record<string, any> | Array<any> | null) {
		this.statusCode = statusCode;
		this.message = message;
		this.data = data;
	}
}

export class ApiError extends Error {
	public readonly statusCode: number;

	constructor(statusCode: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.statusCode = statusCode;
	}
}

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;
const isApiResponse = (val: unknown): val is ApiResponse => val instanceof ApiResponse;
const isApiError = (val: unknown): val is ApiError => val instanceof ApiError;

export const asyncHandler = (fn: AsyncRequestHandler) =>
	(req: Request, res: Response, next: NextFunction) =>
		Promise.resolve(fn(req, res, next)).catch(next);

export const responseHandler = (
	val: any,
	_req: Request,
	res: Response,
	_next: NextFunction
) => {
	if (isApiResponse(val)) {
		return res.status(val.statusCode).json({
			statusCode: val.statusCode,
			message: val.message,
			data: val.data,
		});
	}

	if (isApiError(val)) {
		return res.status(val.statusCode).json({
			statusCode: val.statusCode,
			message: val.message,
			data: null,
		});
	}

	// unknown — last resort
	logger.error('Unhandled error', val);
	return res.status(500).json({
		statusCode: 500,
		message: 'Internal server error',
		data: null,
	});
};