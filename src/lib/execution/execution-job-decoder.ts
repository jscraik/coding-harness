import {
	EXECUTION_RESOURCE_LANES,
	type ExecutionClaimsBoundary,
	type ExecutionFailureClass,
	type ExecutionResourceLane,
} from "./execution-result.js";
import type { ExecutionJob, ExecutionJobStatus } from "./execution-job.js";
import { EXECUTION_JOB_SCHEMA_VERSION } from "./execution-job-schema.js";

const REQUIRED_LANES = new Set<string>(EXECUTION_RESOURCE_LANES);
const DATE_TIME_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const REQUIRED_EXECUTION_JOB_KEYS = new Set([
	"schemaVersion",
	"ticket",
	"requestKey",
	"fingerprint",
	"command",
	"cwd",
	"artifactsDir",
	"resourceLanes",
	"parallelSafe",
	"conflictsWith",
	"timeoutSeconds",
	"attempt",
	"retryDecision",
	"status",
	"createdAt",
	"startedAt",
	"completedAt",
	"queueWaitMs",
	"durationMs",
	"cancelRequested",
	"pid",
	"workerPid",
	"processToken",
	"resultPath",
	"failureClass",
	"nextAction",
	"claimsBoundary",
]);

/** Decode an object at the JSON boundary. */
function objectValue(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`Invalid execution job: ${label} must be an object.`);
	}
	return value as Record<string, unknown>;
}

/** Decode a required non-empty string field. */
function stringValue(data: Record<string, unknown>, key: string): string {
	const value = data[key];
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(
			`Invalid execution job: ${key} must be a non-empty string.`,
		);
	}
	return value;
}

/** Decode a nullable string field. */
function nullableString(
	data: Record<string, unknown>,
	key: string,
): string | null {
	const value = data[key];
	if (value !== null && typeof value !== "string") {
		throw new Error(`Invalid execution job: ${key} must be string or null.`);
	}
	return value;
}

/** Decode a required date-time string at the JSON boundary. */
function dateTimeValue(data: Record<string, unknown>, key: string): string {
	const value = stringValue(data, key);
	if (!DATE_TIME_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
		throw new Error(`Invalid execution job: ${key} must be a date-time.`);
	}
	return value;
}

/** Decode a nullable date-time string at the JSON boundary. */
function nullableDateTimeValue(
	data: Record<string, unknown>,
	key: string,
): string | null {
	const value = nullableString(data, key);
	if (
		value !== null &&
		(!DATE_TIME_PATTERN.test(value) || !Number.isFinite(Date.parse(value)))
	) {
		throw new Error(`Invalid execution job: ${key} must be a date-time.`);
	}
	return value;
}

/** Decode a required boolean field. */
function booleanValue(data: Record<string, unknown>, key: string): boolean {
	const value = data[key];
	if (typeof value !== "boolean") {
		throw new Error(`Invalid execution job: ${key} must be boolean.`);
	}
	return value;
}

/** Decode a required integer field with an optional minimum. */
function integerValue(
	data: Record<string, unknown>,
	key: string,
	minimum = 0,
): number {
	const value = data[key];
	if (!Number.isInteger(value) || (value as number) < minimum) {
		throw new Error(
			`Invalid execution job: ${key} must be integer >= ${minimum}.`,
		);
	}
	return value as number;
}

/** Decode a resource-lane list while rejecting unknown lanes. */
function laneList(
	data: Record<string, unknown>,
	key: string,
): ExecutionResourceLane[] {
	const value = data[key];
	if (
		!Array.isArray(value) ||
		new Set(value).size !== value.length ||
		value.some((lane) => !REQUIRED_LANES.has(String(lane)))
	) {
		throw new Error(
			`Invalid execution job: ${key} contains an unknown or duplicate lane.`,
		);
	}
	return value as ExecutionResourceLane[];
}

/** Decode a non-empty command vector. */
function commandList(data: Record<string, unknown>): string[] {
	const value = data.command;
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.some((item) => typeof item !== "string" || item.length === 0)
	) {
		throw new Error("Invalid execution job: command must contain strings.");
	}
	return value as string[];
}

/** Decode the nullable execution failure classification. */
function failureClassValue(
	data: Record<string, unknown>,
): ExecutionFailureClass {
	const value = data.failureClass;
	if (value === null) return null;
	if (
		value !== "command_failure" &&
		value !== "timeout" &&
		value !== "canceled" &&
		value !== "blocked_conflict" &&
		value !== "request_key_conflict" &&
		value !== "environment_failure" &&
		value !== "artifact_failure"
	) {
		throw new Error("Invalid execution job: failureClass is not recognized.");
	}
	return value;
}

/** Decode the explicit local-versus-hosted claims boundary. */
function claimsBoundaryValue(
	data: Record<string, unknown>,
): ExecutionClaimsBoundary {
	const boundary = objectValue(data.claimsBoundary, "claimsBoundary");
	const values = [
		"localExecution",
		"hostedCi",
		"reviewState",
		"mergeReadiness",
	] as const;
	for (const key of values) {
		if (boundary[key] !== "proven" && boundary[key] !== "not_checked") {
			throw new Error(
				`Invalid execution job: claimsBoundary.${key} is not recognized.`,
			);
		}
	}
	const read = (key: (typeof values)[number]): "proven" | "not_checked" =>
		boundary[key] === "proven" ? "proven" : "not_checked";
	return {
		localExecution: read("localExecution"),
		hostedCi: read("hostedCi"),
		reviewState: read("reviewState"),
		mergeReadiness: read("mergeReadiness"),
	};
}

/** Decode a persisted job at the JSON storage boundary. */
export function decodeExecutionJob(value: unknown): ExecutionJob {
	const data = objectValue(value, "root");
	const unexpectedKeys = Object.keys(data).filter(
		(key) => !REQUIRED_EXECUTION_JOB_KEYS.has(key),
	);
	if (unexpectedKeys.length > 0) {
		throw new Error(
			`Invalid execution job: unexpected field(s): ${unexpectedKeys.join(", ")}.`,
		);
	}
	const schemaVersion = stringValue(data, "schemaVersion");
	if (schemaVersion !== EXECUTION_JOB_SCHEMA_VERSION) {
		throw new Error(
			`Invalid execution job: schemaVersion must be ${EXECUTION_JOB_SCHEMA_VERSION}.`,
		);
	}
	const status = stringValue(data, "status") as ExecutionJobStatus;
	if (
		![
			"queued",
			"running",
			"pass",
			"fail",
			"blocked",
			"timeout",
			"canceled",
		].includes(status)
	) {
		throw new Error("Invalid execution job: status is not recognized.");
	}
	const retryDecision = stringValue(
		data,
		"retryDecision",
	) as ExecutionJob["retryDecision"];
	if (!["safe", "conditional", "manual"].includes(retryDecision)) {
		throw new Error("Invalid execution job: retryDecision is not recognized.");
	}
	return {
		schemaVersion,
		ticket: stringValue(data, "ticket"),
		requestKey: stringValue(data, "requestKey"),
		fingerprint: stringValue(data, "fingerprint"),
		command: commandList(data),
		cwd: stringValue(data, "cwd"),
		artifactsDir: stringValue(data, "artifactsDir"),
		resourceLanes: laneList(data, "resourceLanes"),
		parallelSafe: booleanValue(data, "parallelSafe"),
		conflictsWith: laneList(data, "conflictsWith"),
		timeoutSeconds: integerValue(data, "timeoutSeconds", 1),
		attempt: integerValue(data, "attempt", 1),
		retryDecision,
		status,
		createdAt: dateTimeValue(data, "createdAt"),
		startedAt: nullableDateTimeValue(data, "startedAt"),
		completedAt: nullableDateTimeValue(data, "completedAt"),
		queueWaitMs: integerValue(data, "queueWaitMs"),
		durationMs: integerValue(data, "durationMs"),
		cancelRequested: booleanValue(data, "cancelRequested"),
		pid: data.pid === null ? null : integerValue(data, "pid", 1),
		workerPid:
			data.workerPid === null ? null : integerValue(data, "workerPid", 1),
		processToken: nullableString(data, "processToken"),
		resultPath: nullableString(data, "resultPath"),
		failureClass: failureClassValue(data),
		nextAction: stringValue(data, "nextAction"),
		claimsBoundary: claimsBoundaryValue(data),
	};
}
