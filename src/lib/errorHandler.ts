import type { NextFunction, Request, Response } from 'express';

import { logger } from './logger.js';
import { ApiError } from './apiError.js';

export const errorHandler = (
	err: any,
	_req: Request,
	res: Response,
	_next: NextFunction
) => {

	if (err instanceof ApiError) {
		return res.status(err.statusCode).json({ message: err.message });
	}

	if (err?.code) {
		return res.status(500).json({
			message: err.message,
			code: err.code
		});
	}

	logger.error('Unhandled error', err);

	return res.status(500).json({
		message: 'Internal server error'
	});
};