/**
 * Production-ready logging utility
 * In production, logs should be sent to a logging service
 * In development, logs to console
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	context?: Record<string, any>;
	error?: Error;
}

class Logger {
	private isProduction = process.env.NODE_ENV === 'production';
	private isDevelopment = process.env.NODE_ENV === 'development';

	private formatMessage(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
		return {
			level,
			message,
			timestamp: new Date().toISOString(),
			context,
			error: error ? {
				name: error.name,
				message: error.message,
				stack: error.stack,
			} as any : undefined,
		};
	}

	private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
		const entry = this.formatMessage(level, message, context, error);

		// In production, send to logging service (Sentry, LogRocket, etc.)
		if (this.isProduction) {
			// TODO: Integrate with logging service
			// Example: Sentry.captureMessage(message, { level, extra: context });
			
			// For now, only log errors in production
			if (level === 'error') {
				console.error(`[${entry.timestamp}] ${level.toUpperCase()}: ${message}`, context || '', error || '');
			}
		} else {
			// In development, log to console with colors
			const colors = {
				debug: '\x1b[36m', // Cyan
				info: '\x1b[32m',  // Green
				warn: '\x1b[33m',  // Yellow
				error: '\x1b[31m', // Red
				reset: '\x1b[0m',
			};

			const color = colors[level] || colors.reset;
			const prefix = `${color}[${level.toUpperCase()}]${colors.reset}`;
			
			if (error) {
				console.error(`${prefix} ${message}`, context || '', error);
			} else if (context) {
				console.log(`${prefix} ${message}`, context);
			} else {
				console.log(`${prefix} ${message}`);
			}
		}
	}

	debug(message: string, context?: Record<string, any>) {
		if (this.isDevelopment) {
			this.log('debug', message, context);
		}
	}

	info(message: string, context?: Record<string, any>) {
		this.log('info', message, context);
	}

	warn(message: string, context?: Record<string, any>) {
		this.log('warn', message, context);
	}

	error(message: string, error?: Error, context?: Record<string, any>) {
		this.log('error', message, context, error);
	}
}

export const logger = new Logger();

