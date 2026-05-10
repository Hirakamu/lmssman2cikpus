import type { NextFunction, Request, Response } from 'express';

import { ApiError } from './apiError.js';
import type { JwtPayload, UserRole } from './jwtService.js';
import { jwtService } from './jwtService.js';

export type AuthenticatedRequest = Request & {
	user: JwtPayload;
};

export const authMiddleware = (allowedRoles?: UserRole[]) => {
	return (req: Request, _res: Response, next: NextFunction) => {
		const authHeader = req.headers.authorization;

		if (!authHeader?.startsWith('Bearer ')) {
			return next(new ApiError(401, 'Unauthorized'));
		}

		const token = authHeader.slice('Bearer '.length);

		try {
			const payload = jwtService.verify(token);
			if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
				return next(new ApiError(403, 'Forbidden'));
			}

			(req as AuthenticatedRequest).user = payload;
			return next();
		} catch {
			return next(new ApiError(401, 'Invalid token'));
		}
	};
};
