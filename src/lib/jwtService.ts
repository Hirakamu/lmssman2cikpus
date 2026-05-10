import jwt from 'jsonwebtoken';

import { env } from './env.js';

export type UserRole = 'student' | 'teacher';

export type JwtPayload = {
	userId: string;
	role: UserRole;
	name?: string;
	email?: string;
	classId?: string;
};

export const jwtService = {
	sign(payload: JwtPayload) {
		return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1d' });
	},
	verify(token: string) {
		return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
	}
};
