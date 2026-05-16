import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateEnum,
	validateNullableString,
	validateString,
	validateStringArray,
} from "../decision/validators.js";

/** Schema version for the first local harness runtime state card. */
export const RUNTIME_CARD_SCHEMA_VERSION = "runtime-card/v1" as const;

/** Lifecycle state for the current work item as known by local evidence. */
export type RuntimeCardLifecycleState =
	| "planned"
	| "active"
	| "implemented"
	| "locally_validated"
	| "review_pending"
	| "ci_blocked"
	| "merge_ready"
	| "merged"
	| "closeout_pending"
	| "reconciled"
	| "closed"
	| "stale"
	| "superseded"
	| "blocked"
	| "unknown";

/** Freshness of an input source relative to the current work item. */
export type RuntimeCardFreshness = "current" | "stale" | "missing" | "unknown";

/** Usability state for a runtime source. */
export type RuntimeCardSourceStatus =
	| "usable"
	| "empty"
	| "invalid"
	| "blocked";

/** Source families allowed in runtime-card/v1. */
export type RuntimeCardSourceKind =
	| "git"
	| "pr"
	| "linear"
	| "artifact"
	| "validation"
	| "review"
	| "session"
	| "phase_exit";

/** Status for local spec/plan/artifact routing. */
export type RuntimeCardArtifactStatus =
	| "current"
	| "stale"
	| "missing"
	| "superseded"
	| "unknown";

/** Collapsed phase-exit posture carried by the runtime card. */
export type RuntimeCardPhaseExitStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "not_run"
	| "unknown";

/** Validation result for a runtime-card candidate. */
export interface RuntimeCardValidationResult {
	/** Whether the candidate satisfies runtime-card/v1. */
	valid: boolean;
	/** Structured validation errors, empty when valid. */
	errors: HeValidationError[];
}

/** Branch state snapshot for a runtime card. */
export interface RuntimeCardBranchState {
	/** Current branch name, or null when unavailable. */
	name: string | null;
	/** Whether the local worktree was clean when inspected, or null when unknown. */
	clean: boolean | null;
	/** Commit SHA or ref used by the evidence, or null when unknown. */
	ref: string | null;
}

/** Pull request state snapshot for a runtime card. */
export interface RuntimeCardPullRequestState {
	/** Pull request number, or null when no PR is known. */
	number: number | null;
	/** Pull request state, or null when unknown. */
	state: string | null;
	/** Whether the PR is draft, or null when unknown. */
	isDraft: boolean | null;
	/** Merge-state status from the PR host, or null when unknown. */
	mergeStateStatus: string | null;
	/** Pull request URL, or null when unknown. */
	url: string | null;
}

/** Spec/plan/artifact routing state for a runtime card. */
export interface RuntimeCardArtifactState {
	/** Active spec path or null when not known. */
	activeSpec: string | null;
	/** Active plan path or null when not known. */
	activePlan: string | null;
	/** Collapsed artifact freshness/status. */
	status: RuntimeCardArtifactStatus;
	/** Artifact refs known to be stale. */
	staleRefs: string[];
}

/** Linear or tracker state snapshot for a runtime card. */
export interface RuntimeCardLinearState {
	/** Issue key, or null when no tracker issue is known. */
	issueKey: string | null;
	/** Freshness of local tracker evidence relative to live state. */
	freshness: RuntimeCardFreshness;
	/** Human-readable tracker status, or null when not refreshed. */
	status?: string | null;
	/** Stable tracker status class, or null when not refreshed. */
	statusType?: string | null;
	/** Tracker issue URL, or null when unknown. */
	url?: string | null;
	/** Required tracker action, or null when none is known. */
	actionRequired: string | null;
}

/** Phase-exit state snapshot for a runtime card. */
export interface RuntimeCardPhaseExitState {
	/** Collapsed phase-exit status. */
	status: RuntimeCardPhaseExitStatus;
	/** Reason for the collapsed status, or null when none is known. */
	reason: string | null;
}

/** Normalized evidence source that contributed to the runtime card. */
export interface RuntimeCardSource {
	/** Source family. */
	kind: RuntimeCardSourceKind;
	/** Stable file, command, URL, or artifact reference. */
	ref: string;
	/** Source freshness relative to the runtime card. */
	freshness: RuntimeCardFreshness;
	/** Whether the source is usable as evidence. */
	status: RuntimeCardSourceStatus;
	/** Stable reason when the source cannot be used. */
	failureClass: string | null;
}

/** Local runtime state card consumed by agent cockpit commands. */
export interface RuntimeCard {
	/** Schema version for this runtime state contract. */
	schemaVersion: typeof RUNTIME_CARD_SCHEMA_VERSION;
	/** ISO-like creation time for the card. */
	generatedAt: string;
	/** Optional tracker key for the work item. */
	issueKey: string | null;
	/** Current lifecycle state. */
	lifecycle: RuntimeCardLifecycleState;
	/** Concise operator-facing summary. */
	summary: string;
	/** Safe next action derived from current evidence. */
	nextSafeAction: string;
	/** Branch state used by the card. */
	branch: RuntimeCardBranchState;
	/** Pull request state used by the card. */
	pullRequest: RuntimeCardPullRequestState;
	/** Local artifact routing state. */
	artifacts: RuntimeCardArtifactState;
	/** Tracker state used by the card. */
	linear: RuntimeCardLinearState;
	/** Phase-exit state used by the card. */
	phaseExit: RuntimeCardPhaseExitState;
	/** Evidence sources inspected to produce the card. */
	sources: RuntimeCardSource[];
	/** Blocking conditions that must be resolved before moving on. */
	blockers: string[];
}

const VALID_LIFECYCLES: readonly RuntimeCardLifecycleState[] = [
	"planned",
	"active",
	"implemented",
	"locally_validated",
	"review_pending",
	"ci_blocked",
	"merge_ready",
	"merged",
	"closeout_pending",
	"reconciled",
	"closed",
	"stale",
	"superseded",
	"blocked",
	"unknown",
];

const VALID_FRESHNESS: readonly RuntimeCardFreshness[] = [
	"current",
	"stale",
	"missing",
	"unknown",
];

const VALID_SOURCE_STATUSES: readonly RuntimeCardSourceStatus[] = [
	"usable",
	"empty",
	"invalid",
	"blocked",
];

const VALID_SOURCE_KINDS: readonly RuntimeCardSourceKind[] = [
	"git",
	"pr",
	"linear",
	"artifact",
	"validation",
	"review",
	"session",
	"phase_exit",
];

const VALID_ARTIFACT_STATUSES: readonly RuntimeCardArtifactStatus[] = [
	"current",
	"stale",
	"missing",
	"superseded",
	"unknown",
];

const VALID_PHASE_EXIT_STATUSES: readonly RuntimeCardPhaseExitStatus[] = [
	"pass",
	"fail",
	"blocked",
	"not_run",
	"unknown",
];

const BLOCKING_LIFECYCLES = new Set<RuntimeCardLifecycleState>([
	"ci_blocked",
	"blocked",
	"stale",
]);

function validateNullableBoolean(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (value !== null && typeof value !== "boolean") {
		errors.push(toValidationError(`${field} must be a boolean or null`, field));
	}
}

function validateNullableNumber(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (
		value !== null &&
		(typeof value !== "number" || !Number.isInteger(value) || value < 0)
	) {
		errors.push(
			toValidationError(
				`${field} must be a non-negative integer or null`,
				field,
			),
		);
	}
}

function validateOptionalNullableString(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (value === undefined) return;
	validateNullableString(value, field, errors);
}

function validateBranchState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("branch must be an object", "branch"));
		return;
	}
	validateNullableString(value.name, "branch.name", errors);
	validateNullableBoolean(value.clean, "branch.clean", errors);
	validateNullableString(value.ref, "branch.ref", errors);
}

function validatePullRequestState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(
			toValidationError("pullRequest must be an object", "pullRequest"),
		);
		return;
	}
	validateNullableNumber(value.number, "pullRequest.number", errors);
	validateNullableString(value.state, "pullRequest.state", errors);
	validateNullableBoolean(value.isDraft, "pullRequest.isDraft", errors);
	validateNullableString(
		value.mergeStateStatus,
		"pullRequest.mergeStateStatus",
		errors,
	);
	validateNullableString(value.url, "pullRequest.url", errors);
}

function validateArtifactsState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("artifacts must be an object", "artifacts"));
		return;
	}
	validateNullableString(value.activeSpec, "artifacts.activeSpec", errors);
	validateNullableString(value.activePlan, "artifacts.activePlan", errors);
	validateEnum(
		value.status,
		"artifacts.status",
		VALID_ARTIFACT_STATUSES,
		errors,
	);
	validateStringArray(value.staleRefs, "artifacts.staleRefs", errors);
}

function validateLinearState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("linear must be an object", "linear"));
		return;
	}
	validateNullableString(value.issueKey, "linear.issueKey", errors);
	validateEnum(value.freshness, "linear.freshness", VALID_FRESHNESS, errors);
	validateOptionalNullableString(value.status, "linear.status", errors);
	validateOptionalNullableString(value.statusType, "linear.statusType", errors);
	validateOptionalNullableString(value.url, "linear.url", errors);
	validateNullableString(value.actionRequired, "linear.actionRequired", errors);
}

function validatePhaseExitState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("phaseExit must be an object", "phaseExit"));
		return;
	}
	validateEnum(
		value.status,
		"phaseExit.status",
		VALID_PHASE_EXIT_STATUSES,
		errors,
	);
	validateNullableString(value.reason, "phaseExit.reason", errors);
}

function validateSources(value: unknown, errors: HeValidationError[]): void {
	if (!Array.isArray(value)) {
		errors.push(toValidationError("sources must be an array", "sources"));
		return;
	}
	for (const [index, source] of value.entries()) {
		const field = `sources.${String(index)}`;
		if (!isRecord(source)) {
			errors.push(toValidationError(`${field} must be an object`, field));
			continue;
		}
		validateEnum(source.kind, `${field}.kind`, VALID_SOURCE_KINDS, errors);
		validateString(source.ref, `${field}.ref`, errors);
		validateEnum(
			source.freshness,
			`${field}.freshness`,
			VALID_FRESHNESS,
			errors,
		);
		validateEnum(
			source.status,
			`${field}.status`,
			VALID_SOURCE_STATUSES,
			errors,
		);
		validateNullableString(
			source.failureClass,
			`${field}.failureClass`,
			errors,
		);
	}
}

/** Validate an unknown value as a runtime-card/v1 artifact. */
export function validateRuntimeCard(
	value: unknown,
): RuntimeCardValidationResult {
	const errors: HeValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("runtime card must be an object")],
		};
	}

	if (value.schemaVersion !== RUNTIME_CARD_SCHEMA_VERSION) {
		errors.push(
			toValidationError(
				`schemaVersion must be ${RUNTIME_CARD_SCHEMA_VERSION}`,
				"schemaVersion",
			),
		);
	}
	validateString(value.generatedAt, "generatedAt", errors);
	validateNullableString(value.issueKey, "issueKey", errors);
	validateEnum(value.lifecycle, "lifecycle", VALID_LIFECYCLES, errors);
	validateString(value.summary, "summary", errors);
	validateString(value.nextSafeAction, "nextSafeAction", errors);
	validateBranchState(value.branch, errors);
	validatePullRequestState(value.pullRequest, errors);
	validateArtifactsState(value.artifacts, errors);
	validateLinearState(value.linear, errors);
	validatePhaseExitState(value.phaseExit, errors);
	validateSources(value.sources, errors);
	validateStringArray(value.blockers, "blockers", errors);

	return { valid: errors.length === 0, errors };
}

/** Return true when runtime card evidence says the caller must stop first. */
export function runtimeCardBlocksContinuation(card: RuntimeCard): boolean {
	return card.blockers.length > 0 || BLOCKING_LIFECYCLES.has(card.lifecycle);
}

/** Build a compact metadata payload for HarnessDecision.meta.runtimeCard. */
export function normaliseRuntimeCard(
	card: RuntimeCard,
): Record<string, unknown> {
	return {
		schemaVersion: card.schemaVersion,
		issueKey: card.issueKey,
		lifecycle: card.lifecycle,
		summary: card.summary,
		nextSafeAction: card.nextSafeAction,
		branch: card.branch,
		pullRequest: card.pullRequest,
		artifacts: card.artifacts,
		linear: card.linear,
		phaseExit: card.phaseExit,
		blockers: card.blockers,
		sourceCount: card.sources.length,
		sources: card.sources,
	};
}
