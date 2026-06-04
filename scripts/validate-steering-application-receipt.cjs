#!/usr/bin/env node

const { readFileSync } = require("node:fs");

const SCHEMA_VERSION = "steering-application-receipt/v1";
const SAFE_POINTER = /^[A-Za-z0-9#][A-Za-z0-9._:/#@+-]{0,511}$/u;
const HEAD_SHA = /^[a-f0-9]{7,64}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const RAW_KEY =
	/(?:secret|token|credential|password|prompt|transcript|commandOutput|rawOutput|rawSteering|instructionText)/iu;

const PACKET_KEYS = new Set([
	"schemaVersion",
	"receiptId",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"headSha",
	"queuePacketRef",
	"queueItemId",
	"queueItemState",
	"expectedContext",
	"currentContext",
	"runtimeCardUpdateRef",
	"application",
	"stalePreconditions",
	"blockers",
	"nextAction",
	"blockedBy",
]);
const CONTEXT_KEYS = new Set([
	"threadId",
	"turnId",
	"clientUserMessageId",
	"headSha",
]);
const RUNTIME_CARD_KEYS = new Set([
	"ref",
	"headSha",
	"producedAt",
	"receiptId",
]);
const APPLICATION_KEYS = new Set([
	"decision",
	"decidedAt",
	"reason",
	"appliedClientUserMessageId",
]);
const BLOCKER_KEYS = new Set(["class", "reason", "nextAction", "evidenceRef"]);
const STALE_KEYS = new Set(["kind", "expected", "actual", "evidenceRef"]);
const EVIDENCE_USES = new Set(["orientation", "audit_trail", "governance"]);
const STATES = new Set([
	"pending",
	"applicable",
	"applied",
	"rejected",
	"expired",
	"superseded",
	"stale",
]);
const DECISIONS = new Set(["applied", "rejected", "blocked"]);
const STALE_KINDS = new Set([
	"stale_turn",
	"stale_thread",
	"stale_client_user_message",
	"stale_head",
	"instruction_hash_mismatch",
	"instruction_hash_unverifiable",
	"artifact_identity_mismatch",
	"superseded_artifact",
	"expired_queue",
	"missing_artifact",
	"rejected_steering",
	"already_applied",
	"terminal_conflict",
]);
const BLOCKER_CLASSES = new Set([
	"stale_context",
	"expired_steering",
	"superseded_steering",
	"missing_runtime_card_update",
	"runtime_card_head_mismatch",
	"stale_precondition",
	"queue_item_not_applicable",
	"producer_not_wired",
]);

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(errors, code, path, message) {
	errors.push({ code, path, message });
}

function allowed(value, keys, path, errors) {
	if (!isRecord(value)) return;
	for (const key of Object.keys(value)) {
		if (!keys.has(key))
			add(errors, "unknown_key", `${path}.${key}`, "is not allowed");
	}
}

function safePointer(value, path, errors) {
	if (typeof value !== "string" || !SAFE_POINTER.test(value)) {
		add(errors, "invalid_pointer", path, "must be a safe pointer");
	}
}

function nullableSafePointer(value, path, errors) {
	if (value !== null) safePointer(value, path, errors);
}

function headSha(value, path, errors) {
	if (typeof value !== "string" || !HEAD_SHA.test(value)) {
		add(errors, "invalid_head_sha", path, "must be a git head SHA");
	}
}

function iso(value, path, errors) {
	if (
		typeof value !== "string" ||
		!ISO_TIMESTAMP.test(value) ||
		Number.isNaN(Date.parse(value))
	) {
		add(errors, "invalid_timestamp", path, "must be an ISO UTC timestamp");
	}
}

function enumValue(value, allowedValues, path, errors) {
	if (typeof value !== "string" || !allowedValues.has(value)) {
		add(errors, "invalid_enum", path, "must use a supported value");
	}
}

function rejectRawKeys(value, path, errors) {
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) {
			rejectRawKeys(item, `${path}[${index}]`, errors);
		}
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, child] of Object.entries(value)) {
		if (RAW_KEY.test(key)) {
			add(errors, "raw_or_sensitive_field", `${path}.${key}`, "is not allowed");
		}
		rejectRawKeys(child, `${path}.${key}`, errors);
	}
}

function validateContext(value, path, errors) {
	if (!isRecord(value)) {
		add(errors, "invalid_context", path, "must be an object");
		return;
	}
	allowed(value, CONTEXT_KEYS, path, errors);
	nullableSafePointer(value.threadId, `${path}.threadId`, errors);
	nullableSafePointer(value.turnId, `${path}.turnId`, errors);
	nullableSafePointer(
		value.clientUserMessageId,
		`${path}.clientUserMessageId`,
		errors,
	);
	headSha(value.headSha, `${path}.headSha`, errors);
}

function validateRuntimeCard(value, path, errors) {
	if (value === null) return;
	if (!isRecord(value)) {
		add(
			errors,
			"invalid_runtime_card_update",
			path,
			"must be null or an object",
		);
		return;
	}
	allowed(value, RUNTIME_CARD_KEYS, path, errors);
	safePointer(value.ref, `${path}.ref`, errors);
	headSha(value.headSha, `${path}.headSha`, errors);
	iso(value.producedAt, `${path}.producedAt`, errors);
	nullableSafePointer(value.receiptId, `${path}.receiptId`, errors);
}

function validateApplication(value, path, errors) {
	if (!isRecord(value)) {
		add(errors, "invalid_application", path, "must be an object");
		return;
	}
	allowed(value, APPLICATION_KEYS, path, errors);
	enumValue(value.decision, DECISIONS, `${path}.decision`, errors);
	iso(value.decidedAt, `${path}.decidedAt`, errors);
	safePointer(value.reason, `${path}.reason`, errors);
	nullableSafePointer(
		value.appliedClientUserMessageId,
		`${path}.appliedClientUserMessageId`,
		errors,
	);
}

function validateStalePrecondition(value, path, errors) {
	if (!isRecord(value)) {
		add(errors, "invalid_stale_precondition", path, "must be an object");
		return;
	}
	allowed(value, STALE_KEYS, path, errors);
	enumValue(value.kind, STALE_KINDS, `${path}.kind`, errors);
	safePointer(value.expected, `${path}.expected`, errors);
	safePointer(value.actual, `${path}.actual`, errors);
	safePointer(value.evidenceRef, `${path}.evidenceRef`, errors);
}

function validateBlocker(value, path, errors) {
	if (!isRecord(value)) {
		add(errors, "invalid_blocker", path, "must be an object");
		return;
	}
	allowed(value, BLOCKER_KEYS, path, errors);
	enumValue(value.class, BLOCKER_CLASSES, `${path}.class`, errors);
	safePointer(value.reason, `${path}.reason`, errors);
	safePointer(value.nextAction, `${path}.nextAction`, errors);
	safePointer(value.evidenceRef, `${path}.evidenceRef`, errors);
}

function validateShape(packet, errors) {
	if (!isRecord(packet)) {
		add(errors, "invalid_packet", "packet", "must be an object");
		return;
	}
	allowed(packet, PACKET_KEYS, "packet", errors);
	if (packet.schemaVersion !== SCHEMA_VERSION) {
		add(
			errors,
			"invalid_schema_version",
			"schemaVersion",
			`must be ${SCHEMA_VERSION}`,
		);
	}
	safePointer(packet.receiptId, "receiptId", errors);
	iso(packet.generatedAt, "generatedAt", errors);
	safePointer(packet.producer, "producer", errors);
	if (packet.runtimeStatus !== "not_yet_emitted") {
		add(
			errors,
			"invalid_runtime_status",
			"runtimeStatus",
			"must be not_yet_emitted",
		);
	}
	enumValue(packet.evidenceUse, EVIDENCE_USES, "evidenceUse", errors);
	headSha(packet.headSha, "headSha", errors);
	safePointer(packet.queuePacketRef, "queuePacketRef", errors);
	safePointer(packet.queueItemId, "queueItemId", errors);
	enumValue(packet.queueItemState, STATES, "queueItemState", errors);
	validateContext(packet.expectedContext, "expectedContext", errors);
	validateContext(packet.currentContext, "currentContext", errors);
	validateRuntimeCard(
		packet.runtimeCardUpdateRef,
		"runtimeCardUpdateRef",
		errors,
	);
	validateApplication(packet.application, "application", errors);
	validateStalePreconditions(packet.stalePreconditions, errors);
	validateBlockers(packet.blockers, errors);
	safePointer(packet.nextAction, "nextAction", errors);
	safePointer(packet.blockedBy, "blockedBy", errors);
}

function validateStalePreconditions(value, errors) {
	if (!Array.isArray(value)) {
		add(
			errors,
			"invalid_stale_preconditions",
			"stalePreconditions",
			"must be an array",
		);
		return;
	}
	for (const [index, item] of value.entries()) {
		validateStalePrecondition(item, `stalePreconditions[${index}]`, errors);
	}
}

function validateBlockers(value, errors) {
	if (!Array.isArray(value)) {
		add(errors, "invalid_blockers", "blockers", "must be an array");
		return;
	}
	for (const [index, item] of value.entries()) {
		validateBlocker(item, `blockers[${index}]`, errors);
	}
}

function validateSemantics(packet, errors) {
	if (
		!isRecord(packet) ||
		!isRecord(packet.expectedContext) ||
		!isRecord(packet.currentContext) ||
		!isRecord(packet.application)
	) {
		return;
	}
	validateContextFreshness(packet, errors);
	validateAppliedSemantics(packet, errors);
	validateRuntimeCardSemantics(packet, errors);
	validateBlockedOrRejectedSemantics(packet, errors);
}

function validateContextFreshness(packet, errors) {
	if (packet.headSha !== packet.currentContext.headSha) {
		add(
			errors,
			"current_head_mismatch",
			"currentContext.headSha",
			"must match receipt headSha",
		);
	}
	for (const key of ["threadId", "turnId", "clientUserMessageId", "headSha"]) {
		if (
			packet.expectedContext[key] !== null &&
			packet.expectedContext[key] !== packet.currentContext[key]
		) {
			add(
				errors,
				"expected_current_mismatch",
				`currentContext.${key}`,
				"must match non-null expectedContext value",
			);
		}
	}
}

function validateAppliedSemantics(packet, errors) {
	if (packet.application.decision !== "applied") return;
	if (packet.queueItemState !== "applicable") {
		add(
			errors,
			"applied_requires_applicable_item",
			"queueItemState",
			"applied receipts require an applicable queue item",
		);
	}
	if (
		Array.isArray(packet.stalePreconditions) &&
		packet.stalePreconditions.length > 0
	) {
		add(
			errors,
			"applied_with_stale_preconditions",
			"stalePreconditions",
			"applied receipts must not include stale preconditions",
		);
	}
	if (Array.isArray(packet.blockers) && packet.blockers.length > 0) {
		add(
			errors,
			"applied_with_blockers",
			"blockers",
			"applied receipts must not include blockers",
		);
	}
	if (
		packet.currentContext.turnId === null &&
		packet.currentContext.clientUserMessageId === null
	) {
		add(
			errors,
			"missing_current_runtime_identity",
			"currentContext",
			"applied receipts require a current turnId or clientUserMessageId",
		);
	}
	if (packet.application.appliedClientUserMessageId === null) {
		add(
			errors,
			"missing_applied_client_user_message_id",
			"application.appliedClientUserMessageId",
			"applied receipts require explicit applied client user-message evidence",
		);
	} else if (
		packet.application.appliedClientUserMessageId !==
		packet.currentContext.clientUserMessageId
	) {
		add(
			errors,
			"applied_client_user_message_mismatch",
			"application.appliedClientUserMessageId",
			"must match currentContext.clientUserMessageId",
		);
	}
	if (packet.runtimeCardUpdateRef === null) {
		add(
			errors,
			"missing_runtime_card_update_ref",
			"runtimeCardUpdateRef",
			"applied receipts require a runtime-card update ref",
		);
	}
}

function validateRuntimeCardSemantics(packet, errors) {
	if (!isRecord(packet.runtimeCardUpdateRef)) return;
	if (packet.runtimeCardUpdateRef.headSha !== packet.headSha) {
		add(
			errors,
			"runtime_card_receipt_head_mismatch",
			"runtimeCardUpdateRef.headSha",
			"must match receipt headSha",
		);
	}
	if (packet.runtimeCardUpdateRef.headSha !== packet.currentContext.headSha) {
		add(
			errors,
			"runtime_card_current_head_mismatch",
			"runtimeCardUpdateRef.headSha",
			"must match currentContext.headSha",
		);
	}
}

function validateBlockedOrRejectedSemantics(packet, errors) {
	if (packet.application.decision === "applied") return;
	if (!Array.isArray(packet.blockers) || packet.blockers.length === 0) {
		add(
			errors,
			"blocked_receipt_requires_blocker",
			"blockers",
			"blocked or rejected receipts require at least one blocker",
		);
	}
	const staleKinds = new Set(
		Array.isArray(packet.stalePreconditions)
			? packet.stalePreconditions.filter(isRecord).map((item) => item.kind)
			: [],
	);
	if (packet.queueItemState === "expired" && !staleKinds.has("expired_queue")) {
		add(
			errors,
			"expired_receipt_requires_stale_precondition",
			"stalePreconditions",
			"expired queue items require an expired_queue precondition",
		);
	}
	if (
		packet.queueItemState === "superseded" &&
		!staleKinds.has("superseded_artifact")
	) {
		add(
			errors,
			"superseded_receipt_requires_stale_precondition",
			"stalePreconditions",
			"superseded queue items require a superseded_artifact precondition",
		);
	}
}

function validate(packet) {
	const errors = [];
	rejectRawKeys(packet, "packet", errors);
	validateShape(packet, errors);
	validateSemantics(packet, errors);
	return errors;
}

function main() {
	const packetPath = process.argv[2];
	if (!packetPath) {
		console.error(
			"usage: validate-steering-application-receipt.cjs <packet.json>",
		);
		process.exit(2);
	}
	const packet = JSON.parse(readFileSync(packetPath, "utf8"));
	const errors = validate(packet);
	console.log(
		JSON.stringify(
			{
				schemaVersion: "steering-application-receipt-validation/v1",
				status: errors.length === 0 ? "pass" : "fail",
				errors,
			},
			null,
			2,
		),
	);
	process.exit(errors.length === 0 ? 0 : 1);
}

main();
