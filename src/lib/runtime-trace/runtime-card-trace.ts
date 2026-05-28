import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import {
	AGENT_RUN_EVENT_SCHEMA_VERSION,
	AGENT_RUN_MANIFEST_SCHEMA_VERSION,
	appendCanonicalEvent,
	writeCanonicalManifest,
	type AgentRunArtifactRef,
	type AgentRunEvent,
	type ExitClassification,
	type RunEventSeverity,
	type RunEventStatus,
	type RunEventType,
	type RunOutcome,
} from "../contract/run-records.js";
import type { RuntimeCard } from "../runtime/runtime-card.js";

const CANONICAL_TRACE_PARTS = ["artifacts", "agent-runs"] as const;
const EVENTS_FILE = "events.jsonl";
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const HASH_INPUT = "runtime-card-trace-out/v1";

/** Parsed canonical trace-out target for runtime-card run records. */
export interface RuntimeCardTraceTarget {
	runId: string;
	baseDir: "artifacts/agent-runs";
	eventsPath: string;
}

/** Descriptor for a runtime-card trace event before hash-chain persistence. */
export interface RuntimeCardTraceEventInput {
	eventId: string;
	eventType: RunEventType;
	status: RunEventStatus;
	severity: RunEventSeverity;
	payload: Record<string, unknown>;
	correlationId?: string;
}

/** Configuration for a runtime-card trace recorder. */
export interface RuntimeCardTraceRecorderOptions {
	repoRoot: string;
	target: RuntimeCardTraceTarget;
	context: string;
	live: boolean;
	issueKey?: string;
	evidencePath?: string;
	phaseExitPath?: string;
	now?: () => Date;
}

/** Inputs for terminal manifest emission after runtime-card finishes. */
export interface RuntimeCardTraceTerminalOptions {
	exitCode: number;
	outcome: RunOutcome;
	classification: ExitClassification;
	card?: RuntimeCard;
	failureMessage?: string;
}

/** Runtime-card trace recorder backed by canonical agent-run records. */
export interface RuntimeCardTraceRecorder {
	recordEvent(input: RuntimeCardTraceEventInput): void;
	recordStart(): void;
	recordInputs(): void;
	recordAdvisoryMode(): void;
	recordArtifactWrite(type: string, artifactPath: string): void;
	recordTerminal(options: RuntimeCardTraceTerminalOptions): void;
}

function hashText(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function checksumFileIfPresent(path: string): string {
	if (!existsSync(path)) return hashText(`missing:${path}`);
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeTracePath(path: string): string {
	return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isPathTraversal(path: string): boolean {
	return path.split("/").some((part) => part === "..");
}

/** Parse and validate a runtime-card --trace-out value. */
export function parseRuntimeCardTraceOutPath(
	traceOutPath: string,
): RuntimeCardTraceTarget | null {
	if (isAbsolute(traceOutPath)) return null;
	const normalized = normalizeTracePath(traceOutPath);
	if (isPathTraversal(normalized)) return null;
	const parts = normalized.split("/");
	if (parts.length !== 4) return null;
	if (
		parts[0] !== CANONICAL_TRACE_PARTS[0] ||
		parts[1] !== CANONICAL_TRACE_PARTS[1] ||
		parts[3] !== EVENTS_FILE
	) {
		return null;
	}
	const runId = parts[2] ?? "";
	if (!RUN_ID_PATTERN.test(runId)) return null;
	return {
		runId,
		baseDir: "artifacts/agent-runs",
		eventsPath: normalized,
	};
}

function repoRelativePath(repoRoot: string, path: string): string {
	const rel = relative(repoRoot, path);
	return rel.length > 0 ? rel : path;
}

function canonicalArtifactPath(artifactPath: string): string {
	return existsSync(artifactPath) ? realpathSync(artifactPath) : artifactPath;
}

function artifactRef(
	repoRoot: string,
	type: string,
	artifactPath: string,
): AgentRunArtifactRef {
	const canonicalPath = canonicalArtifactPath(artifactPath);
	return {
		type,
		path: repoRelativePath(repoRoot, canonicalPath),
		checksum: checksumFileIfPresent(canonicalPath),
	};
}

interface RuntimeCardTraceState {
	repoRoot: string;
	target: RuntimeCardTraceTarget;
	context: string;
	live: boolean;
	issueKey: string | undefined;
	evidencePath: string | undefined;
	phaseExitPath: string | undefined;
	startedAt: Date;
	correlationId: string;
	artifacts: AgentRunArtifactRef[];
	clock: () => Date;
	contractHash: string;
}

function createTraceState(
	options: RuntimeCardTraceRecorderOptions,
): RuntimeCardTraceState {
	const repoRoot = realpathSync(options.repoRoot);
	claimFreshTraceTarget(repoRoot, options.target);
	return {
		repoRoot,
		target: options.target,
		context: options.context,
		live: options.live,
		issueKey: options.issueKey,
		evidencePath: options.evidencePath,
		phaseExitPath: options.phaseExitPath,
		startedAt: options.now?.() ?? new Date(),
		correlationId: `runtime-card-${randomUUID()}`,
		artifacts: [],
		clock: options.now ?? (() => new Date()),
		contractHash: hashText(HASH_INPUT),
	};
}

function claimFreshTraceTarget(
	repoRoot: string,
	target: RuntimeCardTraceTarget,
): void {
	mkdirSync(join(repoRoot, target.baseDir), { recursive: true });
	try {
		mkdirSync(join(repoRoot, target.baseDir, target.runId));
	} catch {
		throw new Error(
			"--trace-out runId already exists; choose a fresh artifacts/agent-runs/<runId>/events.jsonl path",
		);
	}
}

function traceEvent(
	state: RuntimeCardTraceState,
	input: RuntimeCardTraceEventInput,
): AgentRunEvent {
	return {
		schemaVersion: AGENT_RUN_EVENT_SCHEMA_VERSION,
		runId: state.target.runId,
		eventId: `${input.eventId}-${randomUUID()}`,
		timestamp: state.clock().toISOString(),
		eventType: input.eventType,
		status: input.status,
		severity: input.severity,
		payload: input.payload,
		correlationId: input.correlationId ?? state.correlationId,
	};
}

function appendTraceEvent(
	state: RuntimeCardTraceState,
	input: RuntimeCardTraceEventInput,
): void {
	appendCanonicalEvent({
		cwd: state.repoRoot,
		baseDir: state.target.baseDir,
		event: traceEvent(state, input),
	});
}

function recordStartEvent(state: RuntimeCardTraceState): void {
	appendTraceEvent(state, {
		eventId: "runtime-card-start",
		eventType: "phase",
		status: "started",
		severity: "info",
		payload: {
			command: "runtime-card",
			context: state.context,
			live: state.live,
			issueKey: state.issueKey ?? null,
		},
	});
}

function recordInputsEvent(state: RuntimeCardTraceState): void {
	appendTraceEvent(state, {
		eventId: "runtime-card-inputs",
		eventType: "precondition",
		status: "passed",
		severity: "info",
		payload: {
			evidencePath: state.evidencePath ?? null,
			phaseExitPath: state.phaseExitPath ?? null,
			traceOutPath: state.target.eventsPath,
		},
	});
}

function recordAdvisoryModeEvent(state: RuntimeCardTraceState): void {
	if (state.live) return;
	appendTraceEvent(state, {
		eventId: "runtime-card-advisory-mode",
		eventType: "degraded_mode",
		status: "passed",
		severity: "warn",
		payload: {
			reason: "live_external_state_not_requested",
			claimSupport: "orientation_or_audit_trail_only",
		},
	});
}

function recordArtifactWriteEvent(
	state: RuntimeCardTraceState,
	type: string,
	artifactPath: string,
): void {
	const ref = artifactRef(state.repoRoot, type, artifactPath);
	state.artifacts.push(ref);
	appendTraceEvent(state, {
		eventId: `runtime-card-artifact-${type}`,
		eventType: "artifact_write",
		status: "passed",
		severity: "info",
		payload: {
			artifactType: ref.type,
			artifactPath: ref.path,
			artifactChecksum: ref.checksum,
		},
	});
}

function recordTerminalEvents(
	state: RuntimeCardTraceState,
	terminal: RuntimeCardTraceTerminalOptions,
): void {
	if (terminal.exitCode === 0) {
		appendTraceEvent(state, {
			eventId: "runtime-card-completed",
			eventType: "phase",
			status: "completed",
			severity: "info",
			payload: {
				exitCode: terminal.exitCode,
				stopReason: null,
				lifecycle: terminal.card?.lifecycle ?? "unknown",
				nextSafeAction: terminal.card?.nextSafeAction ?? null,
			},
		});
		return;
	}
	appendTraceEvent(state, {
		eventId: "runtime-card-error",
		eventType: "error",
		status: "failed",
		severity: "error",
		payload: {
			exitCode: terminal.exitCode,
			failureMessage: terminal.failureMessage ?? "runtime-card failed",
		},
	});
	appendTraceEvent(state, {
		eventId: "runtime-card-failed",
		eventType: "phase",
		status: "failed",
		severity: "error",
		payload: {
			exitCode: terminal.exitCode,
			stopReason: terminal.failureMessage ?? "runtime-card failed",
		},
	});
}

function writeTraceManifest(
	state: RuntimeCardTraceState,
	terminal: RuntimeCardTraceTerminalOptions,
): void {
	const finishedAt = state.clock();
	writeCanonicalManifest({
		cwd: state.repoRoot,
		baseDir: state.target.baseDir,
		manifest: {
			schemaVersion: AGENT_RUN_MANIFEST_SCHEMA_VERSION,
			runId: state.target.runId,
			command: "runtime-card",
			startedAt: state.startedAt.toISOString(),
			finishedAt: finishedAt.toISOString(),
			durationMs: Math.max(0, finishedAt.getTime() - state.startedAt.getTime()),
			repo: {
				repository: "unknown/unknown",
				branch: terminal.card?.branch.name ?? "unknown",
				headSha: terminal.card?.branch.ref ?? "unknown",
			},
			contract: {
				path: "runtime-card --trace-out",
				hash: state.contractHash,
				version: "runtime-card-trace-out/v1",
			},
			policyContext: {
				mode: "advisory",
				safetyPosture: "strict",
				effectivePolicySource: "runtime-card --trace-out",
			},
			outcome: terminal.outcome,
			exit: {
				code: terminal.exitCode,
				classification: terminal.classification,
			},
			artifactRefs: state.artifacts,
			preconditions: {
				context: state.context,
				live: state.live,
				evidenceProvided: state.evidencePath !== undefined,
				phaseExitProvided: state.phaseExitPath !== undefined,
			},
			provenance: {
				repoContractHash: state.contractHash,
				processPolicyHash: state.contractHash,
			},
		},
	});
}

function recordTerminalEvent(
	state: RuntimeCardTraceState,
	terminal: RuntimeCardTraceTerminalOptions,
): void {
	recordTerminalEvents(state, terminal);
	writeTraceManifest(state, terminal);
}

/** Create a runtime-card trace recorder that persists canonical run records. */
export function createRuntimeCardTraceRecorder(
	options: RuntimeCardTraceRecorderOptions,
): RuntimeCardTraceRecorder {
	const state = createTraceState(options);
	return {
		recordEvent: (input) => appendTraceEvent(state, input),
		recordStart: () => recordStartEvent(state),
		recordInputs: () => recordInputsEvent(state),
		recordAdvisoryMode: () => recordAdvisoryModeEvent(state),
		recordArtifactWrite: (type, artifactPath) =>
			recordArtifactWriteEvent(state, type, artifactPath),
		recordTerminal: (terminal) => recordTerminalEvent(state, terminal),
	};
}
