import { createHash, randomUUID } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PathTraversalError, validatePath } from "../input/validator.js";

export const AGENT_RUN_MANIFEST_SCHEMA_VERSION = "agent-run-manifest/v1";
export const AGENT_RUN_EVENT_SCHEMA_VERSION = "agent-run-event/v1";

export const CANONICAL_RUN_RECORDS_DIR = "artifacts/agent-runs";
export const CANONICAL_MANIFEST_FILE = "manifest.json";
export const CANONICAL_EVENTS_FILE = "events.jsonl";

export const LEGACY_MANIFEST_FILE = "run-manifest.json";
export const LEGACY_EVENTS_FILE = "run-events.jsonl";

const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const SENSITIVE_KEY_PATTERN =
	/(token|secret|password|api[_-]?key|authorization|cookie)/i;

export type RunOutcome =
	| "success"
	| "hold"
	| "rollback"
	| "failed"
	| "blocked"
	| "canceled";

export type ExitClassification =
	| "ok"
	| "policy_blocked"
	| "validation_failed"
	| "precondition_failed"
	| "runtime_failed"
	| "rollback_required"
	| "manual_intervention_required"
	| "canceled";

export type RunEventType =
	| "phase"
	| "policy_check"
	| "precondition"
	| "artifact_write"
	| "decision"
	| "retry"
	| "timeout"
	| "cancel"
	| "error"
	| "rollback"
	| "intervention"
	| "degraded_mode";

export type RunEventStatus =
	| "started"
	| "passed"
	| "failed"
	| "skipped"
	| "blocked"
	| "completed";

export type RunEventSeverity = "info" | "warn" | "error" | "critical";

const MANIFEST_OUTCOMES = new Set<RunOutcome>([
	"success",
	"hold",
	"rollback",
	"failed",
	"blocked",
	"canceled",
]);

const EXIT_CLASSIFICATIONS = new Set<ExitClassification>([
	"ok",
	"policy_blocked",
	"validation_failed",
	"precondition_failed",
	"runtime_failed",
	"rollback_required",
	"manual_intervention_required",
	"canceled",
]);

const EVENT_TYPES = new Set<RunEventType>([
	"phase",
	"policy_check",
	"precondition",
	"artifact_write",
	"decision",
	"retry",
	"timeout",
	"cancel",
	"error",
	"rollback",
	"intervention",
	"degraded_mode",
]);

const EVENT_STATUSES = new Set<RunEventStatus>([
	"started",
	"passed",
	"failed",
	"skipped",
	"blocked",
	"completed",
]);

const EVENT_SEVERITIES = new Set<RunEventSeverity>([
	"info",
	"warn",
	"error",
	"critical",
]);

export interface AgentRunArtifactRef {
	type: string;
	path: string;
	checksum: string;
}

export interface AgentRunManifest {
	schemaVersion: typeof AGENT_RUN_MANIFEST_SCHEMA_VERSION;
	runId: string;
	command: string;
	scenarioId?: string;
	startedAt: string;
	finishedAt: string;
	durationMs: number;
	repo: {
		repository: string;
		branch: string;
		headSha: string;
		ancestryBaseSha?: string;
		ancestryVerified?: boolean;
	};
	contract: {
		path: string;
		hash: string;
		version?: string;
	};
	policyContext: {
		mode: string;
		safetyPosture: string;
		effectivePolicySource: string;
	};
	outcome: RunOutcome;
	exit: {
		code: number;
		classification: ExitClassification;
	};
	artifactRefs: AgentRunArtifactRef[];
	preconditions: Record<string, string | number | boolean | null>;
	provenance: {
		repoContractHash: string;
		processPolicyHash: string;
	};
}

export interface AgentRunEvent {
	schemaVersion: typeof AGENT_RUN_EVENT_SCHEMA_VERSION;
	runId: string;
	eventId: string;
	timestamp: string;
	eventType: RunEventType;
	status: RunEventStatus;
	severity: RunEventSeverity;
	payload: Record<string, unknown>;
	correlationId?: string;
	prevEventHash?: string;
	eventHash?: string;
}

export interface CanonicalRunRecordPaths {
	runDir: string;
	manifestPath: string;
	eventsPath: string;
	legacyManifestPath: string;
	legacyEventsPath: string;
}

export interface LoadedRunRecordBundle {
	manifest: AgentRunManifest;
	events: AgentRunEvent[];
	source: {
		manifestPath: string;
		eventsPath: string;
		usedLegacyManifest: boolean;
		usedLegacyEvents: boolean;
	};
}

export class RunRecordError extends Error {
	constructor(
		message: string,
		public readonly code:
			| "E_PATH"
			| "E_MANIFEST_INVALID"
			| "E_EVENT_INVALID"
			| "E_HASH_CHAIN"
			| "E_SENSITIVE_FIELDS"
			| "E_IO",
	) {
		super(message);
		this.name = "RunRecordError";
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureRunId(runId: string): void {
	if (!RUN_ID_PATTERN.test(runId)) {
		throw new RunRecordError(`Invalid runId: ${runId}`, "E_MANIFEST_INVALID");
	}
}

function ensureSha256(value: string, field: string): void {
	if (!SHA256_PATTERN.test(value)) {
		throw new RunRecordError(
			`Invalid sha256 value for ${field}`,
			"E_MANIFEST_INVALID",
		);
	}
}

function ensureIso(value: string, field: string): void {
	if (!ISO_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
		throw new RunRecordError(
			`Invalid ISO timestamp for ${field}`,
			"E_EVENT_INVALID",
		);
	}
}

function ensureWithinCwd(pathLike: string, cwd: string): string {
	try {
		return validatePath(cwd, pathLike);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			throw new RunRecordError(
				`Path escapes working directory: ${pathLike}`,
				"E_PATH",
			);
		}
		throw error;
	}
}

function canonicalizeValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalizeValue);
	}
	if (isObject(value)) {
		const sorted = Object.keys(value)
			.sort()
			.reduce<Record<string, unknown>>((acc, key) => {
				const nested = value[key];
				acc[key] = canonicalizeValue(nested);
				return acc;
			}, {});
		return sorted;
	}
	return value;
}

function stableJson(value: unknown): string {
	return JSON.stringify(canonicalizeValue(value));
}

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function eventHashSeed(event: AgentRunEvent): AgentRunEvent {
	const { eventHash: _eventHash, ...rest } = event;
	return rest;
}

function collectSensitiveFieldPaths(value: unknown, basePath = ""): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((entry, idx) =>
			collectSensitiveFieldPaths(entry, `${basePath}[${idx}]`),
		);
	}

	if (!isObject(value)) {
		return [];
	}

	const hits: string[] = [];
	for (const [key, nested] of Object.entries(value)) {
		const currentPath = basePath.length > 0 ? `${basePath}.${key}` : key;
		if (SENSITIVE_KEY_PATTERN.test(key)) {
			hits.push(currentPath);
		}
		hits.push(...collectSensitiveFieldPaths(nested, currentPath));
	}
	return hits;
}

function assertNoSensitiveFields(value: unknown, kind: string): void {
	const paths = collectSensitiveFieldPaths(value);
	if (paths.length > 0) {
		throw new RunRecordError(
			`${kind} contains sensitive keys: ${paths.join(", ")}`,
			"E_SENSITIVE_FIELDS",
		);
	}
}

function assertAllowedKeys(
	value: Record<string, unknown>,
	allowedKeys: string[],
	field: string,
): void {
	const extras = Object.keys(value).filter((key) => !allowedKeys.includes(key));
	if (extras.length > 0) {
		throw new RunRecordError(
			`${field} contains unsupported properties: ${extras.join(", ")}`,
			field.startsWith("event") ? "E_EVENT_INVALID" : "E_MANIFEST_INVALID",
		);
	}
}

export function computeEventHash(event: AgentRunEvent): string {
	return sha256(stableJson(eventHashSeed(event)));
}

export function validateAgentRunManifest(value: unknown): AgentRunManifest {
	if (!isObject(value)) {
		throw new RunRecordError(
			"Manifest must be an object",
			"E_MANIFEST_INVALID",
		);
	}

	const manifest = value as Partial<AgentRunManifest>;
	assertAllowedKeys(
		value,
		[
			"schemaVersion",
			"runId",
			"command",
			"scenarioId",
			"startedAt",
			"finishedAt",
			"durationMs",
			"repo",
			"contract",
			"policyContext",
			"outcome",
			"exit",
			"artifactRefs",
			"preconditions",
			"provenance",
		],
		"manifest",
	);

	if (manifest.schemaVersion !== AGENT_RUN_MANIFEST_SCHEMA_VERSION) {
		throw new RunRecordError(
			"Invalid manifest schemaVersion",
			"E_MANIFEST_INVALID",
		);
	}
	if (!manifest.runId || typeof manifest.runId !== "string") {
		throw new RunRecordError(
			"Manifest runId is required",
			"E_MANIFEST_INVALID",
		);
	}
	ensureRunId(manifest.runId);

	if (!manifest.command || typeof manifest.command !== "string") {
		throw new RunRecordError(
			"Manifest command is required",
			"E_MANIFEST_INVALID",
		);
	}
	if (manifest.command.length === 0) {
		throw new RunRecordError(
			"Manifest command must not be empty",
			"E_MANIFEST_INVALID",
		);
	}
	if (
		manifest.scenarioId !== undefined &&
		typeof manifest.scenarioId !== "string"
	) {
		throw new RunRecordError(
			"Manifest scenarioId must be a string when provided",
			"E_MANIFEST_INVALID",
		);
	}
	if (manifest.scenarioId !== undefined && manifest.scenarioId.length === 0) {
		throw new RunRecordError(
			"Manifest scenarioId must not be empty when provided",
			"E_MANIFEST_INVALID",
		);
	}
	if (!manifest.startedAt || typeof manifest.startedAt !== "string") {
		throw new RunRecordError(
			"Manifest startedAt is required",
			"E_MANIFEST_INVALID",
		);
	}
	if (!manifest.finishedAt || typeof manifest.finishedAt !== "string") {
		throw new RunRecordError(
			"Manifest finishedAt is required",
			"E_MANIFEST_INVALID",
		);
	}
	ensureIso(manifest.startedAt, "manifest.startedAt");
	ensureIso(manifest.finishedAt, "manifest.finishedAt");

	if (typeof manifest.durationMs !== "number" || manifest.durationMs < 0) {
		throw new RunRecordError(
			"Manifest durationMs must be a positive number",
			"E_MANIFEST_INVALID",
		);
	}

	if (!isObject(manifest.repo)) {
		throw new RunRecordError("Manifest repo is required", "E_MANIFEST_INVALID");
	}
	const repo = manifest.repo as AgentRunManifest["repo"];
	assertAllowedKeys(
		repo as unknown as Record<string, unknown>,
		["repository", "branch", "headSha", "ancestryBaseSha", "ancestryVerified"],
		"manifest.repo",
	);
	if (!repo.repository || !repo.branch || !repo.headSha) {
		throw new RunRecordError(
			"Manifest repo.repository, repo.branch, and repo.headSha are required",
			"E_MANIFEST_INVALID",
		);
	}
	if (typeof repo.repository !== "string" || repo.repository.length === 0) {
		throw new RunRecordError(
			"Manifest repo.repository must be a non-empty string",
			"E_MANIFEST_INVALID",
		);
	}
	if (typeof repo.branch !== "string" || repo.branch.length === 0) {
		throw new RunRecordError(
			"Manifest repo.branch must be a non-empty string",
			"E_MANIFEST_INVALID",
		);
	}
	if (
		typeof repo.headSha !== "string" ||
		(repo.headSha !== "unknown" && !/^[a-f0-9]{40}$/.test(repo.headSha))
	) {
		throw new RunRecordError(
			"Manifest repo.headSha must be a 40-character lowercase hex SHA or the explicit unknown sentinel",
			"E_MANIFEST_INVALID",
		);
	}
	if (
		repo.ancestryBaseSha !== undefined &&
		(typeof repo.ancestryBaseSha !== "string" ||
			!/^[a-f0-9]{40}$/.test(repo.ancestryBaseSha))
	) {
		throw new RunRecordError(
			"Manifest repo.ancestryBaseSha must be a 40-character lowercase hex SHA",
			"E_MANIFEST_INVALID",
		);
	}
	if (
		repo.ancestryVerified !== undefined &&
		typeof repo.ancestryVerified !== "boolean"
	) {
		throw new RunRecordError(
			"Manifest repo.ancestryVerified must be a boolean when provided",
			"E_MANIFEST_INVALID",
		);
	}

	if (!isObject(manifest.contract)) {
		throw new RunRecordError(
			"Manifest contract is required",
			"E_MANIFEST_INVALID",
		);
	}
	const contract = manifest.contract as AgentRunManifest["contract"];
	assertAllowedKeys(
		contract as unknown as Record<string, unknown>,
		["path", "hash", "version"],
		"manifest.contract",
	);
	if (!contract.path || !contract.hash) {
		throw new RunRecordError(
			"Manifest contract.path and contract.hash are required",
			"E_MANIFEST_INVALID",
		);
	}
	if (typeof contract.path !== "string" || contract.path.length === 0) {
		throw new RunRecordError(
			"Manifest contract.path must be a non-empty string",
			"E_MANIFEST_INVALID",
		);
	}
	ensureSha256(contract.hash, "manifest.contract.hash");
	if (contract.version !== undefined && typeof contract.version !== "string") {
		throw new RunRecordError(
			"Manifest contract.version must be a string when provided",
			"E_MANIFEST_INVALID",
		);
	}

	if (!isObject(manifest.policyContext)) {
		throw new RunRecordError(
			"Manifest policyContext is required",
			"E_MANIFEST_INVALID",
		);
	}
	const policyContext =
		manifest.policyContext as AgentRunManifest["policyContext"];
	assertAllowedKeys(
		policyContext as unknown as Record<string, unknown>,
		["mode", "safetyPosture", "effectivePolicySource"],
		"manifest.policyContext",
	);
	if (
		!policyContext.mode ||
		!policyContext.safetyPosture ||
		!policyContext.effectivePolicySource
	) {
		throw new RunRecordError(
			"Manifest policyContext fields are required",
			"E_MANIFEST_INVALID",
		);
	}
	if (
		typeof policyContext.mode !== "string" ||
		policyContext.mode.length === 0 ||
		typeof policyContext.safetyPosture !== "string" ||
		policyContext.safetyPosture.length === 0 ||
		typeof policyContext.effectivePolicySource !== "string" ||
		policyContext.effectivePolicySource.length === 0
	) {
		throw new RunRecordError(
			"Manifest policyContext values must be non-empty strings",
			"E_MANIFEST_INVALID",
		);
	}
	if (!manifest.outcome || !MANIFEST_OUTCOMES.has(manifest.outcome)) {
		throw new RunRecordError(
			"Manifest outcome must be one of the allowed schema values",
			"E_MANIFEST_INVALID",
		);
	}

	if (!isObject(manifest.exit)) {
		throw new RunRecordError("Manifest exit is required", "E_MANIFEST_INVALID");
	}
	const exit = manifest.exit as AgentRunManifest["exit"];
	assertAllowedKeys(
		exit as unknown as Record<string, unknown>,
		["code", "classification"],
		"manifest.exit",
	);
	if (
		typeof exit.code !== "number" ||
		typeof exit.classification !== "string"
	) {
		throw new RunRecordError(
			"Manifest exit.code and exit.classification are required",
			"E_MANIFEST_INVALID",
		);
	}
	if (!Number.isInteger(exit.code)) {
		throw new RunRecordError(
			"Manifest exit.code must be an integer",
			"E_MANIFEST_INVALID",
		);
	}
	if (!EXIT_CLASSIFICATIONS.has(exit.classification)) {
		throw new RunRecordError(
			"Manifest exit.classification must be one of the allowed schema values",
			"E_MANIFEST_INVALID",
		);
	}

	if (!Array.isArray(manifest.artifactRefs)) {
		throw new RunRecordError(
			"Manifest artifactRefs must be an array",
			"E_MANIFEST_INVALID",
		);
	}
	for (const ref of manifest.artifactRefs) {
		if (!isObject(ref)) {
			throw new RunRecordError(
				"Artifact ref must be an object",
				"E_MANIFEST_INVALID",
			);
		}
		assertAllowedKeys(
			ref,
			["type", "path", "checksum"],
			"manifest.artifactRefs[]",
		);
		if (
			typeof ref.type !== "string" ||
			typeof ref.path !== "string" ||
			typeof ref.checksum !== "string"
		) {
			throw new RunRecordError(
				"Artifact ref requires type/path/checksum",
				"E_MANIFEST_INVALID",
			);
		}
		if (ref.type.length === 0 || ref.path.length === 0) {
			throw new RunRecordError(
				"Artifact ref type/path must be non-empty strings",
				"E_MANIFEST_INVALID",
			);
		}
		ensureSha256(ref.checksum, "manifest.artifactRefs[].checksum");
	}

	if (!isObject(manifest.preconditions)) {
		throw new RunRecordError(
			"Manifest preconditions must be an object",
			"E_MANIFEST_INVALID",
		);
	}

	for (const [key, precondition] of Object.entries(manifest.preconditions)) {
		if (
			precondition !== null &&
			typeof precondition !== "string" &&
			typeof precondition !== "number" &&
			typeof precondition !== "boolean"
		) {
			throw new RunRecordError(
				`Manifest preconditions.${key} must be a primitive value`,
				"E_MANIFEST_INVALID",
			);
		}
	}

	if (!isObject(manifest.provenance)) {
		throw new RunRecordError(
			"Manifest provenance is required",
			"E_MANIFEST_INVALID",
		);
	}
	const provenance = manifest.provenance as AgentRunManifest["provenance"];
	assertAllowedKeys(
		provenance as unknown as Record<string, unknown>,
		["repoContractHash", "processPolicyHash"],
		"manifest.provenance",
	);
	ensureSha256(
		provenance.repoContractHash,
		"manifest.provenance.repoContractHash",
	);
	ensureSha256(
		provenance.processPolicyHash,
		"manifest.provenance.processPolicyHash",
	);

	assertNoSensitiveFields(manifest, "Manifest");

	return manifest as AgentRunManifest;
}

export function validateAgentRunEvent(value: unknown): AgentRunEvent {
	if (!isObject(value)) {
		throw new RunRecordError("Event must be an object", "E_EVENT_INVALID");
	}
	const event = value as Partial<AgentRunEvent>;
	assertAllowedKeys(
		value,
		[
			"schemaVersion",
			"runId",
			"eventId",
			"timestamp",
			"eventType",
			"status",
			"severity",
			"payload",
			"correlationId",
			"prevEventHash",
			"eventHash",
		],
		"event",
	);

	if (event.schemaVersion !== AGENT_RUN_EVENT_SCHEMA_VERSION) {
		throw new RunRecordError("Invalid event schemaVersion", "E_EVENT_INVALID");
	}
	if (!event.runId || typeof event.runId !== "string") {
		throw new RunRecordError("Event runId is required", "E_EVENT_INVALID");
	}
	ensureRunId(event.runId);

	if (!event.eventId || typeof event.eventId !== "string") {
		throw new RunRecordError("Event eventId is required", "E_EVENT_INVALID");
	}
	if (event.eventId.length === 0) {
		throw new RunRecordError(
			"Event eventId must not be empty",
			"E_EVENT_INVALID",
		);
	}
	if (!event.timestamp || typeof event.timestamp !== "string") {
		throw new RunRecordError("Event timestamp is required", "E_EVENT_INVALID");
	}
	ensureIso(event.timestamp, "event.timestamp");

	if (!event.eventType || typeof event.eventType !== "string") {
		throw new RunRecordError("Event eventType is required", "E_EVENT_INVALID");
	}
	if (!event.status || typeof event.status !== "string") {
		throw new RunRecordError("Event status is required", "E_EVENT_INVALID");
	}
	if (!event.severity || typeof event.severity !== "string") {
		throw new RunRecordError("Event severity is required", "E_EVENT_INVALID");
	}
	if (!EVENT_TYPES.has(event.eventType)) {
		throw new RunRecordError(
			"Event eventType must be one of the allowed schema values",
			"E_EVENT_INVALID",
		);
	}
	if (!EVENT_STATUSES.has(event.status)) {
		throw new RunRecordError(
			"Event status must be one of the allowed schema values",
			"E_EVENT_INVALID",
		);
	}
	if (!EVENT_SEVERITIES.has(event.severity)) {
		throw new RunRecordError(
			"Event severity must be one of the allowed schema values",
			"E_EVENT_INVALID",
		);
	}
	if (!isObject(event.payload)) {
		throw new RunRecordError(
			"Event payload must be an object",
			"E_EVENT_INVALID",
		);
	}

	if (
		event.correlationId !== undefined &&
		typeof event.correlationId !== "string"
	) {
		throw new RunRecordError(
			"Event correlationId must be a string when provided",
			"E_EVENT_INVALID",
		);
	}

	if (event.prevEventHash !== undefined) {
		if (typeof event.prevEventHash !== "string") {
			throw new RunRecordError(
				"Event prevEventHash must be a string",
				"E_EVENT_INVALID",
			);
		}
		ensureSha256(event.prevEventHash, "event.prevEventHash");
	}
	if (event.eventHash !== undefined) {
		if (typeof event.eventHash !== "string") {
			throw new RunRecordError(
				"Event eventHash must be a string",
				"E_EVENT_INVALID",
			);
		}
		ensureSha256(event.eventHash, "event.eventHash");
	}

	assertNoSensitiveFields(event, "Event");

	return event as AgentRunEvent;
}

export function resolveRunRecordPaths(options: {
	runId: string;
	baseDir?: string;
	cwd?: string;
}): CanonicalRunRecordPaths {
	ensureRunId(options.runId);
	const cwd = resolve(options.cwd ?? process.cwd());
	const basePath = ensureWithinCwd(
		options.baseDir ?? CANONICAL_RUN_RECORDS_DIR,
		cwd,
	);
	const runDir = ensureWithinCwd(join(basePath, options.runId), cwd);

	return {
		runDir,
		manifestPath: join(runDir, CANONICAL_MANIFEST_FILE),
		eventsPath: join(runDir, CANONICAL_EVENTS_FILE),
		legacyManifestPath: join(runDir, LEGACY_MANIFEST_FILE),
		legacyEventsPath: join(runDir, LEGACY_EVENTS_FILE),
	};
}

function atomicWrite(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	try {
		writeFileSync(tempPath, content, "utf-8");
		renameSync(tempPath, path);
	} catch (error) {
		try {
			if (existsSync(tempPath)) {
				rmSync(tempPath);
			}
		} catch {
			// Ignore temp cleanup failures.
		}
		throw new RunRecordError(
			`Atomic write failed for ${path}: ${String(error)}`,
			"E_IO",
		);
	}
}

function parseJsonFile(path: string, kind: "manifest" | "event"): unknown {
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as unknown;
	} catch (error) {
		throw new RunRecordError(
			`Invalid ${kind} JSON at ${path}: ${String(error)}`,
			kind === "manifest" ? "E_MANIFEST_INVALID" : "E_EVENT_INVALID",
		);
	}
}

function parseJsonlEvents(
	path: string,
	expectedRunId?: string,
): AgentRunEvent[] {
	const content = readFileSync(path, "utf-8");
	const lines = content
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	const events: AgentRunEvent[] = [];
	let previousHash: string | undefined;

	for (let idx = 0; idx < lines.length; idx++) {
		const line = lines[idx];
		if (line === undefined) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line) as unknown;
		} catch (error) {
			throw new RunRecordError(
				`Invalid event JSONL at ${path}:${idx + 1} (${String(error)})`,
				"E_EVENT_INVALID",
			);
		}

		const event = validateAgentRunEvent(parsed);
		if (expectedRunId && event.runId !== expectedRunId) {
			throw new RunRecordError(
				`Event runId mismatch at ${path}:${idx + 1} (expected ${expectedRunId}, received ${event.runId})`,
				"E_EVENT_INVALID",
			);
		}
		const computedHash = computeEventHash(event);
		if (event.eventHash !== computedHash) {
			throw new RunRecordError(
				`Event hash mismatch at ${path}:${idx + 1}`,
				"E_HASH_CHAIN",
			);
		}
		if (idx === 0 && event.prevEventHash !== undefined) {
			throw new RunRecordError(
				`First event in ${path} must not include prevEventHash`,
				"E_HASH_CHAIN",
			);
		}
		if (idx > 0 && event.prevEventHash !== previousHash) {
			throw new RunRecordError(
				`Event prevEventHash mismatch at ${path}:${idx + 1}`,
				"E_HASH_CHAIN",
			);
		}

		events.push(event);
		previousHash = event.eventHash;
	}

	return events;
}

export function writeCanonicalManifest(options: {
	manifest: AgentRunManifest;
	baseDir?: string;
	cwd?: string;
}): { path: string; checksum: string } {
	const manifest = validateAgentRunManifest(options.manifest);
	const paths = resolveRunRecordPaths({
		runId: manifest.runId,
		...(options.baseDir ? { baseDir: options.baseDir } : {}),
		...(options.cwd ? { cwd: options.cwd } : {}),
	});
	const content = JSON.stringify(manifest, null, 2);
	atomicWrite(paths.manifestPath, content);
	return {
		path: paths.manifestPath,
		checksum: sha256(content),
	};
}

export function appendCanonicalEvent(options: {
	event: AgentRunEvent;
	baseDir?: string;
	cwd?: string;
}): { path: string; eventHash: string } {
	const event = validateAgentRunEvent(options.event);
	const paths = resolveRunRecordPaths({
		runId: event.runId,
		...(options.baseDir ? { baseDir: options.baseDir } : {}),
		...(options.cwd ? { cwd: options.cwd } : {}),
	});

	let previousHash: string | undefined;
	if (existsSync(paths.eventsPath)) {
		const existing = parseJsonlEvents(paths.eventsPath, event.runId);
		const last = existing[existing.length - 1];
		previousHash = last?.eventHash;
	}

	if (
		previousHash &&
		event.prevEventHash !== undefined &&
		event.prevEventHash !== previousHash
	) {
		throw new RunRecordError(
			`Event prevEventHash must match latest event hash (${previousHash})`,
			"E_HASH_CHAIN",
		);
	}
	if (!previousHash && event.prevEventHash !== undefined) {
		throw new RunRecordError(
			"First event must not provide prevEventHash",
			"E_HASH_CHAIN",
		);
	}

	const withPrev: AgentRunEvent = {
		...event,
		...(previousHash ? { prevEventHash: previousHash } : {}),
	};
	const withHash: AgentRunEvent = {
		...withPrev,
		eventHash: computeEventHash(withPrev),
	};
	const eventHash = withHash.eventHash;
	if (!eventHash) {
		throw new RunRecordError("Event hash generation failed", "E_HASH_CHAIN");
	}

	const line = `${JSON.stringify(withHash)}\n`;
	const tempPath = `${paths.eventsPath}.${process.pid}.${Date.now()}.tmp`;
	mkdirSync(dirname(paths.eventsPath), { recursive: true });
	try {
		if (existsSync(paths.eventsPath)) {
			copyFileSync(paths.eventsPath, tempPath);
			writeFileSync(tempPath, line, { flag: "a", encoding: "utf-8" });
		} else {
			writeFileSync(tempPath, line, "utf-8");
		}
		renameSync(tempPath, paths.eventsPath);
	} catch (error) {
		try {
			if (existsSync(tempPath)) {
				rmSync(tempPath);
			}
		} catch {
			// Ignore temp cleanup failures.
		}
		throw new RunRecordError(
			`Failed to append event: ${String(error)}`,
			"E_IO",
		);
	}

	return {
		path: paths.eventsPath,
		eventHash,
	};
}

export function loadRunRecordBundle(options: {
	runId: string;
	baseDir?: string;
	cwd?: string;
}): LoadedRunRecordBundle {
	const paths = resolveRunRecordPaths(options);

	const manifestPath = existsSync(paths.manifestPath)
		? paths.manifestPath
		: paths.legacyManifestPath;
	const eventsPath = existsSync(paths.eventsPath)
		? paths.eventsPath
		: paths.legacyEventsPath;

	if (!existsSync(manifestPath)) {
		throw new RunRecordError(
			`Manifest not found for run ${options.runId}`,
			"E_MANIFEST_INVALID",
		);
	}
	if (!existsSync(eventsPath)) {
		throw new RunRecordError(
			`Event stream not found for run ${options.runId}`,
			"E_EVENT_INVALID",
		);
	}

	const manifest = validateAgentRunManifest(
		parseJsonFile(manifestPath, "manifest"),
	);
	if (manifest.runId !== options.runId) {
		throw new RunRecordError(
			`Manifest runId mismatch for ${options.runId}: ${manifest.runId}`,
			"E_MANIFEST_INVALID",
		);
	}
	const events = parseJsonlEvents(eventsPath, manifest.runId);

	return {
		manifest,
		events,
		source: {
			manifestPath,
			eventsPath,
			usedLegacyManifest: manifestPath === paths.legacyManifestPath,
			usedLegacyEvents: eventsPath === paths.legacyEventsPath,
		},
	};
}
