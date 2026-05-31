import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export const PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION =
	"prompt-context-drift-report/v1" as const;

export const PROMPT_CONTEXT_DRIFT_STATUSES = [
	"pass",
	"warn",
	"fail",
	"blocked",
] as const;

export const PROMPT_CONTEXT_DRIFT_EVIDENCE_USES = [
	"orientation",
	"audit_trail",
	"claim_support",
] as const;

export const PROMPT_CONTEXT_DRIFT_FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
] as const;

export const PROMPT_CONTEXT_DRIFT_SURFACES = [
	"prompt_context",
	"active_artifacts",
	"active_route",
	"project_brain_memory",
	"project_brain_knowledge",
	"runtime_card_or_handoff",
	"receipt_head_sha",
] as const;

export const PROMPT_CONTEXT_DRIFT_REF_KINDS = [
	"repo_file",
	"prompt_context_receipt",
	"runtime_card",
	"receipt",
	"external_metadata",
] as const;

export const PROMPT_CONTEXT_DRIFT_BLOCKER_CLASSES = [
	"none",
	"stale_prompt_context",
	"stale_active_route",
	"missing_project_brain_ref",
	"stale_project_brain_ref",
	"stale_runtime_card",
	"advisory_runtime_card",
	"head_sha_mismatch",
	"missing_source_hash",
	"digest_mismatch",
	"external_only_required_surface",
	"unsafe_ref",
	"raw_or_secret_content",
	"unknown_schema_field",
] as const;

export const PROMPT_CONTEXT_DRIFT_NEXT_ACTION_CLASSES = [
	"none",
	"refresh_prompt_context",
	"refresh_active_artifacts",
	"refresh_project_brain",
	"refresh_runtime_card",
	"refresh_receipts",
	"rerun_validator",
] as const;

/** Overall or per-surface status emitted by a prompt-context drift report. */
export type PromptContextDriftStatus =
	(typeof PROMPT_CONTEXT_DRIFT_STATUSES)[number];
/** How report evidence may be used by downstream cockpit or claim logic. */
export type PromptContextDriftEvidenceUse =
	(typeof PROMPT_CONTEXT_DRIFT_EVIDENCE_USES)[number];
/** Freshness classification for a context surface or source reference. */
export type PromptContextDriftFreshness =
	(typeof PROMPT_CONTEXT_DRIFT_FRESHNESS)[number];
/** Stable identifier for a context surface that can drift from live execution. */
export type PromptContextDriftSurfaceId =
	(typeof PROMPT_CONTEXT_DRIFT_SURFACES)[number];
/** Kind of pointer used to prove a context surface without embedding raw content. */
export type PromptContextDriftRefKind =
	(typeof PROMPT_CONTEXT_DRIFT_REF_KINDS)[number];
/** Machine-readable reason a report or surface cannot support a claim. */
export type PromptContextDriftBlockerClass =
	(typeof PROMPT_CONTEXT_DRIFT_BLOCKER_CLASSES)[number];
/** Recommended refresh or repair lane for the blocking condition. */
export type PromptContextDriftNextActionClass =
	(typeof PROMPT_CONTEXT_DRIFT_NEXT_ACTION_CLASSES)[number];

/** Pointer to the repo-local artifact or metadata backing one context surface. */
export interface PromptContextDriftRef {
	refId: string;
	surfaceId: PromptContextDriftSurfaceId;
	refKind: PromptContextDriftRefKind;
	ref: string;
	hashAlgorithm: "sha256" | null;
	sha256: string | null;
	freshness: PromptContextDriftFreshness;
	evidenceUse: PromptContextDriftEvidenceUse;
	requiredForClaimSupport: boolean;
	requiresFilesystemExistence: boolean;
}

/** Blocking condition that prevents prompt-context evidence from supporting a claim. */
export interface PromptContextDriftBlocker {
	blockerClass: PromptContextDriftBlockerClass;
	reason: string;
	nextActionClass: PromptContextDriftNextActionClass;
}

/** Drift status for one required or advisory context surface. */
export interface PromptContextDriftSurface {
	surfaceId: PromptContextDriftSurfaceId;
	status: PromptContextDriftStatus;
	evidenceUse: PromptContextDriftEvidenceUse;
	freshness: PromptContextDriftFreshness;
	requiredForClaimSupport: boolean;
	observedHeadSha: string | null;
	currentHeadSha: string | null;
	sourceRefs: PromptContextDriftRef[];
	blockers: PromptContextDriftBlocker[];
}

/** Full prompt-context drift report consumed by agent-readiness and validators. */
export interface PromptContextDriftReport {
	schemaVersion: typeof PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION;
	generatedAt: string;
	producer: string;
	repoRootRef: string;
	currentHeadSha: string | null;
	evidenceUse: PromptContextDriftEvidenceUse;
	overallStatus: PromptContextDriftStatus;
	surfaces: PromptContextDriftSurface[];
	blockers: PromptContextDriftBlocker[];
	nextAction: string;
}

/** Validation result for semantic prompt-context drift report checks. */
export interface PromptContextDriftValidationResult {
	status: "pass" | "fail";
	errors: string[];
}

/** Options that bind prompt-context drift validation to a repository root. */
export interface PromptContextDriftValidationOptions {
	repoRoot?: string | undefined;
	now?: Date | undefined;
}

const HEAD_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const POINTER = /^[A-Za-z0-9][A-Za-z0-9:._/@#?=&+,-]{0,255}$/u;
const RFC3339 =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const SAFE_REPO_REF = /^(?:[A-Za-z0-9._@+-]+\/)*[A-Za-z0-9._@+-]+$/u;
const RAW_OR_SECRET_KEY =
	/(raw|promptText|transcript|commandOutput|toolPayload|payload|screenshot|image|secret|token|password|credential|apiKey|privateKey)/iu;
const RAW_OR_SECRET_VALUE =
	/(sk-[A-Za-z0-9_-]{20,}|gh[opsru]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|Bearer\s+[A-Za-z0-9._~+/-]{20,}=*|BEGIN PRIVATE KEY|(?:token|secret|password|credential)=|raw prompt|full transcript|command output)/iu;

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
const BLOCKER_KEYS = new Set(["blockerClass", "reason", "nextActionClass"]);

/** Validate a prompt-context drift report beyond JSON Schema shape checks. */
export function validatePromptContextDriftReport(
	report: unknown,
	options: PromptContextDriftValidationOptions = {},
): PromptContextDriftValidationResult {
	const errors: string[] = [];
	validateNoRawOrSecretContent(report, "report", errors);
	if (!isRecord(report)) {
		errors.push("report: must be an object");
		return result(errors);
	}

	validateKnownKeys(report, REPORT_KEYS, "report", errors);
	requireFields(report, REPORT_KEYS, "report", errors);
	validateReportFields(report, options, errors);
	return result(errors);
}

function validateReportFields(
	report: Record<string, unknown>,
	options: PromptContextDriftValidationOptions,
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
	validateBlockers(report.blockers, "blockers", errors);
	if (!Array.isArray(report.surfaces))
		return void errors.push("surfaces: must be an array");
	const repoRoot = options.repoRoot ? resolve(options.repoRoot) : undefined;
	const surfaceRecords = new Map<string, Record<string, unknown>>();
	for (const [index, surface] of report.surfaces.entries()) {
		validateSurface(surface, `surfaces[${index}]`, report, repoRoot, errors);
		if (!isRecord(surface) || typeof surface.surfaceId !== "string") continue;
		if (!surfaceRecords.has(surface.surfaceId)) {
			surfaceRecords.set(surface.surfaceId, surface);
			continue;
		}
		errors.push(
			`surfaces[${index}].surfaceId: duplicate surface ${surface.surfaceId}`,
		);
	}
	if (report.evidenceUse === "claim_support")
		validateClaimSupportReport(report, surfaceRecords, errors);
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
	if (
		surface.observedHeadSha &&
		surface.currentHeadSha &&
		surface.observedHeadSha !== surface.currentHeadSha &&
		!allowsHeadMismatchDriftSurface(surface, report)
	) {
		errors.push(`${path}.observedHeadSha: must match currentHeadSha`);
	}
	if (
		report.currentHeadSha &&
		surface.currentHeadSha &&
		report.currentHeadSha !== surface.currentHeadSha
	) {
		errors.push(`${path}.currentHeadSha: must match report currentHeadSha`);
	}
	validateRefs(
		surface.sourceRefs,
		`${path}.sourceRefs`,
		surface,
		repoRoot,
		errors,
	);
	validateBlockers(surface.blockers, `${path}.blockers`, errors);
	if (
		surface.requiredForClaimSupport === true &&
		surface.evidenceUse === "claim_support"
	) {
		if (surface.status !== "pass") {
			errors.push(`${path}.status: claim support requires pass`);
		}
		if (surface.freshness !== "current") {
			errors.push(`${path}.freshness: claim support requires current`);
		}
		if (Array.isArray(surface.blockers) && surface.blockers.length > 0) {
			errors.push(`${path}.blockers: claim support requires no blockers`);
		}
	}
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
	let verifiedRequiredLocalRefs = 0;
	for (const [index, ref] of refs.entries()) {
		const verified = validateRef(
			ref,
			`${path}[${index}]`,
			surface,
			repoRoot,
			errors,
		);
		if (verified) verifiedRequiredLocalRefs += 1;
	}
	if (
		surface.requiredForClaimSupport === true &&
		surface.evidenceUse === "claim_support" &&
		verifiedRequiredLocalRefs === 0
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
	if (!isRecord(ref)) {
		errors.push(`${path}: must be an object`);
		return false;
	}
	validateKnownKeys(ref, REF_KEYS, path, errors);
	requireFields(ref, REF_KEYS, path, errors);
	validatePointer(ref.refId, `${path}.refId`, errors);
	validateEnum(
		ref.surfaceId,
		PROMPT_CONTEXT_DRIFT_SURFACES,
		`${path}.surfaceId`,
		errors,
	);
	if (ref.surfaceId !== surface.surfaceId) {
		errors.push(`${path}.surfaceId: must match parent surfaceId`);
	}
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
	if (ref.requiredForClaimSupport === true) {
		if (ref.hashAlgorithm !== "sha256") {
			errors.push(`${path}.hashAlgorithm: claim support requires sha256`);
		}
		if (!SHA256.test(String(ref.sha256))) {
			errors.push(`${path}.sha256: claim support requires sha256 digest`);
		}
		if (ref.freshness !== "current") {
			errors.push(`${path}.freshness: claim support requires current`);
		}
		if (ref.evidenceUse !== "claim_support") {
			errors.push(
				`${path}.evidenceUse: claim support ref must be claim_support`,
			);
		}
	}
	if (ref.requiresFilesystemExistence === true) {
		if (!repoRoot) {
			errors.push(
				`${path}.ref: repoRoot is required when requiresFilesystemExistence=true`,
			);
			return false;
		}
		return validateRepoFileRef(ref, path, repoRoot, errors);
	}
	return false;
}

function validateRepoFileRef(
	ref: Record<string, unknown>,
	path: string,
	repoRoot: string,
	errors: string[],
): boolean {
	if (ref.refKind !== "repo_file") {
		if (ref.requiredForClaimSupport === true) {
			errors.push(`${path}.refKind: required local evidence must be repo_file`);
		}
		return false;
	}
	const refPath = String(ref.ref);
	let resolvedRepoRoot: string;
	try {
		resolvedRepoRoot = realpathSync(repoRoot);
	} catch {
		errors.push(`${path}.ref: repository root is not accessible`);
		return false;
	}
	const candidate = resolve(resolvedRepoRoot, refPath);
	if (!existsSync(candidate)) {
		errors.push(`${path}.ref: required repo file does not exist`);
		return false;
	}
	let realCandidate: string;
	try {
		realCandidate = realpathSync(candidate);
	} catch {
		errors.push(`${path}.ref: required repo file does not exist`);
		return false;
	}
	const containment = relative(resolvedRepoRoot, realCandidate);
	if (containment.startsWith("..") || isAbsolute(containment)) {
		errors.push(`${path}.ref: resolved path escapes repository root`);
		return false;
	}
	try {
		if (!statSync(realCandidate).isFile()) {
			errors.push(`${path}.ref: required repo file is not a file`);
			return false;
		}
	} catch {
		errors.push(`${path}.ref: required repo file is not accessible`);
		return false;
	}
	if (ref.hashAlgorithm !== "sha256" || !SHA256.test(String(ref.sha256))) {
		return false;
	}
	let content: Buffer;
	try {
		content = readFileSync(realCandidate);
	} catch {
		errors.push(`${path}.ref: required repo file is not readable`);
		return false;
	}
	const actual = createHash("sha256").update(content).digest("hex");
	if (actual !== ref.sha256) {
		errors.push(`${path}.sha256: digest mismatch`);
		return false;
	}
	return ref.requiredForClaimSupport === true;
}

function validateClaimSupportReport(
	report: Record<string, unknown>,
	surfaceRecords: Map<string, Record<string, unknown>>,
	errors: string[],
): void {
	if (report.overallStatus !== "pass") {
		errors.push("overallStatus: claim support requires pass");
	}
	if (!HEAD_SHA.test(String(report.currentHeadSha))) {
		errors.push("currentHeadSha: claim support requires current head SHA");
	}
	if (Array.isArray(report.blockers) && report.blockers.length > 0) {
		errors.push("blockers: claim support requires no report blockers");
	}
	for (const surface of PROMPT_CONTEXT_DRIFT_SURFACES) {
		const surfaceRecord = surfaceRecords.get(surface);
		if (!surfaceRecord) {
			errors.push(`surfaces: missing required local surface ${surface}`);
			continue;
		}
		if (surfaceRecord.requiredForClaimSupport !== true) {
			errors.push(
				`surfaces: required local surface ${surface} must set requiredForClaimSupport true`,
			);
		}
		if (surfaceRecord.evidenceUse !== "claim_support") {
			errors.push(
				`surfaces: required local surface ${surface} must use claim_support evidence`,
			);
		}
		if (surfaceRecord.status !== "pass") {
			errors.push(`surfaces: required local surface ${surface} must pass`);
		}
		if (surfaceRecord.freshness !== "current") {
			errors.push(
				`surfaces: required local surface ${surface} must be current`,
			);
		}
		if (
			Array.isArray(surfaceRecord.blockers) &&
			surfaceRecord.blockers.length > 0
		) {
			errors.push(
				`surfaces: required local surface ${surface} must not have blockers`,
			);
		}
		if (!hasClaimSupportLocalRef(surfaceRecord)) {
			errors.push(
				`surfaces: required local surface ${surface} requires at least one repo-file claim-support ref with current sha256 evidence`,
			);
		}
	}
}

function hasClaimSupportLocalRef(surface: Record<string, unknown>): boolean {
	if (!Array.isArray(surface.sourceRefs)) return false;
	return surface.sourceRefs.some(
		(ref) =>
			isRecord(ref) &&
			ref.refKind === "repo_file" &&
			ref.requiredForClaimSupport === true &&
			ref.requiresFilesystemExistence === true &&
			ref.evidenceUse === "claim_support" &&
			ref.freshness === "current" &&
			ref.hashAlgorithm === "sha256" &&
			SHA256.test(String(ref.sha256)),
	);
}

function validateBlockers(
	blockers: unknown,
	path: string,
	errors: string[],
): void {
	if (!Array.isArray(blockers)) {
		errors.push(`${path}: must be an array`);
		return;
	}
	for (const [index, blocker] of blockers.entries()) {
		const blockerPath = `${path}[${index}]`;
		if (!isRecord(blocker)) {
			errors.push(`${blockerPath}: must be an object`);
			continue;
		}
		validateKnownKeys(blocker, BLOCKER_KEYS, blockerPath, errors);
		requireFields(blocker, BLOCKER_KEYS, blockerPath, errors);
		validateEnum(
			blocker.blockerClass,
			PROMPT_CONTEXT_DRIFT_BLOCKER_CLASSES,
			`${blockerPath}.blockerClass`,
			errors,
		);
		validateText(blocker.reason, `${blockerPath}.reason`, errors, 512);
		validateEnum(
			blocker.nextActionClass,
			PROMPT_CONTEXT_DRIFT_NEXT_ACTION_CLASSES,
			`${blockerPath}.nextActionClass`,
			errors,
		);
	}
}

function validateNoRawOrSecretContent(
	value: unknown,
	path: string,
	errors: string[],
): void {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			validateNoRawOrSecretContent(entry, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) {
		if (typeof value === "string" && RAW_OR_SECRET_VALUE.test(value)) {
			errors.push(`${path}: contains raw or secret-like content`);
		}
		return;
	}
	for (const [key, child] of Object.entries(value)) {
		const childPath = `${path}.${key}`;
		if (RAW_OR_SECRET_KEY.test(key)) {
			errors.push(`${childPath}: raw or secret-like field is forbidden`);
		}
		validateNoRawOrSecretContent(child, childPath, errors);
	}
}

function validateKnownKeys(
	value: Record<string, unknown>,
	allowed: Set<string>,
	path: string,
	errors: string[],
): void {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			errors.push(`${path}.${key}: unknown field`);
		}
	}
}

function requireFields(
	value: Record<string, unknown>,
	required: Set<string>,
	path: string,
	errors: string[],
): void {
	for (const key of required) {
		if (!(key in value)) {
			errors.push(`${path}.${key}: is required`);
		}
	}
}

function validateEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	errors: string[],
): void {
	if (!allowed.includes(String(value))) {
		errors.push(`${path}: invalid enum value`);
	}
}

function validateTimestamp(
	value: unknown,
	path: string,
	errors: string[],
): void {
	if (typeof value !== "string" || !RFC3339.test(value)) {
		errors.push(`${path}: must be RFC3339 date-time`);
	}
}

function validateNullableHead(
	value: unknown,
	path: string,
	errors: string[],
): void {
	if (value !== null && !HEAD_SHA.test(String(value))) {
		errors.push(`${path}: must be null or 40-character lowercase git SHA`);
	}
}

function validatePointer(
	value: unknown,
	path: string,
	errors: string[],
	maxLength = 256,
): void {
	if (
		typeof value !== "string" ||
		value.length > maxLength ||
		!POINTER.test(value)
	) {
		errors.push(`${path}: must be a safe pointer`);
	}
}

function validateText(
	value: unknown,
	path: string,
	errors: string[],
	maxLength: number,
): void {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > maxLength ||
		/[\r\n]/u.test(value)
	) {
		errors.push(`${path}: must be bounded single-line text`);
	}
}

function validateRepoRef(value: unknown, path: string, errors: string[]): void {
	if (typeof value !== "string" || !SAFE_REPO_REF.test(value)) {
		errors.push(`${path}: must be a safe repo-relative ref`);
		return;
	}
	if (
		value.includes("..") ||
		value.startsWith("/") ||
		value.startsWith("~") ||
		value.includes("://")
	) {
		errors.push(`${path}: unsafe ref path`);
	}
}

function validateBoolean(value: unknown, path: string, errors: string[]): void {
	if (typeof value !== "boolean") {
		errors.push(`${path}: must be boolean`);
	}
}

function result(errors: string[]): PromptContextDriftValidationResult {
	return { status: errors.length === 0 ? "pass" : "fail", errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
