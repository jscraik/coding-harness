#!/usr/bin/env node
const { readFileSync } = require("node:fs");

const SCHEMA_VERSION = "steering-queue/v1";
const SAFE_POINTER_PATTERN = /^[A-Za-z0-9#][A-Za-z0-9._:/#@+-]{0,511}$/u;
const HEAD_SHA_PATTERN = /^[a-f0-9]{7,64}$/u;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const ISO_TIMESTAMP_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const STATES = new Set([
	"pending",
	"applicable",
	"applied",
	"rejected",
	"expired",
	"superseded",
	"stale",
]);
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
const PROVENANCE_KINDS = new Set([
	"harness_artifact",
	"runtime_card",
	"review_artifact",
	"goal_artifact",
	"external_snapshot_ref",
]);
const DELIVERY_MODES = new Set([
	"next_turn",
	"same_thread_continuation",
	"pr_triage_followup",
	"manual_resume",
	"unknown",
]);
const PACKET_KEYS = new Set([
	"schemaVersion",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"headSha",
	"threadId",
	"turnId",
	"clientUserMessageId",
	"evaluatedAt",
	"selectedItemId",
	"items",
	"summary",
	"blockedBy",
]);
const ITEM_KEYS = new Set([
	"id",
	"scopeRef",
	"createdAt",
	"expiresAt",
	"sourceRef",
	"instructionRef",
	"instructionHash",
	"instructionHashAlgorithm",
	"instructionCanonicalizationVersion",
	"instructionProvenanceKind",
	"deliveryMode",
	"expectedThreadId",
	"expectedTurnId",
	"expectedClientUserMessageId",
	"expectedHeadSha",
	"priority",
	"requiredArtifacts",
	"supersedes",
	"supersededBy",
	"state",
	"stateReason",
	"appliedClientUserMessageId",
	"stateAt",
	"appliedAt",
	"rejectedAt",
	"supersededAt",
	"stalePreconditions",
]);
const ARTIFACT_KEYS = new Set([
	"artifactRef",
	"headSha",
	"producedAt",
	"sha256",
	"receiptId",
]);
const STALE_KEYS = new Set(["kind", "expected", "actual", "evidenceRef"]);
const SUMMARY_KEYS = new Set([
	"total",
	"pending",
	"applicable",
	"applied",
	"rejected",
	"expired",
	"superseded",
	"stale",
]);

function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(errors, path, message) {
	errors.push({ path, message });
}

function allowedKeys(value, allowed, path, errors) {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) add(errors, `${path}.${key}`, "is not allowed");
	}
}

function safePointer(value) {
	return typeof value === "string" && SAFE_POINTER_PATTERN.test(value);
}

function requireSafe(value, path, errors) {
	if (!safePointer(value))
		add(errors, path, "must be a safe non-empty pointer");
}

function requireNullableSafe(value, path, errors) {
	if (value !== null) requireSafe(value, path, errors);
}

function requireIso(value, path, errors) {
	if (
		typeof value !== "string" ||
		!ISO_TIMESTAMP_PATTERN.test(value) ||
		Number.isNaN(Date.parse(value))
	) {
		add(errors, path, "must be an ISO UTC timestamp");
	}
}

function requireNullableIso(value, path, errors) {
	if (value !== null) requireIso(value, path, errors);
}

function requireSha(value, path, errors) {
	if (typeof value !== "string" || !HEAD_SHA_PATTERN.test(value)) {
		add(errors, path, "must be a git head SHA");
	}
}

function requireDigest(value, path, errors) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		add(errors, path, "must be sha256:<hex>");
	}
}

function requireEnum(value, values, path, errors) {
	if (typeof value !== "string" || !values.has(value)) {
		add(errors, path, "has an unrecognized value");
	}
}

function rejectRawKeys(value, path, errors) {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			rejectRawKeys(entry, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isObject(value)) return;
	for (const [key, entry] of Object.entries(value)) {
		if (
			/(secret|token|credential|password|prompt|transcript|rawSteering|instructionText)/iu.test(
				key,
			)
		) {
			add(errors, `${path}.${key}`, "raw or sensitive fields are not allowed");
		}
		rejectRawKeys(entry, `${path}.${key}`, errors);
	}
}

function validateArtifact(value, path, errors) {
	if (!isObject(value)) {
		add(errors, path, "must be an object");
		return;
	}
	allowedKeys(value, ARTIFACT_KEYS, path, errors);
	requireSafe(value.artifactRef, `${path}.artifactRef`, errors);
	requireSha(value.headSha, `${path}.headSha`, errors);
	requireIso(value.producedAt, `${path}.producedAt`, errors);
	if (value.sha256 !== null)
		requireDigest(value.sha256, `${path}.sha256`, errors);
	requireNullableSafe(value.receiptId, `${path}.receiptId`, errors);
}

function validateStalePrecondition(value, path, errors) {
	if (!isObject(value)) {
		add(errors, path, "must be an object");
		return;
	}
	allowedKeys(value, STALE_KEYS, path, errors);
	requireEnum(value.kind, STALE_KINDS, `${path}.kind`, errors);
	requireSafe(value.expected, `${path}.expected`, errors);
	requireSafe(value.actual, `${path}.actual`, errors);
	requireSafe(value.evidenceRef, `${path}.evidenceRef`, errors);
}

function validateItem(value, index, ids, errors) {
	const path = `items[${index}]`;
	if (!isObject(value)) {
		add(errors, path, "must be an object");
		return;
	}
	allowedKeys(value, ITEM_KEYS, path, errors);
	requireSafe(value.id, `${path}.id`, errors);
	if (typeof value.id === "string") {
		if (ids.has(value.id)) add(errors, `${path}.id`, "must be unique");
		ids.add(value.id);
	}
	requireSafe(value.scopeRef, `${path}.scopeRef`, errors);
	requireIso(value.createdAt, `${path}.createdAt`, errors);
	requireIso(value.expiresAt, `${path}.expiresAt`, errors);
	requireSafe(value.sourceRef, `${path}.sourceRef`, errors);
	requireSafe(value.instructionRef, `${path}.instructionRef`, errors);
	requireDigest(value.instructionHash, `${path}.instructionHash`, errors);
	if (value.instructionHashAlgorithm !== "sha256") {
		add(errors, `${path}.instructionHashAlgorithm`, "must be sha256");
	}
	if (
		value.instructionCanonicalizationVersion !==
		"steering-instruction-text-lf/v1"
	) {
		add(
			errors,
			`${path}.instructionCanonicalizationVersion`,
			"has unsupported canonicalization",
		);
	}
	requireEnum(
		value.instructionProvenanceKind,
		PROVENANCE_KINDS,
		`${path}.instructionProvenanceKind`,
		errors,
	);
	requireEnum(
		value.deliveryMode,
		DELIVERY_MODES,
		`${path}.deliveryMode`,
		errors,
	);
	requireNullableSafe(
		value.expectedThreadId,
		`${path}.expectedThreadId`,
		errors,
	);
	requireNullableSafe(value.expectedTurnId, `${path}.expectedTurnId`, errors);
	requireNullableSafe(
		value.expectedClientUserMessageId,
		`${path}.expectedClientUserMessageId`,
		errors,
	);
	requireSha(value.expectedHeadSha, `${path}.expectedHeadSha`, errors);
	if (!Number.isInteger(value.priority))
		add(errors, `${path}.priority`, "must be an integer");
	if (!Array.isArray(value.requiredArtifacts)) {
		add(errors, `${path}.requiredArtifacts`, "must be an array");
	} else
		value.requiredArtifacts.forEach((entry, artifactIndex) => {
			validateArtifact(
				entry,
				`${path}.requiredArtifacts[${artifactIndex}]`,
				errors,
			);
		});
	if (!Array.isArray(value.supersedes)) {
		add(errors, `${path}.supersedes`, "must be an array");
	} else
		value.supersedes.forEach((entry, supersedesIndex) => {
			requireSafe(entry, `${path}.supersedes[${supersedesIndex}]`, errors);
		});
	requireNullableSafe(value.supersededBy, `${path}.supersededBy`, errors);
	requireEnum(value.state, STATES, `${path}.state`, errors);
	requireNullableSafe(value.stateReason, `${path}.stateReason`, errors);
	requireNullableSafe(
		value.appliedClientUserMessageId,
		`${path}.appliedClientUserMessageId`,
		errors,
	);
	requireIso(value.stateAt, `${path}.stateAt`, errors);
	requireNullableIso(value.appliedAt, `${path}.appliedAt`, errors);
	requireNullableIso(value.rejectedAt, `${path}.rejectedAt`, errors);
	requireNullableIso(value.supersededAt, `${path}.supersededAt`, errors);
	if (!Array.isArray(value.stalePreconditions)) {
		add(errors, `${path}.stalePreconditions`, "must be an array");
	} else
		value.stalePreconditions.forEach((entry, staleIndex) => {
			validateStalePrecondition(
				entry,
				`${path}.stalePreconditions[${staleIndex}]`,
				errors,
			);
		});
	if (Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) {
		add(errors, `${path}.expiresAt`, "must be later than createdAt");
	}
	if (value.state === "applied" && value.appliedAt === null) {
		add(errors, `${path}.appliedAt`, "is required for applied items");
	}
	if (
		value.state === "applied" &&
		value.appliedClientUserMessageId === null
	) {
		add(
			errors,
			`${path}.appliedClientUserMessageId`,
			"is required for applied items",
		);
	}
	if (
		value.state === "applied" &&
		value.expectedClientUserMessageId !== null &&
		value.appliedClientUserMessageId !== null &&
		value.expectedClientUserMessageId !== value.appliedClientUserMessageId
	) {
		add(
			errors,
			`${path}.appliedClientUserMessageId`,
			"must match expectedClientUserMessageId for applied items",
		);
	}
	if (
		value.state === "applied" &&
		Array.isArray(value.stalePreconditions) &&
		value.stalePreconditions.length > 0
	) {
		add(
			errors,
			`${path}.stalePreconditions`,
			"must be empty for applied items",
		);
	}
	if (value.state === "rejected" && value.rejectedAt === null) {
		add(errors, `${path}.rejectedAt`, "is required for rejected items");
	}
	if (value.state === "rejected" && value.stateReason === null) {
		add(errors, `${path}.stateReason`, "is required for rejected items");
	}
}

function compareApplicable(left, right) {
	if (right.supersedes.includes(left.id)) return 1;
	if (left.supersedes.includes(right.id)) return -1;
	if (left.priority !== right.priority) return right.priority - left.priority;
	const createdDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
	if (createdDelta !== 0) return createdDelta;
	return left.id.localeCompare(right.id);
}

function summarize(items) {
	const summary = {
		total: items.length,
		pending: 0,
		applicable: 0,
		applied: 0,
		rejected: 0,
		expired: 0,
		superseded: 0,
		stale: 0,
	};
	for (const item of items) summary[item.state] += 1;
	return summary;
}

function validatePacket(packet) {
	const errors = [];
	rejectRawKeys(packet, "packet", errors);
	if (!isObject(packet)) {
		add(errors, "packet", "must be an object");
		return errors;
	}
	allowedKeys(packet, PACKET_KEYS, "packet", errors);
	if (packet.schemaVersion !== SCHEMA_VERSION)
		add(errors, "schemaVersion", `must be ${SCHEMA_VERSION}`);
	requireIso(packet.generatedAt, "generatedAt", errors);
	requireSafe(packet.producer, "producer", errors);
	if (packet.runtimeStatus !== "not_yet_emitted")
		add(errors, "runtimeStatus", "must be not_yet_emitted");
	if (
		packet.evidenceUse !== "orientation" &&
		packet.evidenceUse !== "audit_trail"
	)
		add(errors, "evidenceUse", "must be orientation or audit_trail");
	requireSha(packet.headSha, "headSha", errors);
	requireNullableSafe(packet.threadId, "threadId", errors);
	requireNullableSafe(packet.turnId, "turnId", errors);
	requireNullableSafe(
		packet.clientUserMessageId,
		"clientUserMessageId",
		errors,
	);
	requireIso(packet.evaluatedAt, "evaluatedAt", errors);
	requireNullableSafe(packet.selectedItemId, "selectedItemId", errors);
	if (!Array.isArray(packet.items)) {
		add(errors, "items", "must be an array");
	} else {
		const ids = new Set();
		packet.items.forEach((item, index) => {
			validateItem(item, index, ids, errors);
		});
		const selected =
			[...packet.items]
				.filter((item) => item.state === "applicable")
				.sort(compareApplicable)[0]?.id ?? null;
		if ((packet.selectedItemId ?? null) !== selected) {
			add(
				errors,
				"selectedItemId",
				"must match deterministic applicable item selection",
			);
		}
		const expectedSummary = summarize(packet.items);
		if (!isObject(packet.summary)) add(errors, "summary", "must be an object");
		else {
			allowedKeys(packet.summary, SUMMARY_KEYS, "summary", errors);
			for (const [key, value] of Object.entries(expectedSummary)) {
				if (packet.summary[key] !== value)
					add(errors, `summary.${key}`, `must equal ${value}`);
			}
		}
	}
	requireSafe(packet.blockedBy, "blockedBy", errors);
	return errors;
}

function main() {
	const file = process.argv[2];
	if (!file) {
		process.stderr.write("usage: validate-steering-queue.cjs <packet.json>\n");
		process.exitCode = 2;
		return;
	}
	const packet = JSON.parse(readFileSync(file, "utf8"));
	const errors = validatePacket(packet);
	const report = {
		schemaVersion: "steering-queue-validation/v1",
		status: errors.length === 0 ? "pass" : "fail",
		packetPath: file,
		errors,
	};
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	process.exitCode = errors.length === 0 ? 0 : 1;
}

if (require.main === module) main();

module.exports = { validatePacket };
