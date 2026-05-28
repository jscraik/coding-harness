import {
	ACTION_REVIEW_RECEIPT_SCHEMA_VERSION,
	type ActionReviewReceiptValidationError,
	type ActionReviewReceiptValidationResult,
} from "./types.js";
import {
	ACTION_KINDS,
	ACTOR_KEYS,
	BLOCKER_CLASSES,
	BLOCKER_KEYS,
	DECISIONS,
	ENVELOPE_KEYS,
	EVIDENCE_KEYS,
	EVIDENCE_REF_PREFIXES,
	EVIDENCE_STATUS,
	EVIDENCE_USE,
	FRESHNESS,
	HEAD_SHA_PATTERN,
	MISMATCH_CLASSES,
	MISMATCH_KEYS,
	PACKET_KEYS,
	RAW_KEY_PATTERN,
	REQUIRED_ALLOW_EVIDENCE_KINDS,
	REVIEWER_KEYS,
	SAFE_POINTER_PATTERN,
	SUPPORTING_EVIDENCE_USE,
} from "./validation-constants.js";

const RFC3339_DATE_TIME_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

/** Validate an ActionReviewReceipt/v1 packet and its semantic invariants. */
export function validateActionReviewReceipt(
	value: unknown,
): ActionReviewReceiptValidationResult {
	const errors: ActionReviewReceiptValidationError[] = [];
	validateNoRawKeys(value, "packet", errors);
	if (!isRecord(value)) {
		addError(errors, "invalid_packet", "packet", "must be an object");
		return { valid: false, errors };
	}
	validatePacketShape(value, errors);
	validateEnvelope(value.action, "action", errors);
	validateActor(value.requestedBy, "requestedBy", errors);
	validateReviewer(value.reviewer, "reviewer", errors);
	validateEvidenceRefs(value, errors);
	validateBlockers(value.blockers, "blockers", errors);
	validateMismatches(value.mismatches, "mismatches", errors);
	validateDecisionSemantics(value, errors);
	return { valid: errors.length === 0, errors };
}

function validatePacketShape(
	value: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	requireAllowedKeys(value, PACKET_KEYS, "packet", errors);
	requireLiteral(
		value.schemaVersion,
		ACTION_REVIEW_RECEIPT_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireSafePointer(value.receiptId, "receiptId", errors);
	requireIso(value.generatedAt, "generatedAt", errors);
	requireSafePointer(value.producer, "producer", errors);
	requireLiteral(
		value.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	requireEnum(value.evidenceUse, EVIDENCE_USE, "evidenceUse", errors);
	requireEnum(value.decision, DECISIONS, "decision", errors);
	requireEnum(value.freshness, FRESHNESS, "freshness", errors);
	if (value.expiresAt !== null)
		requireIso(value.expiresAt, "expiresAt", errors);
	requireNonEmptyArray(value.requiredEvidence, "requiredEvidence", errors);
	requireArray(value.blockers, "blockers", errors);
	requireArray(value.mismatches, "mismatches", errors);
	requireSafePointer(value.nextAction, "nextAction", errors);
	requireSafePointer(value.blockedBy, "blockedBy", errors);
}

function validateEnvelope(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_envelope", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, ENVELOPE_KEYS, path, errors);
	requireSafePointer(value.actionId, `${path}.actionId`, errors);
	requireEnum(value.kind, ACTION_KINDS, `${path}.kind`, errors);
	requireEnum(value.riskTier, ["high", "critical"], `${path}.riskTier`, errors);
	requireSafePointer(value.targetRef, `${path}.targetRef`, errors);
	requireNullableSafePointer(value.repository, `${path}.repository`, errors);
	requireNullableInteger(value.prNumber, `${path}.prNumber`, errors);
	requireNullableSafePointer(value.issueRef, `${path}.issueRef`, errors);
	requireNullableHeadSha(value.headSha, `${path}.headSha`, errors);
	requireNullableSafePointer(value.commandRef, `${path}.commandRef`, errors);
	requireIso(value.requestedAt, `${path}.requestedAt`, errors);
	validateActionKindRequirements(value, path, errors);
}

function validateActionKindRequirements(
	value: Record<string, unknown>,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (value.kind === "merge") {
		requireSafePointer(value.repository, `${path}.repository`, errors);
		requireNullableInteger(value.prNumber, `${path}.prNumber`, errors);
		requireNullableHeadSha(value.headSha, `${path}.headSha`, errors);
		if (value.prNumber === null) {
			addError(
				errors,
				"missing_pr_number",
				`${path}.prNumber`,
				"merge actions require prNumber",
			);
		}
		if (value.headSha === null) {
			addError(
				errors,
				"missing_head_sha",
				`${path}.headSha`,
				"merge actions require headSha",
			);
		}
	}
	if (value.kind === "release") {
		requireSafePointer(value.repository, `${path}.repository`, errors);
		if (value.repository === null) {
			addError(
				errors,
				"missing_repository",
				`${path}.repository`,
				"release actions require repository",
			);
		}
		if (value.headSha === null) {
			addError(
				errors,
				"missing_head_sha",
				`${path}.headSha`,
				"release actions require headSha",
			);
		}
	}
	if (value.kind === "destructive_cleanup" && value.commandRef === null) {
		addError(
			errors,
			"missing_command_ref",
			`${path}.commandRef`,
			"destructive cleanup actions require commandRef",
		);
	}
	if (value.kind === "external_tracker_mutation" && value.issueRef === null) {
		addError(
			errors,
			"missing_issue_ref",
			`${path}.issueRef`,
			"external tracker mutations require issueRef",
		);
	}
}

function validateActor(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
	allowedKeys: readonly string[] = ACTOR_KEYS,
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_actor", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, allowedKeys, path, errors);
	requireSafePointer(value.actorId, `${path}.actorId`, errors);
	requireSafePointer(value.identityRef, `${path}.identityRef`, errors);
	requireSafePointer(value.role, `${path}.role`, errors);
	requireSafePointer(value.producer, `${path}.producer`, errors);
	requireSafePointer(value.sourceRef, `${path}.sourceRef`, errors);
}

function validateReviewer(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_reviewer", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, REVIEWER_KEYS, path, errors);
	validateActor(value, path, errors, REVIEWER_KEYS);
	requireEnum(
		value.independence,
		["independent", "self", "unknown"],
		`${path}.independence`,
		errors,
	);
	requireIso(value.reviewedAt, `${path}.reviewedAt`, errors);
}

function validateEvidenceRefs(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!Array.isArray(packet.requiredEvidence)) return;
	for (const [index, evidence] of packet.requiredEvidence.entries()) {
		const path = `requiredEvidence[${index}]`;
		if (!isRecord(evidence)) {
			addError(errors, "invalid_evidence", path, "must be an object");
			continue;
		}
		requireAllowedKeys(evidence, EVIDENCE_KEYS, path, errors);
		requireSafePointer(evidence.ref, `${path}.ref`, errors);
		requireSafePointer(evidence.kind, `${path}.kind`, errors);
		requireEnum(evidence.status, EVIDENCE_STATUS, `${path}.status`, errors);
		requireEnum(evidence.freshness, FRESHNESS, `${path}.freshness`, errors);
		requireEnum(
			evidence.evidenceUse,
			SUPPORTING_EVIDENCE_USE,
			`${path}.evidenceUse`,
			errors,
		);
		requireNullableHeadSha(evidence.headSha, `${path}.headSha`, errors);
		requireIso(evidence.verifiedAt, `${path}.verifiedAt`, errors);
	}
}

function validateBlockers(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!Array.isArray(value)) return;
	for (const [index, blocker] of value.entries()) {
		if (!isRecord(blocker)) {
			addError(
				errors,
				"invalid_blocker",
				`${path}[${index}]`,
				"must be an object",
			);
			continue;
		}
		requireAllowedKeys(blocker, BLOCKER_KEYS, `${path}[${index}]`, errors);
		requireEnum(
			blocker.class,
			BLOCKER_CLASSES,
			`${path}[${index}].class`,
			errors,
		);
		requireSafePointer(blocker.reason, `${path}[${index}].reason`, errors);
		requireSafePointer(
			blocker.nextAction,
			`${path}[${index}].nextAction`,
			errors,
		);
	}
}

function validateMismatches(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!Array.isArray(value)) return;
	for (const [index, mismatch] of value.entries()) {
		const itemPath = `${path}[${index}]`;
		if (!isRecord(mismatch)) {
			addError(errors, "invalid_mismatch", itemPath, "must be an object");
			continue;
		}
		requireAllowedKeys(mismatch, MISMATCH_KEYS, itemPath, errors);
		requireEnum(mismatch.class, MISMATCH_CLASSES, `${itemPath}.class`, errors);
		requireSafePointer(mismatch.reason, `${itemPath}.reason`, errors);
		validateEnvelope(mismatch.expected, `${itemPath}.expected`, errors);
		validateEnvelope(mismatch.actual, `${itemPath}.actual`, errors);
	}
}

function validateDecisionSemantics(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	if (packet.decision === "allow") validateAllowDecision(packet, errors);
	if (packet.decision === "block" || packet.decision === "unknown") {
		validateBlockedOrUnknown(packet, errors);
	}
	if (packet.decision === "mismatch") validateMismatchDecision(packet, errors);
	if (packet.decision === "not_applicable") {
		addError(
			errors,
			"not_applicable_rejected_for_high_risk_action",
			"decision",
			"not_applicable is not valid for merge, release, destructive cleanup, or external tracker mutation action reviews",
		);
	}
}

function validateAllowDecision(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	if (packet.freshness !== "current") {
		addError(
			errors,
			"allow_requires_current_freshness",
			"freshness",
			"allow decisions require current freshness",
		);
	}
	if (Array.isArray(packet.blockers) && packet.blockers.length > 0) {
		addError(
			errors,
			"allow_has_blockers",
			"blockers",
			"allow decisions must not include blockers",
		);
	}
	if (Array.isArray(packet.mismatches) && packet.mismatches.length > 0) {
		addError(
			errors,
			"allow_has_mismatches",
			"mismatches",
			"allow decisions must not include mismatches",
		);
	}
	validateIndependentReviewer(packet, errors);
	validateAllowEvidence(packet, errors);
	validateExpiry(packet, errors);
	validateTimestampOrder(packet, errors);
}

function validateIndependentReviewer(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	const requestedBy = packet.requestedBy;
	const reviewer = packet.reviewer;
	if (!isRecord(requestedBy) || !isRecord(reviewer)) return;
	if (reviewer.independence !== "independent") {
		addError(
			errors,
			"allow_requires_independent_reviewer",
			"reviewer.independence",
			"allow decisions require independent reviewer identity",
		);
	}
	if (reviewer.actorId === requestedBy.actorId) {
		addError(
			errors,
			"self_review_actor",
			"reviewer.actorId",
			"reviewer must differ from requestedBy actor",
		);
	}
	if (reviewer.identityRef === requestedBy.identityRef) {
		addError(
			errors,
			"self_review_identity",
			"reviewer.identityRef",
			"reviewer canonical identity must differ from requestedBy identity",
		);
	}
	if (reviewer.producer === requestedBy.actorId) {
		addError(
			errors,
			"self_review_producer",
			"reviewer.producer",
			"reviewer producer must not be the requesting actor",
		);
	}
	if (reviewer.producer === requestedBy.producer) {
		addError(
			errors,
			"self_review_producer_lineage",
			"reviewer.producer",
			"reviewer producer must differ from requestedBy producer lineage",
		);
	}
	if (reviewer.sourceRef === requestedBy.sourceRef) {
		addError(
			errors,
			"self_review_source",
			"reviewer.sourceRef",
			"reviewer sourceRef must differ from requestedBy sourceRef",
		);
	}
}

function validateAllowEvidence(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	const action = packet.action;
	if (!isRecord(action) || !Array.isArray(packet.requiredEvidence)) return;
	const seenKinds = new Set<string>();
	for (const [index, evidence] of packet.requiredEvidence.entries()) {
		const path = `requiredEvidence[${index}]`;
		if (!isRecord(evidence)) continue;
		if (typeof evidence.kind === "string") {
			seenKinds.add(evidence.kind);
			const expectedPrefix = evidenceRefPrefix(evidence.kind);
			if (!expectedPrefix) {
				addError(
					errors,
					"allow_unsupported_evidence_kind",
					`${path}.kind`,
					"allow decisions require a supported evidence kind",
				);
			} else if (
				typeof evidence.ref === "string" &&
				!evidence.ref.startsWith(expectedPrefix)
			) {
				addError(
					errors,
					"allow_evidence_ref_kind_mismatch",
					`${path}.ref`,
					"evidence ref must use the prefix for its evidence kind",
				);
			}
		}
		if (evidence.status !== "pass") {
			addError(
				errors,
				"allow_requires_passing_evidence",
				`${path}.status`,
				"allow decisions require pass evidence",
			);
		}
		if (evidence.freshness !== "current") {
			addError(
				errors,
				"allow_requires_current_evidence",
				`${path}.freshness`,
				"allow decisions require current evidence",
			);
		}
		if (
			evidence.evidenceUse !== "claim_support" &&
			evidence.evidenceUse !== "governance"
		) {
			addError(
				errors,
				"allow_rejects_orientation_evidence",
				`${path}.evidenceUse`,
				"allow decisions require claim_support or governance evidence",
			);
		}
		if (
			typeof action.headSha === "string" &&
			evidence.headSha !== action.headSha
		) {
			addError(
				errors,
				"allow_head_sha_mismatch",
				`${path}.headSha`,
				"evidence headSha must match action headSha",
			);
		}
	}
	for (const requiredKind of requiredEvidenceKinds(action.kind)) {
		if (!seenKinds.has(requiredKind)) {
			addError(
				errors,
				"allow_missing_required_evidence",
				"requiredEvidence",
				`allow ${String(action.kind)} decisions require ${requiredKind} evidence`,
			);
		}
	}
}

function validateExpiry(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	if (packet.expiresAt === null) return;
	if (
		typeof packet.generatedAt === "string" &&
		typeof packet.expiresAt === "string" &&
		Date.parse(packet.expiresAt) <= Date.parse(packet.generatedAt)
	) {
		addError(
			errors,
			"allow_expired",
			"expiresAt",
			"allow decision must not be expired at generatedAt",
		);
	}
}

function validateTimestampOrder(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	const action = packet.action;
	const reviewer = packet.reviewer;
	if (!isRecord(action) || !isRecord(reviewer)) return;
	const requestedAt = timestampMs(action.requestedAt);
	const reviewedAt = timestampMs(reviewer.reviewedAt);
	const generatedAt = timestampMs(packet.generatedAt);
	if (requestedAt !== null && reviewedAt !== null && reviewedAt < requestedAt) {
		addError(
			errors,
			"review_before_request",
			"reviewer.reviewedAt",
			"reviewedAt must be at or after action.requestedAt",
		);
	}
	if (reviewedAt !== null && generatedAt !== null && generatedAt < reviewedAt) {
		addError(
			errors,
			"generated_before_review",
			"generatedAt",
			"generatedAt must be at or after reviewer.reviewedAt",
		);
	}
	if (!Array.isArray(packet.requiredEvidence)) return;
	for (const [index, evidence] of packet.requiredEvidence.entries()) {
		if (!isRecord(evidence)) continue;
		const verifiedAt = timestampMs(evidence.verifiedAt);
		if (
			requestedAt !== null &&
			verifiedAt !== null &&
			verifiedAt < requestedAt
		) {
			addError(
				errors,
				"evidence_before_request",
				`requiredEvidence[${index}].verifiedAt`,
				"evidence verifiedAt must be at or after action.requestedAt",
			);
		}
		if (
			generatedAt !== null &&
			verifiedAt !== null &&
			verifiedAt > generatedAt
		) {
			addError(
				errors,
				"evidence_after_generation",
				`requiredEvidence[${index}].verifiedAt`,
				"evidence verifiedAt must be at or before generatedAt",
			);
		}
	}
}

function requiredEvidenceKinds(kind: unknown): readonly string[] {
	if (kind === "merge") return REQUIRED_ALLOW_EVIDENCE_KINDS.merge;
	if (kind === "release") return REQUIRED_ALLOW_EVIDENCE_KINDS.release;
	if (kind === "destructive_cleanup") {
		return REQUIRED_ALLOW_EVIDENCE_KINDS.destructive_cleanup;
	}
	if (kind === "external_tracker_mutation") {
		return REQUIRED_ALLOW_EVIDENCE_KINDS.external_tracker_mutation;
	}
	return [];
}

function evidenceRefPrefix(kind: string): string | null {
	if (kind === "delivery_truth") return EVIDENCE_REF_PREFIXES.delivery_truth;
	if (kind === "external_state") return EVIDENCE_REF_PREFIXES.external_state;
	if (kind === "policy_gate") return EVIDENCE_REF_PREFIXES.policy_gate;
	if (kind === "review_state") return EVIDENCE_REF_PREFIXES.review_state;
	if (kind === "validation") return EVIDENCE_REF_PREFIXES.validation;
	return null;
}

function timestampMs(value: unknown): number | null {
	if (typeof value !== "string") return null;
	if (!RFC3339_DATE_TIME_PATTERN.test(value)) return null;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function validateBlockedOrUnknown(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!Array.isArray(packet.blockers) || packet.blockers.length === 0) {
		addError(
			errors,
			"blocked_requires_blocker",
			"blockers",
			"block or unknown decisions require blocker details",
		);
	}
	requireSafePointer(packet.nextAction, "nextAction", errors);
}

function validateMismatchDecision(
	packet: Record<string, unknown>,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!Array.isArray(packet.mismatches) || packet.mismatches.length === 0) {
		addError(
			errors,
			"mismatch_requires_envelopes",
			"mismatches",
			"mismatch decisions require expected and actual action envelopes",
		);
	}
}

function validateNoRawKeys(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) {
			validateNoRawKeys(item, `${path}[${index}]`, errors);
		}
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, nested] of Object.entries(value)) {
		if (RAW_KEY_PATTERN.test(key)) {
			addError(
				errors,
				"raw_or_secret_key",
				`${path}.${key}`,
				"raw prompt, transcript, command output, review body, token, or secret keys are forbidden",
			);
		}
		validateNoRawKeys(nested, `${path}.${key}`, errors);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireAllowedKeys(
	value: Record<string, unknown>,
	allowedKeys: readonly string[],
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	const allowed = new Set(allowedKeys);
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			addError(
				errors,
				"unknown_field",
				`${path}.${key}`,
				"field is not allowed",
			);
		}
	}
}

function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (value !== expected) {
		addError(errors, "invalid_literal", path, `must equal ${expected}`);
	}
}

function requireEnum(
	value: unknown,
	allowed: readonly string[],
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addError(
			errors,
			"invalid_enum",
			path,
			`must be one of ${allowed.join(", ")}`,
		);
	}
}

function requireIso(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (
		typeof value !== "string" ||
		!RFC3339_DATE_TIME_PATTERN.test(value) ||
		!(Date.parse(value) < Infinity)
	) {
		addError(
			errors,
			"invalid_datetime",
			path,
			"must be an RFC3339 date-time string",
		);
	}
}

function requireSafePointer(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (
		typeof value !== "string" ||
		!SAFE_POINTER_PATTERN.test(value) ||
		value.includes("\n")
	) {
		addError(
			errors,
			"invalid_pointer",
			path,
			"must be a compact pointer string",
		);
	}
}

function requireNullableSafePointer(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (value === null) return;
	requireSafePointer(value, path, errors);
}

function requireNullableHeadSha(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (value === null) return;
	if (typeof value !== "string" || !HEAD_SHA_PATTERN.test(value)) {
		addError(
			errors,
			"invalid_head_sha",
			path,
			"must be a 40-character lowercase git SHA or null",
		);
	}
}

function requireNullableInteger(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (value === null) return;
	if (!Number.isInteger(value) || Number(value) < 1) {
		addError(
			errors,
			"invalid_integer",
			path,
			"must be a positive integer or null",
		);
	}
}

function requireArray(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_array", path, "must be an array");
	}
}

function requireNonEmptyArray(
	value: unknown,
	path: string,
	errors: ActionReviewReceiptValidationError[],
) {
	if (!Array.isArray(value) || value.length === 0) {
		addError(
			errors,
			"invalid_non_empty_array",
			path,
			"must be a non-empty array",
		);
	}
}

function addError(
	errors: ActionReviewReceiptValidationError[],
	code: string,
	path: string,
	message: string,
) {
	errors.push({ code, path, message, severity: "error" });
}
