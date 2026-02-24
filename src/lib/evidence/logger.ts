/**
 * Structured logging for evidence verification operations.
 * Emits JSON logs with optional OTLP export.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
	/** ISO 8601 timestamp */
	timestamp: string;
	/** Log level */
	level: LogLevel;
	/** Log message */
	message: string;
	/** Additional context fields */
	[key: string]: unknown;
}

export interface LoggerOptions {
	/** Minimum log level to emit (default: 'info') */
	minLevel?: LogLevel | undefined;
	/** OTLP endpoint URL for log export (optional) */
	otelEndpoint?: string | undefined;
	/** Service name for OTLP metadata */
	serviceName?: string | undefined;
	/** Output stream (default: console) */
	output?: { write: (str: string) => void } | undefined;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

/**
 * Default console output writer.
 */
function createConsoleWriter(): { write: (str: string) => void } {
	return {
		write: (str: string) => {
			// Use console.info for structured log output (intentional logging, not debugging)
			console.info(str);
		},
	};
}

/**
 * Structured logger with JSON output and optional OTLP export.
 */
export class StructuredLogger {
	private minLevel: LogLevel;
	private otelEndpoint: string | undefined;
	private serviceName: string;
	private output: { write: (str: string) => void };

	constructor(options: LoggerOptions = {}) {
		this.minLevel = options.minLevel ?? "info";
		this.otelEndpoint =
			options.otelEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
		this.serviceName = options.serviceName ?? "coding-harness";
		this.output = options.output ?? createConsoleWriter();
	}

	/**
	 * Check if a log level should be emitted.
	 */
	private shouldEmit(level: LogLevel): boolean {
		return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
	}

	/**
	 * Format a log entry as JSON.
	 */
	private formatEntry(entry: LogEntry): string {
		return JSON.stringify(entry);
	}

	/**
	 * Write a log entry.
	 */
	private write(
		level: LogLevel,
		message: string,
		context?: Record<string, unknown>,
	): void {
		if (!this.shouldEmit(level)) {
			return;
		}

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			...context,
		};

		const json = this.formatEntry(entry);
		this.output.write(`${json}\n`);

		// Fire-and-forget OTLP export (non-blocking)
		if (this.otelEndpoint) {
			this.exportToOtel(entry).catch(() => {
				// Silently ignore OTLP errors (fire-and-forget)
			});
		}
	}

	/**
	 * Export log entry to OTLP endpoint.
	 * Non-blocking fire-and-forget.
	 */
	private async exportToOtel(entry: LogEntry): Promise<void> {
		if (!this.otelEndpoint) return;

		try {
			const body = JSON.stringify({
				resourceLogs: [
					{
						resource: {
							attributes: [
								{
									key: "service.name",
									value: { stringValue: this.serviceName },
								},
							],
						},
						scopeLogs: [
							{
								scope: { name: "coding-harness" },
								logRecords: [
									{
										timeUnixNano: String(Date.now() * 1_000_000),
										severityNumber: LOG_LEVEL_PRIORITY[entry.level] + 1,
										severityText: entry.level.toUpperCase(),
										body: { stringValue: entry.message },
										attributes: Object.entries(entry)
											.filter(
												([k]) =>
													k !== "timestamp" && k !== "level" && k !== "message",
											)
											.map(([key, value]) => ({
												key,
												value:
													typeof value === "string"
														? { stringValue: value }
														: typeof value === "number"
															? { intValue: value }
															: { stringValue: JSON.stringify(value) },
											})),
									},
								],
							},
						],
					},
				],
			});

			await fetch(this.otelEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body,
			});
		} catch {
			// Silently ignore OTLP errors
		}
	}

	/**
	 * Log a debug message.
	 */
	debug(message: string, context?: Record<string, unknown>): void {
		this.write("debug", message, context);
	}

	/**
	 * Log an info message.
	 */
	info(message: string, context?: Record<string, unknown>): void {
		this.write("info", message, context);
	}

	/**
	 * Log a warning message.
	 */
	warn(message: string, context?: Record<string, unknown>): void {
		this.write("warn", message, context);
	}

	/**
	 * Log an error message.
	 */
	error(message: string, context?: Record<string, unknown>): void {
		this.write("error", message, context);
	}

	/**
	 * Create a child logger with additional context.
	 */
	child(defaultContext: Record<string, unknown>): ChildLogger {
		return new ChildLogger(this, defaultContext);
	}
}

/**
 * Child logger with additional default context.
 */
export class ChildLogger {
	private parent: StructuredLogger;
	private defaultContext: Record<string, unknown>;

	constructor(
		parent: StructuredLogger,
		defaultContext: Record<string, unknown>,
	) {
		this.parent = parent;
		this.defaultContext = defaultContext;
	}

	private merge(
		context?: Record<string, unknown>,
	): Record<string, unknown> | undefined {
		if (!context) return this.defaultContext;
		return { ...this.defaultContext, ...context };
	}

	debug(message: string, context?: Record<string, unknown>): void {
		this.parent.debug(message, this.merge(context));
	}

	info(message: string, context?: Record<string, unknown>): void {
		this.parent.info(message, this.merge(context));
	}

	warn(message: string, context?: Record<string, unknown>): void {
		this.parent.warn(message, this.merge(context));
	}

	error(message: string, context?: Record<string, unknown>): void {
		this.parent.error(message, this.merge(context));
	}
}

/**
 * Default logger instance.
 */
export const logger = new StructuredLogger();
