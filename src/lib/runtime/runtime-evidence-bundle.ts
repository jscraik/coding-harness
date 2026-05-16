import type {
	HePhaseExit,
	HeValidationError,
} from "../decision/he-phase-exit.js";
import { validateHePhaseExit } from "../decision/he-phase-exit.js";
import {
	isRecord,
	toValidationError,
	validateEnum,
	validateNullableString,
	validateString,
	validateStringArray,
} from "../decision/validators.js";
import type {
	RuntimeCard,
	RuntimeCardFreshness,
	RuntimeCardSource,
	RuntimeCardSourceKind,
	RuntimeCardSourceStatus,
} from "./runtime-card.js";

/** Schema version for normalized external evidence admitted into runtime-card/v1. */
export const RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION =
	"runtime-evidence-bundle/v1" as const;

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

/** Provenance for a normalized runtime evidence bundle. */
export interface RuntimeEvidenceBundleProvenance {
	/** Producer family, for example session_collector, manual, or ci. */
	kind: "session_collector" | "manual" | "ci" | "runtime_card_adapter";
	/** Stable source reference such as an artifact path, run id, or command. */
	ref: string;
	/** Collection timestamp when known. */
	collectedAt: string | null;
}

/** Normalized evidence bundle consumed by runtime-card generation. */
export interface RuntimeEvidenceBundle {
	/** Schema version for this adapter contract. */
	schemaVersion: typeof RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION;
	/** Creation time for the normalized bundle. */
	generatedAt: string;
	/** Optional tracker key carried by the source. */
	issueKey: string | null;
	/** Source provenance without raw collector storage details. */
	provenance: RuntimeEvidenceBundleProvenance;
	/** Optional PR state from the source. */
	pullRequest?: RuntimeCard["pullRequest"];
	/** Optional Linear or tracker state from the source. */
	linear?: RuntimeCard["linear"];
	/** Optional full phase-exit artifact to collapse into runtime-card status. */
	phaseExit?: HePhaseExit;
	/** Normalized source refs inspected by the upstream collector or adapter. */
	sources: RuntimeCardSource[];
	/** Blocking conditions reported by the upstream collector or adapter. */
	blockers: string[];
}

/** Validation result for runtime-evidence-bundle/v1. */
export interface RuntimeEvidenceBundleValidationResult {
	/** Whether the value satisfies the normalized evidence bundle contract. */
	valid: boolean;
	/** Contract errors found while validating the bundle. */
	errors: HeValidationError[];
}

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

function validatePullRequestState(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (value === undefined) return;
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	validateNullableNumber(value.number, `${field}.number`, errors);
	validateNullableString(value.state, `${field}.state`, errors);
	validateNullableBoolean(value.isDraft, `${field}.isDraft`, errors);
	validateNullableString(
		value.mergeStateStatus,
		`${field}.mergeStateStatus`,
		errors,
	);
	validateNullableString(value.url, `${field}.url`, errors);
}

function validateLinearState(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (value === undefined) return;
	if (!isRecord(value)) {
		errors.push(toValidationError(`${field} must be an object`, field));
		return;
	}
	validateNullableString(value.issueKey, `${field}.issueKey`, errors);
	validateEnum(value.freshness, `${field}.freshness`, VALID_FRESHNESS, errors);
	validateOptionalNullableString(value.status, `${field}.status`, errors);
	validateOptionalNullableString(
		value.statusType,
		`${field}.statusType`,
		errors,
	);
	validateOptionalNullableString(value.url, `${field}.url`, errors);
	validateNullableString(
		value.actionRequired,
		`${field}.actionRequired`,
		errors,
	);
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

function validateProvenance(value: unknown, errors: HeValidationError[]): void {
	if (!isRecord(value)) {
		errors.push(
			toValidationError("provenance must be an object", "provenance"),
		);
		return;
	}
	validateEnum(
		value.kind,
		"provenance.kind",
		["session_collector", "manual", "ci", "runtime_card_adapter"],
		errors,
	);
	validateString(value.ref, "provenance.ref", errors);
	validateNullableString(value.collectedAt, "provenance.collectedAt", errors);
}

/** Validate an unknown value as a runtime-evidence-bundle/v1 artifact. */
export function validateRuntimeEvidenceBundle(
	value: unknown,
): RuntimeEvidenceBundleValidationResult {
	const errors: HeValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("runtime evidence bundle must be an object")],
		};
	}
	if (value.schemaVersion !== RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION) {
		errors.push(
			toValidationError(
				`schemaVersion must be ${RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION}`,
				"schemaVersion",
			),
		);
	}
	validateString(value.generatedAt, "generatedAt", errors);
	validateNullableString(value.issueKey, "issueKey", errors);
	validateProvenance(value.provenance, errors);
	validatePullRequestState(value.pullRequest, "pullRequest", errors);
	validateLinearState(value.linear, "linear", errors);
	if (value.phaseExit !== undefined) {
		const phaseExit = validateHePhaseExit(value.phaseExit);
		for (const error of phaseExit.errors) {
			errors.push({
				...error,
				path: error.path ? `phaseExit.${error.path}` : "phaseExit",
			});
		}
	}
	validateSources(value.sources, errors);
	validateStringArray(value.blockers, "blockers", errors);
	return { valid: errors.length === 0, errors };
}

/** Cast a validated runtime-evidence-bundle/v1 candidate. */
export function asRuntimeEvidenceBundle(value: unknown): RuntimeEvidenceBundle {
	const validation = validateRuntimeEvidenceBundle(value);
	if (!validation.valid) {
		throw new Error(
			"runtime evidence bundle failed validation: " +
				validation.errors.map((error) => error.code).join("; "),
		);
	}
	return value as RuntimeEvidenceBundle;
}
