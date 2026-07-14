import {
	SYNAIPSE_STATE_SCHEMA_VERSION,
	type SynaipseStateValidationResult,
} from "./state-contract.js";
import { isRecord } from "../decision/validators.js";
import {
	validateSynaipseContextProjections,
	validateSynaipseContextUnknowns,
} from "./context-projection.js";
import { isRfc3339DateTime } from "./date-time.js";

type ValidationErrors = SynaipseStateValidationResult["errors"];

const VALID_STAGES = [
	"orient",
	"verify",
	"review",
	"repair",
	"handoff",
] as const;
const VALID_STATUSES = ["pass", "fail", "blocked", "action_required"] as const;

/** Add a validation error when a contract string is missing or blank. */
function requireString(
	value: unknown,
	path: string,
	errors: ValidationErrors,
): void {
	if (typeof value !== "string" || value.trim().length === 0)
		errors.push({ path, message: "must be a non-empty string" });
}

/** Add a validation error when an object contains fields outside its contract. */
function rejectUnknownProperties(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: ValidationErrors,
): void {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key))
			errors.push({
				path: `${path}.${key}`,
				message: "must not contain unknown properties",
			});
	}
}

/** Add a validation error when a value is not an RFC3339 date-time string. */
function requireDateTime(
	value: unknown,
	path: string,
	errors: ValidationErrors,
): void {
	if (!isRfc3339DateTime(value))
		errors.push({ path, message: "must be an RFC3339 date-time string" });
}

/** Add a validation error when a value is outside a finite contract vocabulary. */
function requireEnum(
	value: unknown,
	path: string,
	allowed: readonly string[],
	errors: ValidationErrors,
): void {
	if (typeof value !== "string" || !allowed.includes(value))
		errors.push({ path, message: `must be one of ${allowed.join(", ")}` });
}

/** Validate the nullable repository identity and worktree fields. */
function validateRepository(value: unknown, errors: ValidationErrors): void {
	if (!isRecord(value)) {
		errors.push({ path: "repository", message: "must be an object" });
		return;
	}
	rejectUnknownProperties(
		value,
		["name", "branch", "baseRef", "headSha", "baseSha", "clean"],
		"repository",
		errors,
	);
	for (const field of [
		"name",
		"branch",
		"baseRef",
		"headSha",
		"baseSha",
	] as const) {
		const fieldValue = value[field];
		if (fieldValue !== null)
			requireString(fieldValue, `repository.${field}`, errors);
	}
	if (typeof value.clean !== "boolean" && value.clean !== null)
		errors.push({
			path: "repository.clean",
			message: "must be boolean or null",
		});
}

/** Validate a task or authority object without accepting missing required fields. */
function validateTaskAndAuthority(
	value: Record<string, unknown>,
	errors: ValidationErrors,
): void {
	if (!isRecord(value.task))
		errors.push({ path: "task", message: "must be an object" });
	else {
		rejectUnknownProperties(
			value.task,
			["status", "objective"],
			"task",
			errors,
		);
		requireEnum(value.task.status, "task.status", VALID_STATUSES, errors);
		requireString(value.task.objective, "task.objective", errors);
	}
	if (!isRecord(value.authority))
		errors.push({ path: "authority", message: "must be an object" });
	else {
		rejectUnknownProperties(
			value.authority,
			["owner", "humanRequired"],
			"authority",
			errors,
		);
		requireEnum(
			value.authority.owner,
			"authority.owner",
			["codex", "operator"],
			errors,
		);
		if (typeof value.authority.humanRequired !== "boolean")
			errors.push({
				path: "authority.humanRequired",
				message: "must be boolean",
			});
	}
}

/** Validate the state arrays used for capabilities, blockers, and evidence refs. */
function validateStateArrays(
	value: Record<string, unknown>,
	errors: ValidationErrors,
): void {
	for (const field of [
		"truthLaneBlockers",
		"admittedCapabilities",
		"evidenceRefs",
	] as const) {
		if (
			!Array.isArray(value[field]) ||
			!value[field].every(
				(entry) => typeof entry === "string" && entry.trim().length > 0,
			) ||
			(field !== "truthLaneBlockers" && value[field].length === 0)
		)
			errors.push({ path: field, message: "must be an array of strings" });
	}
}

/** Enforce the pure-read effect declaration for the current cockpit producer. */
function validateInvocationEffects(
	value: unknown,
	errors: ValidationErrors,
): void {
	if (!isRecord(value)) {
		errors.push({ path: "invocationEffects", message: "must be an object" });
		return;
	}
	rejectUnknownProperties(
		value,
		[
			"effectClasses",
			"targets",
			"writesFiles",
			"mutatesGit",
			"mutatesExternal",
		],
		"invocationEffects",
		errors,
	);
	if (
		!Array.isArray(value.effectClasses) ||
		value.effectClasses.length !== 1 ||
		value.effectClasses[0] !== "pure_read"
	)
		errors.push({
			path: "invocationEffects.effectClasses",
			message: "must contain only pure_read",
		});
	if (
		!Array.isArray(value.targets) ||
		value.targets.length === 0 ||
		!value.targets.every((entry) => typeof entry === "string" && entry.trim())
	)
		errors.push({
			path: "invocationEffects.targets",
			message: "must be a non-empty array of strings",
		});
	for (const field of ["writesFiles", "mutatesGit", "mutatesExternal"] as const)
		if (value[field] !== false)
			errors.push({
				path: `invocationEffects.${field}`,
				message: "must be false",
			});
}

/** Validate freshness evidence while keeping source-specific age policy outside this packet. */
function validateFreshness(value: unknown, errors: ValidationErrors): void {
	if (!isRecord(value))
		errors.push({ path: "freshness", message: "must be an object" });
	else {
		rejectUnknownProperties(
			value,
			["status", "observedAt"],
			"freshness",
			errors,
		);
		requireEnum(
			value.status,
			"freshness.status",
			["current", "unknown"],
			errors,
		);
		requireDateTime(value.observedAt, "freshness.observedAt", errors);
	}
}

/** Validate the emitted compact state without coupling it to provider state. */
export function validateSynaipseState(
	value: unknown,
): SynaipseStateValidationResult {
	const errors: ValidationErrors = [];
	if (!isRecord(value))
		return {
			valid: false,
			errors: [{ path: "state", message: "must be an object" }],
		};
	rejectUnknownProperties(
		value,
		[
			"schemaVersion",
			"generatedAt",
			"repository",
			"stage",
			"task",
			"authority",
			"truthLaneBlockers",
			"admittedCapabilities",
			"evidenceRefs",
			"contextRefs",
			"contextUnknowns",
			"nextAction",
			"invocationEffects",
			"freshness",
			"claimBoundary",
		],
		"state",
		errors,
	);
	if (value.schemaVersion !== SYNAIPSE_STATE_SCHEMA_VERSION)
		errors.push({
			path: "schemaVersion",
			message: `must be ${SYNAIPSE_STATE_SCHEMA_VERSION}`,
		});
	requireDateTime(value.generatedAt, "generatedAt", errors);
	validateRepository(value.repository, errors);
	requireEnum(value.stage, "stage", VALID_STAGES, errors);
	validateTaskAndAuthority(value, errors);
	validateStateArrays(value, errors);
	errors.push(
		...validateSynaipseContextProjections(value.contextRefs),
		...validateSynaipseContextUnknowns(value.contextUnknowns),
	);
	requireString(value.nextAction, "nextAction", errors);
	validateInvocationEffects(value.invocationEffects, errors);
	validateFreshness(value.freshness, errors);
	requireString(value.claimBoundary, "claimBoundary", errors);
	return { valid: errors.length === 0, errors };
}
