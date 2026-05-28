#!/usr/bin/env node
const { readFileSync } = require("node:fs");

const SCHEMA_VERSION = "action-review-receipt/v1";
const SAFE_POINTER = /^[A-Za-z0-9][A-Za-z0-9:._/@#?=&+,-]{1,255}$/u;
const HEAD_SHA = /^[0-9a-f]{40}$/u;
const RFC3339_DATE_TIME =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const RAW_KEY =
	/(raw|secret|token|password|credential|transcript|prompt|commandOutput|rawOutput|reviewBody)/iu;

const PACKET_KEYS = new Set([
	"schemaVersion",
	"receiptId",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"action",
	"requestedBy",
	"reviewer",
	"decision",
	"requiredEvidence",
	"freshness",
	"expiresAt",
	"blockers",
	"mismatches",
	"nextAction",
	"blockedBy",
]);
const ENVELOPE_KEYS = new Set([
	"actionId",
	"kind",
	"riskTier",
	"targetRef",
	"repository",
	"prNumber",
	"issueRef",
	"headSha",
	"commandRef",
	"requestedAt",
]);
const ACTOR_KEYS = new Set([
	"actorId",
	"identityRef",
	"role",
	"producer",
	"sourceRef",
]);
const REVIEWER_KEYS = new Set([...ACTOR_KEYS, "independence", "reviewedAt"]);
const EVIDENCE_KEYS = new Set([
	"ref",
	"kind",
	"status",
	"freshness",
	"evidenceUse",
	"headSha",
	"verifiedAt",
]);
const BLOCKER_KEYS = new Set(["class", "reason", "nextAction"]);
const MISMATCH_KEYS = new Set(["class", "reason", "expected", "actual"]);

const ACTION_KINDS = new Set([
	"merge",
	"release",
	"destructive_cleanup",
	"external_tracker_mutation",
]);
const DECISIONS = new Set([
	"allow",
	"block",
	"mismatch",
	"unknown",
	"not_applicable",
]);
const FRESHNESS = new Set([
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
]);
const STATUSES = new Set([
	"pass",
	"fail",
	"blocked",
	"unknown",
	"not_applicable",
]);
const SUPPORTING_USES = new Set([
	"claim_support",
	"governance",
	"orientation",
	"audit_trail",
]);
const REQUIRED_ALLOW_EVIDENCE_KINDS = {
	merge: ["delivery_truth", "review_state", "external_state"],
	release: ["delivery_truth", "external_state"],
	destructive_cleanup: ["policy_gate"],
	external_tracker_mutation: ["delivery_truth", "external_state"],
};
const EVIDENCE_REF_PREFIXES = {
	delivery_truth: "delivery-truth:",
	external_state: "external-state:",
	policy_gate: "policy-gate:",
	review_state: "review-state:",
	validation: "validation:",
};
const BLOCKER_CLASSES = new Set([
	"requires_human_authority",
	"requires_external_state_refresh",
	"requires_review_approval",
	"requires_security_review",
	"requires_release_authority",
	"requires_tracker_authority",
	"requires_policy_gate",
	"requires_current_head",
	"mismatched_action_envelope",
]);
const MISMATCH_CLASSES = new Set([
	"action_kind",
	"target",
	"head_sha",
	"actor",
	"scope",
]);

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(errors, code, path, message) {
	errors.push({ code, path, message, severity: "error" });
}

function allowedKeys(value, keys, path, errors) {
	if (!isRecord(value)) return;
	for (const key of Object.keys(value)) {
		if (!keys.has(key))
			add(errors, "unknown_field", `${path}.${key}`, "field is not allowed");
	}
}

function safePointer(value, path, errors) {
	if (
		typeof value !== "string" ||
		!SAFE_POINTER.test(value) ||
		value.includes("\n")
	) {
		add(errors, "invalid_pointer", path, "must be a compact pointer string");
	}
}

function nullablePointer(value, path, errors) {
	if (value !== null) safePointer(value, path, errors);
}

function iso(value, path, errors) {
	if (
		typeof value !== "string" ||
		!RFC3339_DATE_TIME.test(value) ||
		!(Date.parse(value) < Infinity)
	) {
		add(
			errors,
			"invalid_datetime",
			path,
			"must be an RFC3339 date-time string",
		);
	}
}

function enumValue(value, allowed, path, errors) {
	if (typeof value !== "string" || !allowed.has(value)) {
		add(errors, "invalid_enum", path, "must use a supported enum value");
	}
}

function nullableHeadSha(value, path, errors) {
	if (value !== null && (typeof value !== "string" || !HEAD_SHA.test(value))) {
		add(
			errors,
			"invalid_head_sha",
			path,
			"must be a lowercase 40-character SHA or null",
		);
	}
}

function nullableInteger(value, path, errors) {
	if (value !== null && (!Number.isInteger(value) || value < 1)) {
		add(errors, "invalid_integer", path, "must be a positive integer or null");
	}
}

function scanRawKeys(value, path, errors) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			scanRawKeys(item, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, nested] of Object.entries(value)) {
		if (RAW_KEY.test(key)) {
			add(
				errors,
				"raw_or_secret_key",
				`${path}.${key}`,
				"raw prompt, transcript, command output, review body, token, or secret keys are forbidden",
			);
		}
		scanRawKeys(nested, `${path}.${key}`, errors);
	}
}

function validateEnvelope(value, path, errors) {
	if (!isRecord(value)) {
		add(errors, "invalid_envelope", path, "must be an object");
		return;
	}
	allowedKeys(value, ENVELOPE_KEYS, path, errors);
	safePointer(value.actionId, `${path}.actionId`, errors);
	enumValue(value.kind, ACTION_KINDS, `${path}.kind`, errors);
	enumValue(
		value.riskTier,
		new Set(["high", "critical"]),
		`${path}.riskTier`,
		errors,
	);
	safePointer(value.targetRef, `${path}.targetRef`, errors);
	nullablePointer(value.repository, `${path}.repository`, errors);
	nullableInteger(value.prNumber, `${path}.prNumber`, errors);
	nullablePointer(value.issueRef, `${path}.issueRef`, errors);
	nullableHeadSha(value.headSha, `${path}.headSha`, errors);
	nullablePointer(value.commandRef, `${path}.commandRef`, errors);
	iso(value.requestedAt, `${path}.requestedAt`, errors);
	if (value.kind === "merge") {
		if (value.repository === null)
			add(
				errors,
				"missing_repository",
				`${path}.repository`,
				"merge actions require repository",
			);
		if (value.prNumber === null)
			add(
				errors,
				"missing_pr_number",
				`${path}.prNumber`,
				"merge actions require prNumber",
			);
		if (value.headSha === null)
			add(
				errors,
				"missing_head_sha",
				`${path}.headSha`,
				"merge actions require headSha",
			);
	}
	if (value.kind === "release") {
		if (value.repository === null)
			add(
				errors,
				"missing_repository",
				`${path}.repository`,
				"release actions require repository",
			);
		if (value.headSha === null)
			add(
				errors,
				"missing_head_sha",
				`${path}.headSha`,
				"release actions require headSha",
			);
	}
	if (value.kind === "destructive_cleanup" && value.commandRef === null) {
		add(
			errors,
			"missing_command_ref",
			`${path}.commandRef`,
			"destructive cleanup actions require commandRef",
		);
	}
	if (value.kind === "external_tracker_mutation" && value.issueRef === null) {
		add(
			errors,
			"missing_issue_ref",
			`${path}.issueRef`,
			"external tracker mutations require issueRef",
		);
	}
}

function validateActor(value, path, keys, errors) {
	if (!isRecord(value)) {
		add(errors, "invalid_actor", path, "must be an object");
		return;
	}
	allowedKeys(value, keys, path, errors);
	safePointer(value.actorId, `${path}.actorId`, errors);
	safePointer(value.identityRef, `${path}.identityRef`, errors);
	safePointer(value.role, `${path}.role`, errors);
	safePointer(value.producer, `${path}.producer`, errors);
	safePointer(value.sourceRef, `${path}.sourceRef`, errors);
}

function validateEvidence(packet, errors) {
	if (
		!Array.isArray(packet.requiredEvidence) ||
		packet.requiredEvidence.length === 0
	) {
		add(
			errors,
			"invalid_non_empty_array",
			"requiredEvidence",
			"must be a non-empty array",
		);
		return;
	}
	packet.requiredEvidence.forEach((entry, index) => {
		const path = `requiredEvidence[${index}]`;
		if (!isRecord(entry)) {
			add(errors, "invalid_evidence", path, "must be an object");
			return;
		}
		allowedKeys(entry, EVIDENCE_KEYS, path, errors);
		safePointer(entry.ref, `${path}.ref`, errors);
		safePointer(entry.kind, `${path}.kind`, errors);
		enumValue(entry.status, STATUSES, `${path}.status`, errors);
		enumValue(entry.freshness, FRESHNESS, `${path}.freshness`, errors);
		enumValue(
			entry.evidenceUse,
			SUPPORTING_USES,
			`${path}.evidenceUse`,
			errors,
		);
		nullableHeadSha(entry.headSha, `${path}.headSha`, errors);
		iso(entry.verifiedAt, `${path}.verifiedAt`, errors);
	});
}

function validateBlockers(value, errors) {
	if (!Array.isArray(value)) {
		add(errors, "invalid_array", "blockers", "must be an array");
		return;
	}
	value.forEach((entry, index) => {
		const path = `blockers[${index}]`;
		if (!isRecord(entry)) {
			add(errors, "invalid_blocker", path, "must be an object");
			return;
		}
		allowedKeys(entry, BLOCKER_KEYS, path, errors);
		enumValue(entry.class, BLOCKER_CLASSES, `${path}.class`, errors);
		safePointer(entry.reason, `${path}.reason`, errors);
		safePointer(entry.nextAction, `${path}.nextAction`, errors);
	});
}

function validateMismatches(value, errors) {
	if (!Array.isArray(value)) {
		add(errors, "invalid_array", "mismatches", "must be an array");
		return;
	}
	value.forEach((entry, index) => {
		const path = `mismatches[${index}]`;
		if (!isRecord(entry)) {
			add(errors, "invalid_mismatch", path, "must be an object");
			return;
		}
		allowedKeys(entry, MISMATCH_KEYS, path, errors);
		enumValue(entry.class, MISMATCH_CLASSES, `${path}.class`, errors);
		safePointer(entry.reason, `${path}.reason`, errors);
		validateEnvelope(entry.expected, `${path}.expected`, errors);
		validateEnvelope(entry.actual, `${path}.actual`, errors);
	});
}

function validateSemantics(packet, errors) {
	if (packet.decision === "allow") {
		if (packet.freshness !== "current")
			add(
				errors,
				"allow_requires_current_freshness",
				"freshness",
				"allow decisions require current freshness",
			);
		if (packet.blockers?.length > 0)
			add(
				errors,
				"allow_has_blockers",
				"blockers",
				"allow decisions must not include blockers",
			);
		if (packet.mismatches?.length > 0)
			add(
				errors,
				"allow_has_mismatches",
				"mismatches",
				"allow decisions must not include mismatches",
			);
		if (packet.reviewer?.independence !== "independent")
			add(
				errors,
				"allow_requires_independent_reviewer",
				"reviewer.independence",
				"allow decisions require independent reviewer identity",
			);
		if (packet.reviewer?.actorId === packet.requestedBy?.actorId)
			add(
				errors,
				"self_review_actor",
				"reviewer.actorId",
				"reviewer must differ from requestedBy actor",
			);
		if (packet.reviewer?.identityRef === packet.requestedBy?.identityRef)
			add(
				errors,
				"self_review_identity",
				"reviewer.identityRef",
				"reviewer canonical identity must differ from requestedBy identity",
			);
		if (packet.reviewer?.producer === packet.requestedBy?.actorId)
			add(
				errors,
				"self_review_producer",
				"reviewer.producer",
				"reviewer producer must not be the requesting actor",
			);
		if (packet.reviewer?.producer === packet.requestedBy?.producer)
			add(
				errors,
				"self_review_producer_lineage",
				"reviewer.producer",
				"reviewer producer must differ from requestedBy producer lineage",
			);
		if (packet.reviewer?.sourceRef === packet.requestedBy?.sourceRef)
			add(
				errors,
				"self_review_source",
				"reviewer.sourceRef",
				"reviewer sourceRef must differ from requestedBy sourceRef",
			);
		if (
			typeof packet.expiresAt === "string" &&
			Date.parse(packet.expiresAt) <= Date.parse(packet.generatedAt)
		)
			add(
				errors,
				"allow_expired",
				"expiresAt",
				"allow decision must not be expired at generatedAt",
			);
		const seenKinds = new Set();
		for (const [index, evidence] of (packet.requiredEvidence ?? []).entries()) {
			if (typeof evidence.kind === "string") {
				seenKinds.add(evidence.kind);
				const expectedPrefix = evidenceRefPrefix(evidence.kind);
				if (!expectedPrefix)
					add(
						errors,
						"allow_unsupported_evidence_kind",
						`requiredEvidence[${index}].kind`,
						"allow decisions require a supported evidence kind",
					);
				else if (
					typeof evidence.ref === "string" &&
					!evidence.ref.startsWith(expectedPrefix)
				)
					add(
						errors,
						"allow_evidence_ref_kind_mismatch",
						`requiredEvidence[${index}].ref`,
						"evidence ref must use the prefix for its evidence kind",
					);
			}
			if (evidence.status !== "pass")
				add(
					errors,
					"allow_requires_passing_evidence",
					`requiredEvidence[${index}].status`,
					"allow decisions require pass evidence",
				);
			if (evidence.freshness !== "current")
				add(
					errors,
					"allow_requires_current_evidence",
					`requiredEvidence[${index}].freshness`,
					"allow decisions require current evidence",
				);
			if (!["claim_support", "governance"].includes(evidence.evidenceUse))
				add(
					errors,
					"allow_rejects_orientation_evidence",
					`requiredEvidence[${index}].evidenceUse`,
					"allow decisions require claim_support or governance evidence",
				);
			if (
				typeof packet.action?.headSha === "string" &&
				evidence.headSha !== packet.action.headSha
			)
				add(
					errors,
					"allow_head_sha_mismatch",
					`requiredEvidence[${index}].headSha`,
					"evidence headSha must match action headSha",
				);
		}
		for (const requiredKind of requiredEvidenceKinds(packet.action?.kind)) {
			if (!seenKinds.has(requiredKind))
				add(
					errors,
					"allow_missing_required_evidence",
					"requiredEvidence",
					`allow ${String(packet.action?.kind)} decisions require ${requiredKind} evidence`,
				);
		}
		validateTimestampOrder(packet, errors);
	}
	if (
		(packet.decision === "block" || packet.decision === "unknown") &&
		(!Array.isArray(packet.blockers) || packet.blockers.length === 0)
	) {
		add(
			errors,
			"blocked_requires_blocker",
			"blockers",
			"block or unknown decisions require blocker details",
		);
	}
	if (
		packet.decision === "mismatch" &&
		(!Array.isArray(packet.mismatches) || packet.mismatches.length === 0)
	) {
		add(
			errors,
			"mismatch_requires_envelopes",
			"mismatches",
			"mismatch decisions require expected and actual action envelopes",
		);
	}
	if (packet.decision === "not_applicable") {
		add(
			errors,
			"not_applicable_rejected_for_high_risk_action",
			"decision",
			"not_applicable is not valid for high-risk action reviews",
		);
	}
}

function requiredEvidenceKinds(kind) {
	return REQUIRED_ALLOW_EVIDENCE_KINDS[kind] ?? [];
}

function evidenceRefPrefix(kind) {
	return EVIDENCE_REF_PREFIXES[kind] ?? null;
}

function timestampMs(value) {
	if (typeof value !== "string") return null;
	if (!RFC3339_DATE_TIME.test(value)) return null;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function validateTimestampOrder(packet, errors) {
	const requestedAt = timestampMs(packet.action?.requestedAt);
	const reviewedAt = timestampMs(packet.reviewer?.reviewedAt);
	const generatedAt = timestampMs(packet.generatedAt);
	if (requestedAt !== null && reviewedAt !== null && reviewedAt < requestedAt)
		add(
			errors,
			"review_before_request",
			"reviewer.reviewedAt",
			"reviewedAt must be at or after action.requestedAt",
		);
	if (reviewedAt !== null && generatedAt !== null && generatedAt < reviewedAt)
		add(
			errors,
			"generated_before_review",
			"generatedAt",
			"generatedAt must be at or after reviewer.reviewedAt",
		);
	for (const [index, evidence] of (packet.requiredEvidence ?? []).entries()) {
		const verifiedAt = timestampMs(evidence.verifiedAt);
		if (requestedAt !== null && verifiedAt !== null && verifiedAt < requestedAt)
			add(
				errors,
				"evidence_before_request",
				`requiredEvidence[${index}].verifiedAt`,
				"evidence verifiedAt must be at or after action.requestedAt",
			);
		if (generatedAt !== null && verifiedAt !== null && verifiedAt > generatedAt)
			add(
				errors,
				"evidence_after_generation",
				`requiredEvidence[${index}].verifiedAt`,
				"evidence verifiedAt must be at or before generatedAt",
			);
	}
}

function validate(packet) {
	const errors = [];
	scanRawKeys(packet, "packet", errors);
	if (!isRecord(packet)) {
		add(errors, "invalid_packet", "packet", "must be an object");
		return { valid: false, errors };
	}
	allowedKeys(packet, PACKET_KEYS, "packet", errors);
	if (packet.schemaVersion !== SCHEMA_VERSION)
		add(
			errors,
			"invalid_literal",
			"schemaVersion",
			`must equal ${SCHEMA_VERSION}`,
		);
	safePointer(packet.receiptId, "receiptId", errors);
	iso(packet.generatedAt, "generatedAt", errors);
	safePointer(packet.producer, "producer", errors);
	if (packet.runtimeStatus !== "not_yet_emitted")
		add(
			errors,
			"invalid_literal",
			"runtimeStatus",
			"must equal not_yet_emitted",
		);
	enumValue(
		packet.evidenceUse,
		new Set(["orientation", "audit_trail", "governance"]),
		"evidenceUse",
		errors,
	);
	enumValue(packet.decision, DECISIONS, "decision", errors);
	enumValue(packet.freshness, FRESHNESS, "freshness", errors);
	if (packet.expiresAt !== null) iso(packet.expiresAt, "expiresAt", errors);
	validateEnvelope(packet.action, "action", errors);
	validateActor(packet.requestedBy, "requestedBy", ACTOR_KEYS, errors);
	validateActor(packet.reviewer, "reviewer", REVIEWER_KEYS, errors);
	if (isRecord(packet.reviewer)) {
		enumValue(
			packet.reviewer.independence,
			new Set(["independent", "self", "unknown"]),
			"reviewer.independence",
			errors,
		);
		iso(packet.reviewer.reviewedAt, "reviewer.reviewedAt", errors);
	}
	validateEvidence(packet, errors);
	validateBlockers(packet.blockers, errors);
	validateMismatches(packet.mismatches, errors);
	safePointer(packet.nextAction, "nextAction", errors);
	safePointer(packet.blockedBy, "blockedBy", errors);
	validateSemantics(packet, errors);
	return { valid: errors.length === 0, errors };
}

function main() {
	const file = process.argv[2];
	if (!file) {
		process.stderr.write(
			"Usage: validate-action-review-receipt.cjs <packet.json>\n",
		);
		process.exitCode = 2;
		return;
	}
	const packet = JSON.parse(readFileSync(file, "utf8"));
	const result = validate(packet);
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	process.exitCode = result.valid ? 0 : 1;
}

if (require.main === module) main();

module.exports = { validate };
