import * as path from "node:path";
import {
	PROMPT_CONTEXT_DRIFT_EVIDENCE_USES,
	PROMPT_CONTEXT_DRIFT_FRESHNESS,
	PROMPT_CONTEXT_DRIFT_REF_KINDS,
	PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION,
	PROMPT_CONTEXT_DRIFT_STATUSES,
	PROMPT_CONTEXT_DRIFT_SURFACES,
	type PromptContextDriftValidationOptions,
	type PromptContextDriftValidationResult,
} from "./prompt-context-drift-types.js";
import {
	validateClaimSupportReport,
	validateRepoFileRef,
} from "./prompt-context-drift-validation-evidence.js";
import {
	fail,
	isRecord,
	requireFields,
	result,
	validateBlockers,
	validateBoolean,
	validateEnum,
	validateKnownKeys,
	validateNoRawOrSecretContent,
	validateNullableHead,
	validatePointer,
	validateRepoRef,
	validateText,
	validateTimestamp,
} from "./prompt-context-drift-validation-utils.js";

const SHA256 = /^[0-9a-f]{64}$/u;
const REPORT_KEYS = new Set([
	"schemaVersion",
	"generatedAt",
	"producer",
	"repoRootRef",
	"currentHeadSha",
	"evidenceUse",
	"overallStatus",
	"surfaces",
	"blockers",
	"nextAction",
]);
const SURFACE_KEYS = new Set([
	"surfaceId",
	"status",
	"evidenceUse",
	"freshness",
	"requiredForClaimSupport",
	"observedHeadSha",
	"currentHeadSha",
	"sourceRefs",
	"blockers",
]);
const REF_KEYS = new Set([
	"refId",
	"surfaceId",
	"refKind",
	"ref",
	"hashAlgorithm",
	"sha256",
	"freshness",
	"evidenceUse",
	"requiredForClaimSupport",
	"requiresFilesystemExistence",
]);

/** Validate a prompt-context drift report beyond JSON Schema shape checks. */
export function validatePromptContextDriftReport(
	report: unknown,
	options: PromptContextDriftValidationOptions = {},
): PromptContextDriftValidationResult {
	const errors: string[] = [];
	validateNoRawOrSecretContent(report, "report", errors);
	if (!isRecord(report))
		return result([...errors, "report: must be an object"]);
	validateKnownKeys(report, REPORT_KEYS, "report", errors);
	requireFields(report, REPORT_KEYS, "report", errors);
	validateReportScalars(report, errors);
	validateReportCollections(report, options, errors);
	return result(errors);
}

function validateReportScalars(
	report: Record<string, unknown>,
	errors: string[],
): void {
	if (report.schemaVersion !== PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION) {
		errors.push(
			`schemaVersion: must be ${PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION}`,
		);
	}
	validateTimestamp(report.generatedAt, "generatedAt", errors);
	validatePointer(report.producer, "producer", errors);
	validatePointer(report.repoRootRef, "repoRootRef", errors);
	validateNullableHead(report.currentHeadSha, "currentHeadSha", errors);
	validateEnum(
		report.evidenceUse,
		PROMPT_CONTEXT_DRIFT_EVIDENCE_USES,
		"evidenceUse",
		errors,
	);
	validateEnum(
		report.overallStatus,
		PROMPT_CONTEXT_DRIFT_STATUSES,
		"overallStatus",
		errors,
	);
	validateText(report.nextAction, "nextAction", errors, 512);
}

function validateReportCollections(
	report: Record<string, unknown>,
	options: PromptContextDriftValidationOptions,
	errors: string[],
): void {
	validateBlockers(report.blockers, "blockers", errors);
	if (!Array.isArray(report.surfaces)) {
		errors.push("surfaces: must be an array");
		return;
	}
	const repoRoot = options.repoRoot
		? path.resolve(options.repoRoot)
		: undefined;
	const seen = new Map<string, Record<string, unknown>>();
	report.surfaces.forEach((surface, index) => {
		validateSurface(surface, `surfaces[${index}]`, report, repoRoot, errors);
		recordSurface(surface, index, seen, errors);
	});
	if (report.evidenceUse === "claim_support")
		validateClaimSupportReport(report, seen, errors);
}

function recordSurface(
	surface: unknown,
	index: number,
	seen: Map<string, Record<string, unknown>>,
	errors: string[],
): void {
	if (!isRecord(surface) || typeof surface.surfaceId !== "string") return;
	if (!seen.has(surface.surfaceId)) {
		seen.set(surface.surfaceId, surface);
		return;
	}
	errors.push(
		`surfaces[${index}].surfaceId: duplicate surface ${surface.surfaceId}`,
	);
}

function validateSurface(
	surface: unknown,
	path: string,
	report: Record<string, unknown>,
	repoRoot: string | undefined,
	errors: string[],
): void {
	if (!isRecord(surface)) {
		errors.push(`${path}: must be an object`);
		return;
	}
	validateKnownKeys(surface, SURFACE_KEYS, path, errors);
	requireFields(surface, SURFACE_KEYS, path, errors);
	validateSurfaceShape(surface, path, errors);
	validateSurfaceHeads(surface, path, report, errors);
	validateRefs(
		surface.sourceRefs,
		`${path}.sourceRefs`,
		surface,
		repoRoot,
		errors,
	);
	validateBlockers(surface.blockers, `${path}.blockers`, errors);
	validateSurfaceClaimSupport(surface, path, errors);
}

function validateSurfaceShape(
	surface: Record<string, unknown>,
	path: string,
	errors: string[],
): void {
	validateEnum(
		surface.surfaceId,
		PROMPT_CONTEXT_DRIFT_SURFACES,
		`${path}.surfaceId`,
		errors,
	);
	validateEnum(
		surface.status,
		PROMPT_CONTEXT_DRIFT_STATUSES,
		`${path}.status`,
		errors,
	);
	validateEnum(
		surface.evidenceUse,
		PROMPT_CONTEXT_DRIFT_EVIDENCE_USES,
		`${path}.evidenceUse`,
		errors,
	);
	validateEnum(
		surface.freshness,
		PROMPT_CONTEXT_DRIFT_FRESHNESS,
		`${path}.freshness`,
		errors,
	);
	validateBoolean(
		surface.requiredForClaimSupport,
		`${path}.requiredForClaimSupport`,
		errors,
	);
	validateNullableHead(
		surface.observedHeadSha,
		`${path}.observedHeadSha`,
		errors,
	);
	validateNullableHead(
		surface.currentHeadSha,
		`${path}.currentHeadSha`,
		errors,
	);
}

function validateSurfaceHeads(
	surface: Record<string, unknown>,
	path: string,
	report: Record<string, unknown>,
	errors: string[],
): void {
	if (hasUnexpectedHeadMismatch(surface, report)) {
		errors.push(`${path}.observedHeadSha: must match currentHeadSha`);
	}
	if (
		report.currentHeadSha &&
		surface.currentHeadSha &&
		report.currentHeadSha !== surface.currentHeadSha
	) {
		errors.push(`${path}.currentHeadSha: must match report currentHeadSha`);
	}
}

function hasUnexpectedHeadMismatch(
	surface: Record<string, unknown>,
	report: Record<string, unknown>,
): boolean {
	if (!surface.observedHeadSha || !surface.currentHeadSha) return false;
	if (surface.observedHeadSha === surface.currentHeadSha) return false;
	return !allowsHeadMismatchDriftSurface(surface, report);
}

function allowsHeadMismatchDriftSurface(
	surface: Record<string, unknown>,
	report: Record<string, unknown>,
): boolean {
	return (
		report.evidenceUse !== "claim_support" &&
		surface.evidenceUse !== "claim_support" &&
		surface.requiredForClaimSupport !== true &&
		surface.status !== "pass" &&
		surface.freshness === "stale" &&
		Array.isArray(surface.blockers) &&
		surface.blockers.some(
			(blocker) =>
				isRecord(blocker) && blocker.blockerClass === "head_sha_mismatch",
		)
	);
}

function validateSurfaceClaimSupport(
	surface: Record<string, unknown>,
	path: string,
	errors: string[],
): void {
	if (
		surface.requiredForClaimSupport !== true ||
		surface.evidenceUse !== "claim_support"
	)
		return;
	if (surface.status !== "pass")
		errors.push(`${path}.status: claim support requires pass`);
	if (surface.freshness !== "current")
		errors.push(`${path}.freshness: claim support requires current`);
	if (Array.isArray(surface.blockers) && surface.blockers.length > 0) {
		errors.push(`${path}.blockers: claim support requires no blockers`);
	}
}

function validateRefs(
	refs: unknown,
	path: string,
	surface: Record<string, unknown>,
	repoRoot: string | undefined,
	errors: string[],
): void {
	if (!Array.isArray(refs)) {
		errors.push(`${path}: must be an array`);
		return;
	}
	const verified = refs.filter((ref, index) =>
		validateRef(ref, `${path}[${index}]`, surface, repoRoot, errors),
	).length;
	if (
		surface.requiredForClaimSupport === true &&
		surface.evidenceUse === "claim_support" &&
		verified === 0
	) {
		errors.push(
			path +
				": claim support requires at least one repo-contained hash-verified ref for " +
				String(surface.surfaceId),
		);
	}
}

function validateRef(
	ref: unknown,
	path: string,
	surface: Record<string, unknown>,
	repoRoot: string | undefined,
	errors: string[],
): boolean {
	if (!isRecord(ref)) return fail(errors, `${path}: must be an object`);
	validateKnownKeys(ref, REF_KEYS, path, errors);
	requireFields(ref, REF_KEYS, path, errors);
	validateRefShape(ref, path, surface, errors);
	if (ref.requiredForClaimSupport === true) validateClaimRef(ref, path, errors);
	if (ref.requiresFilesystemExistence !== true) return false;
	if (!repoRoot)
		return fail(
			errors,
			`${path}.ref: repoRoot is required when requiresFilesystemExistence=true`,
		);
	return validateRepoFileRef(ref, path, repoRoot, errors);
}

function validateRefShape(
	ref: Record<string, unknown>,
	path: string,
	surface: Record<string, unknown>,
	errors: string[],
): void {
	validatePointer(ref.refId, `${path}.refId`, errors);
	validateEnum(
		ref.surfaceId,
		PROMPT_CONTEXT_DRIFT_SURFACES,
		`${path}.surfaceId`,
		errors,
	);
	if (ref.surfaceId !== surface.surfaceId)
		errors.push(`${path}.surfaceId: must match parent surfaceId`);
	validateEnum(
		ref.refKind,
		PROMPT_CONTEXT_DRIFT_REF_KINDS,
		`${path}.refKind`,
		errors,
	);
	validateRepoRef(ref.ref, `${path}.ref`, errors);
	validateEnum(
		ref.freshness,
		PROMPT_CONTEXT_DRIFT_FRESHNESS,
		`${path}.freshness`,
		errors,
	);
	validateEnum(
		ref.evidenceUse,
		PROMPT_CONTEXT_DRIFT_EVIDENCE_USES,
		`${path}.evidenceUse`,
		errors,
	);
	validateBoolean(
		ref.requiredForClaimSupport,
		`${path}.requiredForClaimSupport`,
		errors,
	);
	validateBoolean(
		ref.requiresFilesystemExistence,
		`${path}.requiresFilesystemExistence`,
		errors,
	);
}

function validateClaimRef(
	ref: Record<string, unknown>,
	path: string,
	errors: string[],
): void {
	if (ref.hashAlgorithm !== "sha256")
		errors.push(`${path}.hashAlgorithm: claim support requires sha256`);
	if (!SHA256.test(String(ref.sha256)))
		errors.push(`${path}.sha256: claim support requires sha256 digest`);
	if (ref.freshness !== "current")
		errors.push(`${path}.freshness: claim support requires current`);
	if (ref.evidenceUse !== "claim_support")
		errors.push(`${path}.evidenceUse: claim support ref must be claim_support`);
}
