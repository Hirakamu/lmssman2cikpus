import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().int().positive().default(3000),
	DATABASE_URL: z.string().min(1),
	JWT_SECRET: z.string().min(8),
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'production']).default('production'),
	HOST: z.string().default('localhost'),
	VERSION: z.string().default('dev'),
	location: z.string().default('./LMS_FILES'),
});

export const env = schema.parse(process.env);
