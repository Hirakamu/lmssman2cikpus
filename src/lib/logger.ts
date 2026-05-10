import { env } from './env.js';
type LogArgs = unknown[];
type LogLevel = 'production' | 'error' | 'warn' | 'info' | 'debug';

const levelPriority: Record<LogLevel, number> = {
	production: -1,
	error: 0,
	warn: 1,
	info: 2,
	debug: 3
};

const shouldLog = (level: LogLevel) => levelPriority[level] <= levelPriority[env.LOG_LEVEL as LogLevel];

const useAnsiColors = process.platform !== 'win32' || Boolean(process.env.WT_SESSION) || process.env.TERM_PROGRAM === 'vscode';

const color = {
	cyan: useAnsiColors ? '\x1b[36m' : '',
	green: useAnsiColors ? '\x1b[32m' : '',
	yellow: useAnsiColors ? '\x1b[33m' : '',
	red: useAnsiColors ? '\x1b[31m' : '',
	reset: useAnsiColors ? '\x1b[0m' : ''
};

const tag = (label: string, tone: string) => `${tone}[${label}]${color.reset}`;

export const logger = {
	level: env.LOG_LEVEL,
	debug: (...args: LogArgs) => shouldLog('debug') && console.log(tag('DEBUG', color.cyan), ...args),
	info: (...args: LogArgs) => shouldLog('info') && console.log(tag('INFO', color.green), ...args),
	warn: (...args: LogArgs) => shouldLog('warn') && console.warn(tag('WARN', color.yellow), ...args),
	error: (...args: LogArgs) => shouldLog('error') && console.error(tag('ERROR', color.red), ...args)
};
