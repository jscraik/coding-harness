/**
 * CLI options for `harness replay`.
 */
export interface ReplayOptions {
	/** Trace ID to replay. */
	traceId?: string;
	/** List available traces. */
	list?: boolean;
	/** Dry run - do not execute, just show what would happen. */
	dryRun?: boolean;
	/** Output as JSON. */
	json?: boolean;
	/** Base directory for trace storage. */
	traceDir?: string;
	/** Optional override for canonical run-record base dir. */
	runRecordsDir?: string;
}

/** Resolved replay trace storage configuration. */
export interface ReplayTraceConfig {
	/** Base directory for trace storage. */
	baseDir: string;
	/** Maximum traces to keep in the resolved trace store. */
	maxTraces: number;
}

/** Structured replay trace resolution failure. */
export interface ReplayTraceResolutionFailure {
	/** Stable failure code for JSON output and run-record metadata. */
	code: string;
	/** Human-readable failure message. */
	message: string;
	/** Optional operator hint for plain-text output. */
	hint?: string;
}
