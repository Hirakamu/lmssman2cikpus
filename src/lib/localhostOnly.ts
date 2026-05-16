import type { NextFunction, Request, Response } from 'express';

import { ApiError } from './routeHandler.js';

const LOCALHOST_IPS = new Set([
	'127.0.0.1',
	'::1',
	'::ffff:127.0.0.1',
	'192.168.18.198',
	'192.168.18.161'
]);

export const localhostOnly = (
	req: Request,
	_res: Response,
	next: NextFunction
) => {
	const rawForwardedFor = req.headers['x-forwarded-for'];
	const forwardedFor = Array.isArray(rawForwardedFor)
		? rawForwardedFor[0]
		: rawForwardedFor;
	const forwardedIp = forwardedFor?.split(',')[0]?.trim();
	const remoteIp = req.ip || req.socket.remoteAddress;

	if (forwardedIp && !LOCALHOST_IPS.has(forwardedIp)) {
		return next(new ApiError(403, 'Localhost access only (invalid x-forwarded-for)'));
	}

	if (!remoteIp || !LOCALHOST_IPS.has(remoteIp)) {
		return next(new ApiError(403, 'Localhost access only (invalid remote address)'));
	}

	return next();
};