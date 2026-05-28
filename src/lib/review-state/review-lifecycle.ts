import { validateEvidenceReceipt } from "../evidence/evidence-receipt.js";
import {
	REVIEW_LIFECYCLE_MODE_KINDS,
	REVIEW_LIFECYCLE_MODE_STATUSES,
	REVIEW_LIFECYCLE_SCHEMA_VERSION,
	REVIEW_LIFECYCLE_TOOL_CLASSES,
	REVIEW_LIFECYCLE_VERDICTS,
	type ReviewLifecycleValidationError,
	type ReviewLifecycleValidationResult,
} from "./review-lifecycle-contract.js";
import {
	addError,
	isRecord,
	rejectRawOrSensitiveKeys,
	requireAllowedKeys,
	requireEnum,
	requireHeadSha,
	requireIsoTimestamp,
	requireLiteral,
	requireNonNegativeInteger,
	requireNullableIso,
	requireNullableSafeText,
	requirePositiveInteger,
	requireSafeText,
} from "./review-lifecycle-validation-helpers.js";

const TOP_LEVEL_KEYS = new Set([
	"schemaVersion",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"sourceReviewStateRef",
	"sourceReviewState",
	"target",
	"mode",
	"reviewer",
	"toolExposure",
	"artifactLineage",
	"findings",
	"selectableComments",
	"unresolvedThreads",
	"coverage",
	"verdict",
]);

const SOURCE_REVIEW_STATE_KEYS = [
	"schemaVersion",
	"ref",
	"generatedAt",
	"headSha",
	"fetchReceiptRef",
	"reviewerArtifactRefs",
	"unresolvedThreadTotal",
] as const;

const TARGET_KEYS = [
	"repository",
	"prNumber",
	"url",
	"baseRef",
	"headRef",
	"headSha",
	"reviewStateHeadSha",
] as const;

const MODE_KEYS = ["kind", "status", "startedAt", "completedAt"] as const;

const REVIEWER_KEYS = ["role", "producer", "runManifestRef"] as const;

const TOOL_EXPOSURE_KEYS = ["sourceRef", "classes"] as const;

const TOOL_EXPOSURE_CLASS_KEYS = [
	"className",
	"statusCounts",
	"failureClass",
] as const;

const TOOL_EXPOSURE_COUNT_KEYS = [
	"visible",
	"deferred",
	"hidden",
	"unavailable",
	"policyBlocked",
] as const;

const ARTIFACT_LINEAGE_KEYS = [
	"role",
	"path",
	"producer",
	"runManifestRef",
	"receipt",
] as const;

const EVIDENCE_RECEIPT_KEYS = [
	"schemaVersion",
	"kind",
	"ref",
	"producer",
	"status",
	"freshness",
	"evidenceUse",
	"blockerClass",
	"producedAt",
	"verifiedAt",
	"headSha",
	"sizeBytes",
	"checksum",
] as const;

const FINDING_COUNT_KEYS = [
	"total",
	"blocking",
	"advisory",
	"resolved",
] as const;

const SELECTABLE_COMMENT_COUNT_KEYS = [
	"total",
	"selected",
	"unselected",
] as const;

const UNRESOLVED_THREAD_COUNT_KEYS = [
	"total",
	"needsHuman",
	"autofixable",
] as const;

const COVERAGE_KEYS = [
	"requiredRoles",
	"coveredRoles",
	"missingRoles",
] as const;

const VERDICT_KEYS = [
	"status",
	"blockerClass",
	"reason",
	"readyForReviewClaim",
] as const;

/** Validate ReviewLifecycle/v1 shape and semantic invariants. */
export function validateReviewLifecyclePacket(
	value: unknown,
): ReviewLifecycleValidationResult {
	const errors: ReviewLifecycleValidationError[] = [];
	if (!isRecord(value)) {
		addError(errors, "packet must be an object", "packet");
		return { valid: false, errors };
	}

	for (const key of Object.keys(value)) {
		if (!TOP_LEVEL_KEYS.has(key)) {
			addError(errors, "top-level field is not allowed", key);
		}
	}
	rejectRawOrSensitiveKeys(value, "packet", errors);

	requireLiteral(
		value.schemaVersion,
		REVIEW_LIFECYCLE_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireIsoTimestamp(value.generatedAt, "generatedAt", errors);
	requireSafeText(value.producer, "producer", errors);
	requireLiteral(
		value.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	requireEnum(
		value.evidenceUse,
		["orientation", "audit_trail"] as const,
		"evidenceUse",
		errors,
	);
	requireSafeText(value.sourceReviewStateRef, "sourceReviewStateRef", errors);
	validateSourceReviewState(
		value.sourceReviewState,
		value.sourceReviewStateRef,
		errors,
	);
	validateTarget(value.target, value.sourceReviewState, errors);
	validateMode(value.mode, errors);
	validateReviewer(value.reviewer, value.producer, errors);
	validateToolExposure(value.toolExposure, errors);
	validateArtifactLineage(
		value.artifactLineage,
		value.target,
		value.producer,
		errors,
	);
	validateCountSet(value.findings, "findings", FINDING_COUNT_KEYS, errors);
	validateCountSet(
		value.selectableComments,
		"selectableComments",
		SELECTABLE_COMMENT_COUNT_KEYS,
		errors,
	);
	validateCountSet(
		value.unresolvedThreads,
		"unresolvedThreads",
		UNRESOLVED_THREAD_COUNT_KEYS,
		errors,
	);
	validateUnresolvedThreadCounts(value.unresolvedThreads, errors);
	validateCoverage(
		value.coverage,
		value.artifactLineage,
		value.reviewer,
		errors,
	);
	validateVerdict(value, errors);

	return { valid: errors.length === 0, errors };
}

function validateSourceReviewState(
	value: unknown,
	sourceReviewStateRef: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!isRecord(value)) {
		addError(
			errors,
			"sourceReviewState must be an object",
			"sourceReviewState",
		);
		return;
	}
	requireAllowedKeys(
		value,
		SOURCE_REVIEW_STATE_KEYS,
		"sourceReviewState",
		errors,
	);
	requireLiteral(
		value.schemaVersion,
		"review-state/v1",
		"sourceReviewState.schemaVersion",
		errors,
	);
	requireSafeText(value.ref, "sourceReviewState.ref", errors);
	requireIsoTimestamp(
		value.generatedAt,
		"sourceReviewState.generatedAt",
		errors,
	);
	requireHeadSha(value.headSha, "sourceReviewState.headSha", errors);
	requireSafeText(
		value.fetchReceiptRef,
		"sourceReviewState.fetchReceiptRef",
		errors,
	);
	validateStringArray(
		value.reviewerArtifactRefs,
		"sourceReviewState.reviewerArtifactRefs",
		errors,
	);
	requireNonNegativeInteger(
		value.unresolvedThreadTotal,
		"sourceReviewState.unresolvedThreadTotal",
		errors,
	);
	if (
		typeof sourceReviewStateRef === "string" &&
		typeof value.ref === "string" &&
		sourceReviewStateRef !== value.ref
	) {
		addError(
			errors,
			"sourceReviewStateRef must match sourceReviewState.ref",
			"sourceReviewStateRef",
		);
	}
}

function validateTarget(
	value: unknown,
	sourceReviewState: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, "target must be an object", "target");
		return;
	}
	requireAllowedKeys(value, TARGET_KEYS, "target", errors);
	requireSafeText(value.repository, "target.repository", errors);
	requirePositiveInteger(value.prNumber, "target.prNumber", errors);
	requireSafeText(value.url, "target.url", errors);
	requireSafeText(value.baseRef, "target.baseRef", errors);
	requireSafeText(value.headRef, "target.headRef", errors);
	requireHeadSha(value.headSha, "target.headSha", errors);
	requireHeadSha(value.reviewStateHeadSha, "target.reviewStateHeadSha", errors);
	if (
		typeof value.headSha === "string" &&
		typeof value.reviewStateHeadSha === "string" &&
		value.headSha !== value.reviewStateHeadSha
	) {
		addError(
			errors,
			"target headSha must match reviewStateHeadSha",
			"target.reviewStateHeadSha",
		);
	}
	if (
		isRecord(sourceReviewState) &&
		typeof sourceReviewState.headSha === "string" &&
		typeof value.headSha === "string" &&
		sourceReviewState.headSha !== value.headSha
	) {
		addError(
			errors,
			"source review-state headSha must match target headSha",
			"sourceReviewState.headSha",
		);
	}
}

function validateMode(
	value: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, "mode must be an object", "mode");
		return;
	}
	requireAllowedKeys(value, MODE_KEYS, "mode", errors);
	requireEnum(value.kind, REVIEW_LIFECYCLE_MODE_KINDS, "mode.kind", errors);
	requireEnum(
		value.status,
		REVIEW_LIFECYCLE_MODE_STATUSES,
		"mode.status",
		errors,
	);
	requireNullableIso(value.startedAt, "mode.startedAt", errors);
	requireNullableIso(value.completedAt, "mode.completedAt", errors);
}

function validateReviewer(
	value: unknown,
	packetProducer: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, "reviewer must be an object", "reviewer");
		return;
	}
	requireAllowedKeys(value, REVIEWER_KEYS, "reviewer", errors);
	requireSafeText(value.role, "reviewer.role", errors);
	requireSafeText(value.producer, "reviewer.producer", errors);
	requireNullableSafeText(
		value.runManifestRef,
		"reviewer.runManifestRef",
		errors,
	);
	validateIndependentProducer(
		value.producer,
		packetProducer,
		"reviewer.producer",
		errors,
	);
}

function validateToolExposure(
	value: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, "toolExposure must be an object", "toolExposure");
		return;
	}
	requireAllowedKeys(value, TOOL_EXPOSURE_KEYS, "toolExposure", errors);
	requireNullableSafeText(value.sourceRef, "toolExposure.sourceRef", errors);
	if (!Array.isArray(value.classes) || value.classes.length === 0) {
		addError(
			errors,
			"toolExposure.classes must be a non-empty array",
			"toolExposure.classes",
		);
		return;
	}
	for (const [index, entry] of value.classes.entries()) {
		const path = `toolExposure.classes.${index}`;
		if (!isRecord(entry)) {
			addError(errors, "tool exposure class must be an object", path);
			continue;
		}
		requireAllowedKeys(entry, TOOL_EXPOSURE_CLASS_KEYS, path, errors);
		requireEnum(
			entry.className,
			REVIEW_LIFECYCLE_TOOL_CLASSES,
			`${path}.className`,
			errors,
		);
		validateToolExposureCounts(
			entry.statusCounts,
			`${path}.statusCounts`,
			errors,
		);
		requireNullableSafeText(entry.failureClass, `${path}.failureClass`, errors);
	}
}

function validateToolExposureCounts(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	validateCountSet(value, path, TOOL_EXPOSURE_COUNT_KEYS, errors);
}

function validateArtifactLineage(
	value: unknown,
	target: unknown,
	packetProducer: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!Array.isArray(value) || value.length === 0) {
		addError(
			errors,
			"artifactLineage must contain at least one reviewer artifact",
			"artifactLineage",
		);
		return;
	}
	for (const [index, entry] of value.entries()) {
		const path = `artifactLineage.${index}`;
		if (!isRecord(entry)) {
			addError(errors, "artifact lineage item must be an object", path);
			continue;
		}
		requireAllowedKeys(entry, ARTIFACT_LINEAGE_KEYS, path, errors);
		requireSafeText(entry.role, `${path}.role`, errors);
		requireSafeText(entry.path, `${path}.path`, errors);
		requireSafeText(entry.producer, `${path}.producer`, errors);
		requireSafeText(entry.runManifestRef, `${path}.runManifestRef`, errors);
		validateArtifactReceipt(entry, path, target, errors);
		validateIndependentProducer(
			entry.producer,
			packetProducer,
			`${path}.producer`,
			errors,
		);
		if (
			typeof entry.role === "string" &&
			typeof entry.producer === "string" &&
			entry.role !== entry.producer
		) {
			addError(
				errors,
				"artifact producer must match independent reviewer role",
				`${path}.producer`,
			);
		}
	}
}

function validateIndependentProducer(
	producer: unknown,
	packetProducer: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (typeof producer !== "string") return;
	if (typeof packetProducer === "string" && producer === packetProducer) {
		addError(
			errors,
			"review artifact producer must be independent from packet producer",
			path,
		);
	}
	if (
		/^(harness|coding-harness|implementation|coordinator|review-lifecycle)(:|$)/iu.test(
			producer,
		)
	) {
		addError(errors, "review artifact producer must be a reviewer role", path);
	}
}

function validateArtifactReceipt(
	entry: Record<string, unknown>,
	path: string,
	target: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	const receipt = entry.receipt;
	const receiptResult = validateEvidenceReceipt(receipt);
	for (const error of receiptResult.errors) {
		addError(errors, error.code, `${path}.receipt.${error.path}`);
	}
	if (!isRecord(receipt)) return;
	requireAllowedKeys(receipt, EVIDENCE_RECEIPT_KEYS, `${path}.receipt`, errors);
	if (receipt.kind !== "review_artifact") {
		addError(
			errors,
			"artifact receipt kind must be review_artifact",
			`${path}.receipt.kind`,
		);
	}
	if (receipt.status !== "pass") {
		addError(errors, "artifact receipt must pass", `${path}.receipt.status`);
	}
	if (receipt.freshness !== "current") {
		addError(
			errors,
			"artifact receipt must be current",
			`${path}.receipt.freshness`,
		);
	}
	if (receipt.evidenceUse !== "claim_support") {
		addError(
			errors,
			"artifact receipt must be claim_support",
			`${path}.receipt.evidenceUse`,
		);
	}
	if (typeof receipt.sizeBytes !== "number" || receipt.sizeBytes <= 0) {
		addError(
			errors,
			"artifact receipt sizeBytes must be greater than zero",
			`${path}.receipt.sizeBytes`,
		);
	}
	if (
		typeof entry.producer === "string" &&
		receipt.producer !== entry.producer
	) {
		addError(
			errors,
			"artifact receipt producer must match lineage producer",
			`${path}.receipt.producer`,
		);
	}
	if (typeof entry.path === "string" && typeof receipt.ref === "string") {
		const expectedRef = `review-lifecycle:${entry.path}`;
		if (receipt.ref !== expectedRef) {
			addError(
				errors,
				"artifact receipt ref must point at lineage path",
				`${path}.receipt.ref`,
			);
		}
	}
	const targetHead = isRecord(target) ? target.headSha : undefined;
	if (typeof targetHead === "string" && receipt.headSha !== targetHead) {
		addError(
			errors,
			"artifact receipt headSha must match lifecycle target",
			`${path}.receipt.headSha`,
		);
	}
}

function validateCoverage(
	value: unknown,
	artifactLineage: unknown,
	reviewer: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, "coverage must be an object", "coverage");
		return;
	}
	requireAllowedKeys(value, COVERAGE_KEYS, "coverage", errors);
	validateStringArray(value.requiredRoles, "coverage.requiredRoles", errors);
	validateStringArray(value.coveredRoles, "coverage.coveredRoles", errors);
	validateStringArray(value.missingRoles, "coverage.missingRoles", errors);
	if (
		!Array.isArray(value.requiredRoles) ||
		!Array.isArray(value.coveredRoles)
	) {
		return;
	}
	for (const role of value.requiredRoles) {
		if (typeof role === "string" && !value.coveredRoles.includes(role)) {
			addError(errors, "required role is not covered", "coverage.coveredRoles");
		}
	}
	if (Array.isArray(artifactLineage)) {
		const lineageRoles = new Set(
			artifactLineage
				.filter(isRecord)
				.map((entry) => entry.role)
				.filter((role): role is string => typeof role === "string"),
		);
		for (const role of value.coveredRoles) {
			if (typeof role === "string" && !lineageRoles.has(role)) {
				addError(
					errors,
					"covered role must have artifact lineage",
					"coverage.coveredRoles",
				);
			}
		}
	}
	if (isRecord(reviewer) && typeof reviewer.role === "string") {
		const reviewerRole = reviewer.role;
		const coveredRoles = Array.isArray(value.coveredRoles)
			? value.coveredRoles
			: [];
		if (!coveredRoles.includes(reviewerRole)) {
			addError(
				errors,
				"reviewer role must be covered by review lifecycle coverage",
				"coverage.coveredRoles",
			);
		}
		if (Array.isArray(artifactLineage)) {
			const hasReviewerLineage = artifactLineage
				.filter(isRecord)
				.some((entry) => entry.role === reviewerRole);
			if (!hasReviewerLineage) {
				addError(
					errors,
					"reviewer role must have artifact lineage",
					"artifactLineage",
				);
			}
		}
	}
}

function validateVerdict(
	packet: Record<string, unknown>,
	errors: ReviewLifecycleValidationError[],
): void {
	const verdict = packet.verdict;
	if (!isRecord(verdict)) {
		addError(errors, "verdict must be an object", "verdict");
		return;
	}
	requireAllowedKeys(verdict, VERDICT_KEYS, "verdict", errors);
	requireEnum(
		verdict.status,
		REVIEW_LIFECYCLE_VERDICTS,
		"verdict.status",
		errors,
	);
	requireNullableSafeText(verdict.blockerClass, "verdict.blockerClass", errors);
	requireSafeText(verdict.reason, "verdict.reason", errors);
	if (typeof verdict.readyForReviewClaim !== "boolean") {
		addError(
			errors,
			"readyForReviewClaim must be boolean",
			"verdict.readyForReviewClaim",
		);
	}
	if (verdict.status !== "pass") return;
	if (!isRecord(packet.mode) || packet.mode.status !== "current") {
		addError(errors, "pass verdict requires current mode", "mode.status");
	}
	if (
		!isRecord(packet.unresolvedThreads) ||
		packet.unresolvedThreads.total !== 0 ||
		packet.unresolvedThreads.needsHuman !== 0 ||
		packet.unresolvedThreads.autofixable !== 0
	) {
		addError(
			errors,
			"pass verdict requires no unresolved active threads",
			"unresolvedThreads.total",
		);
	}
	if (
		!isRecord(packet.coverage) ||
		!Array.isArray(packet.coverage.missingRoles)
	) {
		addError(errors, "pass verdict requires coverage", "coverage");
	} else if (packet.coverage.missingRoles.length > 0) {
		addError(
			errors,
			"pass verdict requires no missing roles",
			"coverage.missingRoles",
		);
	}
	if (verdict.readyForReviewClaim !== true) {
		addError(
			errors,
			"pass verdict requires readyForReviewClaim true",
			"verdict.readyForReviewClaim",
		);
	}
}

function validateUnresolvedThreadCounts(
	value: unknown,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!isRecord(value)) return;
	const total = value.total;
	const needsHuman = value.needsHuman;
	const autofixable = value.autofixable;
	if (
		!isNonNegativeInteger(total) ||
		!isNonNegativeInteger(needsHuman) ||
		!isNonNegativeInteger(autofixable)
	) {
		return;
	}
	if (needsHuman + autofixable !== total) {
		addError(
			errors,
			"unresolved thread buckets must add up to total",
			"unresolvedThreads.total",
		);
	}
}

function validateCountSet(
	value: unknown,
	path: string,
	keys: readonly string[],
	errors: ReviewLifecycleValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, `${path} must be an object`, path);
		return;
	}
	requireAllowedKeys(value, keys, path, errors);
	for (const key of keys) {
		requireNonNegativeInteger(value[key], `${path}.${key}`, errors);
	}
}

function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateStringArray(
	value: unknown,
	path: string,
	errors: ReviewLifecycleValidationError[],
): void {
	if (!Array.isArray(value)) {
		addError(errors, `${path} must be an array`, path);
		return;
	}
	for (const [index, entry] of value.entries()) {
		requireSafeText(entry, `${path}.${index}`, errors);
	}
}
