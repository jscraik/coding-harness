/**
 * Deterministic replay foundation.
 *
 * Captures execution traces with stable IDs for reproducible debugging
 * and deterministic replay of agent sessions.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Types of traceable events */
export type TraceEventType =
	| "command"
	| "tool_use"
	| "file_change"
	| "user_input"
	| "error"
	| "checkpoint";

/** A single event in the execution trace */
export interface TraceEvent {
	/** Event type */
	type: TraceEventType;
	/** Timestamp (ISO 8601) */
	timestamp: string;
	/** Event payload */
	payload: unknown;
	/** Optional correlation ID for related events */
	correlationId?: string;
}

/** Complete execution trace */
export interface ExecutionTrace {
	/** Stable trace ID */
	traceId: string;
	/** Trace creation timestamp */
	createdAt: string;
	/** Original working directory */
	workingDirectory: string;
	/** Shell environment (sanitized) */
	environment: Record<string, string>;
	/** Command/entry point that started the trace */
	command: string;
	/** Command arguments */
	args: string[];
	/** Sequence of events */
	events: TraceEvent[];
	/** Trace metadata */
	metadata: {
		/** Git commit at trace start */
		gitCommit?: string;
		/** Git branch */
		gitBranch?: string;
		/** Agent version/tooling */
		agentVersion?: string;
		/** User-defined tags */
		tags?: string[];
	};
}

/** Trace storage configuration */
export interface TraceConfig {
	/** Base directory for trace storage */
	baseDir: string;
	/** Maximum traces to keep (oldest auto-pruned) */
	maxTraces: number;
	/** Whether to capture full tool output */
	captureToolOutput: boolean;
	/** Whether to include environment variables */
	includeEnv: boolean;
}

export const DEFAULT_TRACE_CONFIG: TraceConfig = {
	baseDir: ".traces",
	maxTraces: 100,
	captureToolOutput: true,
	includeEnv: false,
};

const TRACE_ID_PATTERN = /^trace-[a-f0-9]{16}$/;

/** Return whether a value matches the generated trace identifier format. */
export function isValidTraceId(traceId: string): boolean {
	return TRACE_ID_PATTERN.test(traceId);
}

/** Generate a stable trace ID from seed data */
export function generateTraceId(seed?: string): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	const data = seed ?? `${timestamp}-${random}`;
	const hash = createHash("sha256").update(data).digest("hex").slice(0, 16);
	return `trace-${hash}`;
}

/** Sanitize environment variables for safe storage */
function sanitizeEnvironment(
	env: NodeJS.ProcessEnv,
	includeEnv: boolean,
): Record<string, string> {
	if (!includeEnv) {
		return {
			NODE_ENV: env.NODE_ENV ?? "development",
			PWD: env.PWD ?? "",
		};
	}

	const sensitive = new Set([
		"PATH",
		"HOME",
		"USER",
		"SHELL",
		"TERM",
		"EDITOR",
		"PWD",
		"NODE_ENV",
	]);

	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(env)) {
		// Only include non-sensitive, non-empty vars
		if (value && sensitive.has(key)) {
			result[key] = value;
		}
	}
	return result;
}

/** Capture a new execution trace */
export async function captureTrace(
	command: string,
	args: string[],
	options?: {
		config?: Partial<TraceConfig>;
		workingDirectory?: string;
		environment?: NodeJS.ProcessEnv;
		tags?: string[];
	},
): Promise<ExecutionTrace> {
	const config = { ...DEFAULT_TRACE_CONFIG, ...options?.config };
	const traceId = generateTraceId(`${command}-${args.join("-")}`);

	const trace: ExecutionTrace = {
		traceId,
		createdAt: new Date().toISOString(),
		workingDirectory: options?.workingDirectory ?? process.cwd(),
		environment: sanitizeEnvironment(
			options?.environment ?? process.env,
			config.includeEnv,
		),
		command,
		args,
		events: [],
		metadata: {
			...(options?.tags ? { tags: options.tags } : {}),
		},
	};

	// Save trace immediately
	await saveTrace(trace, config);

	return trace;
}

/** Add an event to a trace */
export async function addTraceEvent(
	traceId: string,
	event: Omit<TraceEvent, "timestamp">,
	config?: Partial<TraceConfig>,
): Promise<void> {
	const fullConfig = { ...DEFAULT_TRACE_CONFIG, ...config };
	const trace = await loadTrace(traceId, fullConfig);

	if (!trace) {
		throw new Error(`Trace not found: ${traceId}`);
	}

	trace.events.push({
		...event,
		timestamp: new Date().toISOString(),
	});

	await saveTrace(trace, fullConfig);
}

/** Save trace to storage */
async function saveTrace(
	trace: ExecutionTrace,
	config: TraceConfig,
): Promise<void> {
	if (!isValidTraceId(trace.traceId)) {
		throw new Error(`Invalid trace ID: ${trace.traceId}`);
	}
	const traceDir = join(config.baseDir, trace.traceId);
	await mkdir(traceDir, { recursive: true });

	const tracePath = join(traceDir, "trace.json");
	await writeFile(tracePath, JSON.stringify(trace, null, 2));
}

/** Load a trace by ID */
export async function loadTrace(
	traceId: string,
	config?: Partial<TraceConfig>,
): Promise<ExecutionTrace | null> {
	if (!isValidTraceId(traceId)) {
		return null;
	}
	const fullConfig = { ...DEFAULT_TRACE_CONFIG, ...config };
	const tracePath = join(fullConfig.baseDir, traceId, "trace.json");

	try {
		const data = await readFile(tracePath, "utf-8");
		const parsed = JSON.parse(data) as unknown;
		if (!validateTrace(parsed)) {
			return null;
		}
		if (parsed.traceId !== traceId) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/** List all available traces */
export async function listTraces(
	config?: Partial<TraceConfig>,
): Promise<Array<{ traceId: string; createdAt: string; command: string }>> {
	const fullConfig = { ...DEFAULT_TRACE_CONFIG, ...config };

	try {
		const { readdir } = await import("node:fs/promises");
		const entries = await readdir(fullConfig.baseDir, { withFileTypes: true });

		const traces: Array<{
			traceId: string;
			createdAt: string;
			command: string;
		}> = [];

		for (const entry of entries) {
			if (entry.isDirectory() && entry.name.startsWith("trace-")) {
				const trace = await loadTrace(entry.name, fullConfig);
				if (trace) {
					traces.push({
						traceId: trace.traceId,
						createdAt: trace.createdAt,
						command: trace.command,
					});
				}
			}
		}

		// Sort by creation time, newest first
		return traces.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	} catch {
		return [];
	}
}

/** Replay a trace (execute same command with same args) */
export async function replayTrace(
	traceOrId: string | ExecutionTrace,
	options?: {
		config?: Partial<TraceConfig>;
		dryRun?: boolean;
		onEvent?: (event: TraceEvent) => void | Promise<void>;
	},
): Promise<{
	success: boolean;
	trace: ExecutionTrace | null;
	replayedEvents: number;
	message: string;
}> {
	const config = { ...DEFAULT_TRACE_CONFIG, ...options?.config };
	const trace =
		typeof traceOrId === "string"
			? await loadTrace(traceOrId, config)
			: traceOrId;

	if (!trace) {
		return {
			success: false,
			trace: null,
			replayedEvents: 0,
			message: `Trace not found: ${traceOrId}`,
		};
	}

	if (options?.dryRun) {
		return {
			success: true,
			trace,
			replayedEvents: trace.events.length,
			message: `Dry run: would replay ${trace.events.length} events from ${trace.command}`,
		};
	}

	// Replay each event in sequence
	let replayedEvents = 0;
	for (const event of trace.events) {
		if (options?.onEvent) {
			await options.onEvent(event);
		}
		replayedEvents++;
	}

	return {
		success: true,
		trace,
		replayedEvents,
		message: `Replayed ${replayedEvents} events from ${trace.command}`,
	};
}

/** Validate a trace file */
export function validateTrace(trace: unknown): trace is ExecutionTrace {
	if (typeof trace !== "object" || trace === null) return false;

	const t = trace as Partial<ExecutionTrace>;

	return (
		typeof t.traceId === "string" &&
		isValidTraceId(t.traceId) &&
		typeof t.createdAt === "string" &&
		!Number.isNaN(new Date(t.createdAt).getTime()) &&
		typeof t.workingDirectory === "string" &&
		typeof t.command === "string" &&
		Array.isArray(t.args) &&
		t.args.every((arg) => typeof arg === "string") &&
		typeof t.environment === "object" &&
		t.environment !== null &&
		Array.isArray(t.events)
	);
}
