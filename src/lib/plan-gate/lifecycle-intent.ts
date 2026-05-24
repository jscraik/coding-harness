import picomatch from "picomatch";
import {
	LIFECYCLE_INTENT_ACCEPTANCE_PROOF_KINDS,
	LIFECYCLE_INTENT_ALLOWED_EVIDENCE_USES,
	LIFECYCLE_INTENT_PASS_STATUS,
	LIFECYCLE_INTENT_UNKNOWN_RUNTIME_PATH_POLICY,
	addLifecycleIntentError,
	readStringArray,
	requireNonEmptyStringArray,
	requireRecord,
	requireRecordArray,
	requireString,
	sameStringArray,
	type LifecycleIntentValidationResult,
} from "./lifecycle-intent-types.js";

/** Options for validating an implementation intent artifact. */
export interface LifecycleIntentValidationOptions {
	/** Require the artifact to be reviewed before implementation starts. */
	requireReviewed?: boolean;
	/** Optional parsed review receipt to bind to the reviewed intent. */
	reviewReceipt?: unknown;
}

/** Acceptance coverage entry for one mechanically checkable acceptance ID. */
export interface AcceptanceCoverageEntry {
	/** Acceptance criterion ID, for example SA-017. */
	acceptanceId: string;
	/** Proof mechanism that verifies the acceptance criterion. */
	proofKind: (typeof LIFECYCLE_INTENT_ACCEPTANCE_PROOF_KINDS)[number];
	/** Path, command, fixture, or schema assertion that provides the proof. */
	ref: string;
}

/** Input for acceptance coverage validation. */
export interface AcceptanceCoverageInput {
	/** Mechanically checkable acceptance IDs that must be covered exactly. */
	mechanicalAcceptanceIds: string[];
	/** Coverage entries supplied by the implementation plan. */
	coverage: AcceptanceCoverageEntry[];
	/** Optional baseline IDs used to detect denominator drift. */
	baselineMechanicalAcceptanceIds?: string[];
}

/** Input for intent ordering validation. */
export interface IntentOrderingInput {
	/** Parsed implementation intent artifact. */
	intent: unknown;
	/** Repository-relative changed file paths. */
	changedFiles: string[];
}

/** Input for contract-freeze validation. */
export interface ContractFreezeInput {
	/** Parsed baseline artifact captured before implementation. */
	baseline: unknown;
	/** Current lifecycle contract projection to compare against the baseline. */
	current: unknown;
}

/** Validate a PU-000 implementation intent artifact. */
export function validateLifecycleImplementationIntent(
	value: unknown,
	options: LifecycleIntentValidationOptions = {},
): LifecycleIntentValidationResult {
	const errors: LifecycleIntentValidationResult["errors"] = [];
	if (!requireRecord(value, "intent", errors)) {
		return { valid: false, errors };
	}

	for (const field of [
		"schemaVersion",
		"intentId",
		"createdAt",
		"objective",
		"sourcePlan",
		"sourceSpec",
		"linearIssue",
		"deepModuleBoundary",
		"lifecycleUnit",
		"baselineRef",
		"implementationStartPolicy",
		"unknownRuntimePathPolicy",
		"postReviewMutationPolicy",
	] as const) {
		requireString(value[field], field, errors);
	}

	for (const field of [
		"ownedAcceptanceIds",
		"inScope",
		"outOfScope",
		"guardedPathGlobs",
		"mechanicalAcceptanceIds",
		"stopConditions",
		"rollback",
		"assumptions",
	] as const) {
		requireNonEmptyStringArray(value[field], field, errors);
	}

	requireRecordArray(value.automationPlan, "automationPlan", errors);
	validateReviewPlan(value.reviewPlan, errors);
	validateReviewReceiptRequirements(value.reviewReceiptRequirements, errors);

	if (value.schemaVersion !== "implementation-intent/v1") {
		addLifecycleIntentError(
			errors,
			"schemaVersion must be implementation-intent/v1",
			"schemaVersion",
		);
	}
	if (value.implementationStartPolicy !== "blocked_until_reviewed") {
		addLifecycleIntentError(
			errors,
			"implementationStartPolicy must be blocked_until_reviewed",
			"implementationStartPolicy",
		);
	}
	if (
		value.unknownRuntimePathPolicy !==
		LIFECYCLE_INTENT_UNKNOWN_RUNTIME_PATH_POLICY
	) {
		addLifecycleIntentError(
			errors,
			`unknownRuntimePathPolicy must be ${LIFECYCLE_INTENT_UNKNOWN_RUNTIME_PATH_POLICY}`,
			"unknownRuntimePathPolicy",
		);
	}

	const reviewStatus = value.reviewStatus;
	if (reviewStatus !== "pending" && reviewStatus !== "reviewed") {
		addLifecycleIntentError(
			errors,
			"reviewStatus must be pending or reviewed",
			"reviewStatus",
		);
	}
	if (options.requireReviewed || reviewStatus === "reviewed") {
		validateReviewedIntent(value, errors);
		if (options.reviewReceipt !== undefined) {
			validateReviewReceiptBinding(value, options.reviewReceipt, errors);
		}
	}

	return { valid: errors.length === 0, errors };
}

/** Validate acceptance coverage for all mechanically checkable acceptance IDs. */
export function validateLifecycleAcceptanceCoverage(
	input: AcceptanceCoverageInput,
): LifecycleIntentValidationResult {
	const errors: LifecycleIntentValidationResult["errors"] = [];
	if (
		input.baselineMechanicalAcceptanceIds !== undefined &&
		!sameStringArray(
			input.mechanicalAcceptanceIds,
			input.baselineMechanicalAcceptanceIds,
		)
	) {
		addLifecycleIntentError(
			errors,
			"mechanicalAcceptanceIds must match baselineMechanicalAcceptanceIds",
			"mechanicalAcceptanceIds",
		);
	}
	const covered = new Set<string>();
	for (const [index, entry] of input.coverage.entries()) {
		const path = `coverage[${index}]`;
		if (!input.mechanicalAcceptanceIds.includes(entry.acceptanceId)) {
			addLifecycleIntentError(
				errors,
				`${path}.acceptanceId is not in mechanicalAcceptanceIds`,
				`${path}.acceptanceId`,
			);
		}
		if (!LIFECYCLE_INTENT_ACCEPTANCE_PROOF_KINDS.includes(entry.proofKind)) {
			addLifecycleIntentError(
				errors,
				`${path}.proofKind must be validator, test, fixture, command, or schema_assertion`,
				`${path}.proofKind`,
			);
		}
		if (entry.ref.trim() === "") {
			addLifecycleIntentError(
				errors,
				`${path}.ref must be a non-empty string`,
				`${path}.ref`,
			);
		}
		covered.add(entry.acceptanceId);
	}
	for (const acceptanceId of input.mechanicalAcceptanceIds) {
		if (!covered.has(acceptanceId)) {
			addLifecycleIntentError(
				errors,
				`acceptance coverage missing ${acceptanceId}`,
				"coverage",
			);
		}
	}
	return { valid: errors.length === 0, errors };
}

/** Validate that implementation paths did not bypass reviewed intent. */
export function validateLifecycleIntentOrdering(
	input: IntentOrderingInput,
): LifecycleIntentValidationResult {
	const errors: LifecycleIntentValidationResult["errors"] = [];
	if (!requireRecord(input.intent, "intent", errors)) {
		return { valid: false, errors };
	}
	const allowedBeforeReview = readStringArray(
		input.intent.inScope,
		"inScope",
		errors,
	);
	const guardedAfterReview = readStringArray(
		input.intent.guardedPathGlobs,
		"guardedPathGlobs",
		errors,
	);
	const isReviewed = input.intent.reviewStatus === "reviewed";
	if (isReviewed) {
		return { valid: errors.length === 0, errors };
	}
	const allowedMatcher = picomatch(allowedBeforeReview);
	const guardedMatcher = picomatch(guardedAfterReview);
	for (const file of input.changedFiles) {
		const normalizedFile = normalizeChangedFilePath(file);
		if (allowedMatcher(normalizedFile)) {
			continue;
		}
		if (
			guardedMatcher(normalizedFile) ||
			isUnknownRuntimeOrGovernancePath(normalizedFile)
		) {
			addLifecycleIntentError(
				errors,
				`changed file ${file} is blocked until lifecycle intent is reviewed`,
				"changedFiles",
			);
		}
	}
	return { valid: errors.length === 0, errors };
}

/** Validate that the current lifecycle contract has not weakened the baseline. */
export function validateLifecycleContractFreeze(
	input: ContractFreezeInput,
): LifecycleIntentValidationResult {
	const errors: LifecycleIntentValidationResult["errors"] = [];
	if (!requireRecord(input.baseline, "baseline", errors)) {
		return { valid: false, errors };
	}
	if (!requireRecord(input.current, "current", errors)) {
		return { valid: false, errors };
	}
	validateStringArrayContract(
		"acceptanceIds",
		input.baseline.acceptanceIds,
		input.current.acceptanceIds,
		errors,
	);
	validateStringArrayContract(
		"mechanicalAcceptanceIds",
		input.baseline.mechanicalAcceptanceIds,
		input.current.mechanicalAcceptanceIds,
		errors,
	);
	validateStringArrayContract(
		"lifecycleUnits",
		input.baseline.lifecycleUnits,
		input.current.lifecycleUnits,
		errors,
	);
	validateStringArrayContract(
		"guardedPathGlobs",
		input.baseline.guardedPathGlobs,
		input.current.guardedPathGlobs,
		errors,
	);
	validateStringArrayContract(
		"forbiddenWeakening",
		input.baseline.forbiddenWeakening,
		input.current.forbiddenWeakening,
		errors,
	);
	if (
		input.baseline.unknownRuntimePathPolicy !==
		input.current.unknownRuntimePathPolicy
	) {
		addLifecycleIntentError(
			errors,
			"unknownRuntimePathPolicy must match baseline",
			"unknownRuntimePathPolicy",
		);
	}
	return { valid: errors.length === 0, errors };
}

/** Validate the immutable PU-000 contract baseline artifact. */
export function validateLifecycleContractBaseline(
	value: unknown,
): LifecycleIntentValidationResult {
	const errors: LifecycleIntentValidationResult["errors"] = [];
	if (!requireRecord(value, "baseline", errors)) {
		return { valid: false, errors };
	}
	for (const field of [
		"schemaVersion",
		"baselineId",
		"producer",
		"capturedAt",
		"unknownRuntimePathPolicy",
		"reviewerReceiptRef",
	] as const) {
		requireString(value[field], field, errors);
	}
	if (value.schemaVersion !== "contract-baseline/v1") {
		addLifecycleIntentError(
			errors,
			"schemaVersion must be contract-baseline/v1",
			"schemaVersion",
		);
	}
	for (const field of [
		"acceptanceIds",
		"mechanicalAcceptanceIds",
		"guardedPathGlobs",
		"lifecycleUnits",
		"forbiddenWeakening",
	] as const) {
		requireNonEmptyStringArray(value[field], field, errors);
	}
	requireRecordArray(value.sourceArtifacts, "sourceArtifacts", errors);
	return { valid: errors.length === 0, errors };
}

function validateReviewPlan(
	value: unknown,
	errors: LifecycleIntentValidationResult["errors"],
): void {
	if (!requireRecord(value, "reviewPlan", errors)) {
		return;
	}
	if (value.requiredBeforeImplementation !== true) {
		addLifecycleIntentError(
			errors,
			"reviewPlan.requiredBeforeImplementation must be true",
			"reviewPlan.requiredBeforeImplementation",
		);
	}
	requireNonEmptyStringArray(value.reviewers, "reviewPlan.reviewers", errors);
	requireNonEmptyStringArray(
		value.artifactPaths,
		"reviewPlan.artifactPaths",
		errors,
	);
}

function validateReviewReceiptRequirements(
	value: unknown,
	errors: LifecycleIntentValidationResult["errors"],
): void {
	if (!requireRecord(value, "reviewReceiptRequirements", errors)) {
		return;
	}
	for (const field of [
		"intentId",
		"intentSha256Field",
		"requiredStatus",
		"minimumTimestamp",
	] as const) {
		requireString(value[field], `reviewReceiptRequirements.${field}`, errors);
	}
	requireNonEmptyStringArray(
		value.requiredReviewerRoles,
		"reviewReceiptRequirements.requiredReviewerRoles",
		errors,
	);
	requireNonEmptyStringArray(
		value.requiredArtifactRefs,
		"reviewReceiptRequirements.requiredArtifactRefs",
		errors,
	);
	requireNonEmptyStringArray(
		value.allowedEvidenceUse,
		"reviewReceiptRequirements.allowedEvidenceUse",
		errors,
	);
	if (value.requiredStatus !== LIFECYCLE_INTENT_PASS_STATUS) {
		addLifecycleIntentError(
			errors,
			"reviewReceiptRequirements.requiredStatus must be pass",
			"reviewReceiptRequirements.requiredStatus",
		);
	}
}

function validateReviewedIntent(
	value: Record<string, unknown>,
	errors: LifecycleIntentValidationResult["errors"],
): void {
	for (const field of [
		"reviewReceiptRef",
		"reviewedAt",
		"reviewedIntentSha256",
	] as const) {
		requireString(value[field], field, errors);
	}
	requireNonEmptyStringArray(value.reviewedBy, "reviewedBy", errors);
}

function validateReviewReceiptBinding(
	intent: Record<string, unknown>,
	receipt: unknown,
	errors: LifecycleIntentValidationResult["errors"],
): void {
	if (!requireRecord(receipt, "reviewReceipt", errors)) {
		return;
	}
	if (receipt.schemaVersion !== "evidence-receipt/v1") {
		addLifecycleIntentError(
			errors,
			"reviewReceipt.schemaVersion must be evidence-receipt/v1",
			"reviewReceipt.schemaVersion",
		);
	}
	if (receipt.status !== LIFECYCLE_INTENT_PASS_STATUS) {
		addLifecycleIntentError(
			errors,
			"reviewReceipt.status must be pass",
			"reviewReceipt.status",
		);
	}
	if (
		typeof receipt.evidenceUse !== "string" ||
		!allowedReviewEvidenceUses(intent, errors).includes(receipt.evidenceUse)
	) {
		addLifecycleIntentError(
			errors,
			"reviewReceipt.evidenceUse must match reviewReceiptRequirements.allowedEvidenceUse",
			"reviewReceipt.evidenceUse",
		);
	}
	for (const field of ["producer", "verifiedAt"] as const) {
		requireString(receipt[field], `reviewReceipt.${field}`, errors);
	}
	if (receipt.intentId !== intent.intentId) {
		addLifecycleIntentError(
			errors,
			"reviewReceipt.intentId must match intentId",
			"reviewReceipt.intentId",
		);
	}
	if (receipt.intentSha256 !== intent.reviewedIntentSha256) {
		addLifecycleIntentError(
			errors,
			"reviewReceipt.intentSha256 must match reviewedIntentSha256",
			"reviewReceipt.intentSha256",
		);
	}
	validateRequiredReviewerArtifacts(intent, receipt, errors);
}

function validateRequiredReviewerArtifacts(
	intent: Record<string, unknown>,
	receipt: Record<string, unknown>,
	errors: LifecycleIntentValidationResult["errors"],
): void {
	if (
		!requireRecord(
			intent.reviewReceiptRequirements,
			"reviewReceiptRequirements",
			errors,
		)
	) {
		return;
	}
	const requiredRoles = readStringArray(
		intent.reviewReceiptRequirements.requiredReviewerRoles,
		"reviewReceiptRequirements.requiredReviewerRoles",
		errors,
	);
	const requiredRefs = readStringArray(
		intent.reviewReceiptRequirements.requiredArtifactRefs,
		"reviewReceiptRequirements.requiredArtifactRefs",
		errors,
	);
	if (requiredRoles.length !== requiredRefs.length) {
		addLifecycleIntentError(
			errors,
			"reviewReceiptRequirements.requiredReviewerRoles and requiredArtifactRefs must have matching positions",
			"reviewReceiptRequirements",
		);
	}
	if (!Array.isArray(receipt.reviewerArtifacts)) {
		addLifecycleIntentError(
			errors,
			"reviewReceipt.reviewerArtifacts must be an array",
			"reviewReceipt.reviewerArtifacts",
		);
		return;
	}
	const artifactRecords = receipt.reviewerArtifacts.filter(
		(entry): entry is Record<string, unknown> =>
			typeof entry === "object" && entry !== null,
	);
	for (const [index, role] of requiredRoles.entries()) {
		const ref = requiredRefs[index];
		const matches =
			typeof ref === "string"
				? artifactRecords.filter(
						(artifact) => artifact.role === role && artifact.ref === ref,
					)
				: [];
		if (
			matches.length !== 1 ||
			matches[0]?.status !== LIFECYCLE_INTENT_PASS_STATUS
		) {
			addLifecycleIntentError(
				errors,
				`reviewReceipt.reviewerArtifacts must contain exactly one passing artifact for ${role} at ${ref ?? "<missing-ref>"}`,
				"reviewReceipt.reviewerArtifacts",
			);
		}
	}
}

function allowedReviewEvidenceUses(
	intent: Record<string, unknown>,
	errors: LifecycleIntentValidationResult["errors"],
): string[] {
	if (
		!requireRecord(
			intent.reviewReceiptRequirements,
			"reviewReceiptRequirements",
			errors,
		)
	) {
		return [...LIFECYCLE_INTENT_ALLOWED_EVIDENCE_USES];
	}
	const allowed = readStringArray(
		intent.reviewReceiptRequirements.allowedEvidenceUse,
		"reviewReceiptRequirements.allowedEvidenceUse",
		errors,
	);
	return allowed.filter((use) =>
		(LIFECYCLE_INTENT_ALLOWED_EVIDENCE_USES as readonly string[]).includes(use),
	);
}

function normalizeChangedFilePath(path: string): string {
	const normalizedPath = normalizePathSegments(path.replaceAll("\\", "/"));
	if (!normalizedPath.startsWith("/")) {
		return normalizedPath;
	}
	for (const marker of [
		"/.harness/",
		"/src/",
		"/scripts/",
		"/docs/",
		"/AGENTS.md",
		"/README.md",
		"/harness.contract.json",
	] as const) {
		const markerIndex = normalizedPath.lastIndexOf(marker);
		if (markerIndex >= 0) {
			return normalizedPath.slice(markerIndex + 1);
		}
	}
	return normalizedPath;
}

function normalizePathSegments(path: string): string {
	const isAbsolute = path.startsWith("/");
	const segments: string[] = [];
	for (const segment of path.split("/")) {
		if (segment === "" || segment === ".") {
			continue;
		}
		if (segment === "..") {
			const previous = segments.at(-1);
			if (previous !== undefined && previous !== "..") {
				segments.pop();
			} else if (!isAbsolute) {
				segments.push(segment);
			}
			continue;
		}
		segments.push(segment);
	}
	return `${isAbsolute ? "/" : ""}${segments.join("/")}`;
}

function isUnknownRuntimeOrGovernancePath(path: string): boolean {
	return (
		path.startsWith("src/lib/") ||
		path.startsWith("src/commands/") ||
		path.startsWith("scripts/") ||
		path.startsWith("docs/agents/") ||
		path === "AGENTS.md" ||
		path === "README.md" ||
		path === "harness.contract.json"
	);
}

function validateStringArrayContract(
	field: string,
	baselineValue: unknown,
	currentValue: unknown,
	errors: LifecycleIntentValidationResult["errors"],
): void {
	const baseline = readStringArray(baselineValue, `baseline.${field}`, errors);
	const current = readStringArray(currentValue, `current.${field}`, errors);
	if (!sameStringArray(baseline, current)) {
		addLifecycleIntentError(errors, `${field} must match baseline`, field);
	}
}
