import {
	isSafeEvidenceReceiptPointer,
	validateEvidenceReceipt,
} from "../evidence/evidence-receipt.js";
import {
	REVIEW_STATE_CODERABBIT_STATUSES,
	REVIEW_STATE_GITHUB_DECISIONS,
	REVIEW_STATE_OWNERSHIP_CLASSIFICATIONS,
	REVIEW_STATE_SCHEMA_VERSION,
} from "./types.js";
import type {
	ReviewStateValidationError,
	ReviewStateValidationResult,
} from "./types.js";

const RECEIPT_STATUSES = [
	"pass",
	"fail",
	"blocked",
	"unknown",
	"not_applicable",
] as const;

/** Validate an arbitrary value against the review-state/v1 packet contract. */
export function validateReviewStatePacket(
	value: unknown,
): ReviewStateValidationResult {
	const errors: ReviewStateValidationError[] = [];
	if (!isRecord(value)) {
		addReviewStateError(errors, "packet must be an object", "packet");
		return { valid: false, errors };
	}

	requireLiteral(
		value.schemaVersion,
		REVIEW_STATE_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireIsoTimestamp(value.generatedAt, "generatedAt", errors);
	validatePullRequest(value.pr, "pr", errors);
	validateFetchProof(value, errors);
	validateGithubReviews(value.githubReviews, "githubReviews", errors);
	validateCodeRabbit(value.codeRabbit, "codeRabbit", errors);
	validateUnresolvedThreads(
		value.unresolvedThreads,
		"unresolvedThreads",
		errors,
	);
	const prHeadSha = isRecord(value.pr) ? value.pr.headSha : undefined;
	validateReviewerArtifacts(value.reviewerArtifacts, prHeadSha, errors);

	return { valid: errors.length === 0, errors };
}

function validatePullRequest(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (!isRecord(value)) {
		addReviewStateError(errors, `${path} must be an object`, path);
		return;
	}
	requirePositiveInteger(value.number, `${path}.number`, errors);
	requireSafeNonEmptyString(value.repository, `${path}.repository`, errors);
	requireSafeNonEmptyString(value.url, `${path}.url`, errors);
	requireSafeNonEmptyString(value.baseRef, `${path}.baseRef`, errors);
	requireSafeNonEmptyString(value.headRef, `${path}.headRef`, errors);
	requireHeadSha(value.headSha, `${path}.headSha`, errors);
}

function validateFetchProof(
	packet: Record<string, unknown>,
	errors: ReviewStateValidationError[],
): void {
	requireSafeNonEmptyString(packet.fetchReceiptRef, "fetchReceiptRef", errors);
	requireSha256(packet.fetchedArtifactHash, "fetchedArtifactHash", errors);
	requireSafeNonEmptyString(
		packet.verifierIdentity,
		"verifierIdentity",
		errors,
	);

	const receipt = packet.fetchReceipt;
	const validation = validateEvidenceReceipt(receipt);
	for (const error of validation.errors) {
		addReviewStateError(errors, error.code, `fetchReceipt.${error.path}`);
	}
	if (!isRecord(receipt)) return;

	if (receipt.kind !== "review_artifact") {
		addReviewStateError(
			errors,
			"review-state fetch receipt kind must be review_artifact",
			"fetchReceipt.kind",
		);
	}
	if (
		typeof receipt.ref !== "string" ||
		!receipt.ref.startsWith("review-state:")
	) {
		addReviewStateError(
			errors,
			"review-state fetch receipt ref must start with review-state:",
			"fetchReceipt.ref",
		);
	}
	if (
		typeof packet.fetchReceiptRef === "string" &&
		receipt.ref !== packet.fetchReceiptRef
	) {
		addReviewStateError(
			errors,
			"fetchReceiptRef must match fetchReceipt.ref",
			"fetchReceiptRef",
		);
	}
	if (
		typeof packet.fetchedArtifactHash === "string" &&
		receipt.checksum !== packet.fetchedArtifactHash
	) {
		addReviewStateError(
			errors,
			"fetchedArtifactHash must match fetchReceipt.checksum",
			"fetchedArtifactHash",
		);
	}
	if (
		typeof packet.verifierIdentity === "string" &&
		receipt.producer !== packet.verifierIdentity
	) {
		addReviewStateError(
			errors,
			"verifierIdentity must match fetchReceipt.producer",
			"verifierIdentity",
		);
	}
	const prHeadSha = isRecord(packet.pr) ? packet.pr.headSha : undefined;
	if (typeof prHeadSha === "string" && receipt.headSha !== prHeadSha) {
		addReviewStateError(
			errors,
			"fetchReceipt headSha must match PR headSha",
			"fetchReceipt.headSha",
		);
	}
	if (receipt.status !== "pass") {
		addReviewStateError(
			errors,
			"review-state fetch receipt must pass",
			"fetchReceipt.status",
		);
	}
	if (receipt.freshness !== "current") {
		addReviewStateError(
			errors,
			"review-state fetch receipt must be current",
			"fetchReceipt.freshness",
		);
	}
	if (receipt.evidenceUse !== "claim_support") {
		addReviewStateError(
			errors,
			"review-state fetch receipt must be claim_support",
			"fetchReceipt.evidenceUse",
		);
	}
	if (typeof receipt.sizeBytes !== "number" || receipt.sizeBytes <= 0) {
		addReviewStateError(
			errors,
			"review-state fetch receipt requires sizeBytes greater than zero",
			"fetchReceipt.sizeBytes",
		);
	}
}

function validateGithubReviews(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (!isRecord(value)) {
		addReviewStateError(errors, `${path} must be an object`, path);
		return;
	}
	requireEnum(
		value.decision,
		REVIEW_STATE_GITHUB_DECISIONS,
		`${path}.decision`,
		errors,
	);
	requireEnum(value.status, RECEIPT_STATUSES, `${path}.status`, errors);
	requireNonNegativeInteger(value.reviewCount, `${path}.reviewCount`, errors);
}

function validateCodeRabbit(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (!isRecord(value)) {
		addReviewStateError(errors, `${path} must be an object`, path);
		return;
	}
	requireEnum(
		value.status,
		REVIEW_STATE_CODERABBIT_STATUSES,
		`${path}.status`,
		errors,
	);
	requireEnum(
		value.evidenceStatus,
		RECEIPT_STATUSES,
		`${path}.evidenceStatus`,
		errors,
	);
	requireNonNegativeInteger(value.commentCount, `${path}.commentCount`, errors);
}

function validateUnresolvedThreads(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (!isRecord(value)) {
		addReviewStateError(errors, `${path} must be an object`, path);
		return;
	}
	requireNonNegativeInteger(value.total, `${path}.total`, errors);
	requireNonNegativeInteger(value.needsHuman, `${path}.needsHuman`, errors);
	requireNonNegativeInteger(value.autofixable, `${path}.autofixable`, errors);
	if (
		typeof value.total === "number" &&
		typeof value.needsHuman === "number" &&
		typeof value.autofixable === "number" &&
		value.needsHuman + value.autofixable > value.total
	) {
		addReviewStateError(
			errors,
			"needsHuman plus autofixable must not exceed total",
			`${path}.total`,
		);
	}
}

function validateReviewerArtifacts(
	value: unknown,
	prHeadSha: unknown,
	errors: ReviewStateValidationError[],
): void {
	if (!Array.isArray(value)) {
		addReviewStateError(
			errors,
			"reviewerArtifacts must be an array",
			"reviewerArtifacts",
		);
		return;
	}
	for (const [index, artifact] of value.entries()) {
		validateReviewerArtifact(
			artifact,
			`reviewerArtifacts.${index}`,
			prHeadSha,
			errors,
		);
	}
}

function validateReviewerArtifact(
	value: unknown,
	path: string,
	prHeadSha: unknown,
	errors: ReviewStateValidationError[],
): void {
	if (!isRecord(value)) {
		addReviewStateError(errors, `${path} must be an object`, path);
		return;
	}
	requireSafeNonEmptyString(value.role, `${path}.role`, errors);
	requireSafeNonEmptyString(value.path, `${path}.path`, errors);
	requireSafeNonEmptyString(
		value.expectedProducer,
		`${path}.expectedProducer`,
		errors,
	);
	requireEnum(
		value.ownershipClassification,
		REVIEW_STATE_OWNERSHIP_CLASSIFICATIONS,
		`${path}.ownershipClassification`,
		errors,
	);
	validateReviewerReceipt(value, path, prHeadSha, errors);
}

function validateReviewerReceipt(
	artifact: Record<string, unknown>,
	path: string,
	prHeadSha: unknown,
	errors: ReviewStateValidationError[],
): void {
	const receipt = artifact.receipt;
	validateReceiptShape(receipt, path, errors);
	if (!isRecord(receipt)) return;
	validateReceiptRef(receipt, artifact, path, errors);
	validateReceiptProvenance(receipt, artifact, path, prHeadSha, errors);
	validateReceiptSize(receipt, path, errors);
}

function validateReceiptShape(
	receipt: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	const validation = validateEvidenceReceipt(receipt);
	for (const error of validation.errors) {
		addReviewStateError(errors, error.code, `${path}.receipt.${error.path}`);
	}
	if (!isRecord(receipt)) return;
	if (receipt.kind !== "review_artifact") {
		addReviewStateError(
			errors,
			"review artifact receipt kind must be review_artifact",
			`${path}.receipt.kind`,
		);
	}
	if (
		typeof receipt.ref !== "string" ||
		!receipt.ref.startsWith("review-state:")
	) {
		addReviewStateError(
			errors,
			"review artifact receipt ref must start with review-state:",
			`${path}.receipt.ref`,
		);
	}
	if (receipt.status !== "pass") {
		addReviewStateError(
			errors,
			"review artifact receipt must pass",
			`${path}.receipt.status`,
		);
	}
	if (receipt.freshness !== "current") {
		addReviewStateError(
			errors,
			"review artifact receipt must be current",
			`${path}.receipt.freshness`,
		);
	}
	if (receipt.evidenceUse !== "claim_support") {
		addReviewStateError(
			errors,
			"review artifact receipt must be claim_support",
			`${path}.receipt.evidenceUse`,
		);
	}
}

function validateReceiptRef(
	receipt: Record<string, unknown>,
	artifact: Record<string, unknown>,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (
		typeof artifact.path === "string" &&
		receipt.ref !== `review-state:${artifact.path}`
	) {
		addReviewStateError(
			errors,
			"review artifact receipt ref must match artifact path",
			`${path}.receipt.ref`,
		);
	}
}

function validateReceiptProvenance(
	receipt: Record<string, unknown>,
	artifact: Record<string, unknown>,
	path: string,
	prHeadSha: unknown,
	errors: ReviewStateValidationError[],
): void {
	if (typeof prHeadSha === "string" && receipt.headSha !== prHeadSha) {
		addReviewStateError(
			errors,
			"review artifact receipt headSha must match PR headSha",
			`${path}.receipt.headSha`,
		);
	}
	if (
		typeof receipt.producer === "string" &&
		typeof artifact.expectedProducer === "string" &&
		receipt.producer !== artifact.expectedProducer
	) {
		addReviewStateError(
			errors,
			"review artifact producer must match expectedProducer",
			`${path}.expectedProducer`,
		);
	}
}

function validateReceiptSize(
	receipt: Record<string, unknown>,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (typeof receipt.sizeBytes !== "number" || receipt.sizeBytes <= 0) {
		addReviewStateError(
			errors,
			"reviewer artifact receipts require sizeBytes greater than zero",
			`${path}.receipt.sizeBytes`,
		);
	}
}

function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (value !== expected) {
		addReviewStateError(errors, `${path} must be ${expected}`, path);
	}
}

function requireEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addReviewStateError(
			errors,
			`${path} must be one of ${allowed.join(", ")}`,
			path,
		);
	}
}

function requireSafeNonEmptyString(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (typeof value !== "string" || value.trim() === "") {
		addReviewStateError(errors, `${path} must be a non-empty string`, path);
		return;
	}
	if (!isSafeEvidenceReceiptPointer(value)) {
		addReviewStateError(errors, `${path} must be a safe compact string`, path);
	}
}

function requireSha256(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	requireSafeNonEmptyString(value, path, errors);
	if (typeof value === "string" && !/^[a-f0-9]{64}$/u.test(value)) {
		addReviewStateError(errors, `${path} must be a SHA-256 hex digest`, path);
	}
}

function requireIsoTimestamp(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	requireSafeNonEmptyString(value, path, errors);
	if (typeof value === "string" && !isStrictIsoTimestamp(value)) {
		addReviewStateError(errors, `${path} must be an ISO-8601 timestamp`, path);
	}
}

function requireHeadSha(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	requireSafeNonEmptyString(value, path, errors);
	if (typeof value === "string" && !/^[a-f0-9]{40}$/u.test(value)) {
		addReviewStateError(errors, `${path} must be a 40-character git SHA`, path);
	}
}

function requirePositiveInteger(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
		addReviewStateError(errors, `${path} must be a positive integer`, path);
	}
}

function requireNonNegativeInteger(
	value: unknown,
	path: string,
	errors: ReviewStateValidationError[],
): void {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		addReviewStateError(errors, `${path} must be a non-negative integer`, path);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStrictIsoTimestamp(value: string): boolean {
	return /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.test(
		value,
	);
}

function addReviewStateError(
	errors: ReviewStateValidationError[],
	code: string,
	path: string,
): void {
	errors.push({ code, path, severity: "error" });
}
