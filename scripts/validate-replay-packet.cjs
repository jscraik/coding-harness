#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = "replay-packet/v1";
const HEAD_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const POINTER = /^[A-Za-z0-9][A-Za-z0-9:._/@#?=&+,-]{1,255}$/u;
const RFC3339 =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const SAFE_REPO_REF = /^(?:[A-Za-z0-9._@+-]+\/)*[A-Za-z0-9._@+-]+$/u;
const RAW_OR_SECRET_KEY =
	/(raw|prompt|transcript|commandOutput|toolPayload|payload|screenshot|image|secret|token|password|credential|apiKey|privateKey)/iu;
const RAW_OR_SECRET_VALUE =
	/(sk-[A-Za-z0-9_-]{20,}|gh[opsru]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|Bearer\s+[A-Za-z0-9._~+/-]{20,}=*|BEGIN PRIVATE KEY|(?:token|secret|password|credential)=|raw prompt|full transcript|command output)/iu;

const PACKET_KEYS = new Set([
	"schemaVersion",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"replayId",
	"replayKind",
	"headSha",
	"branch",
	"observedHeadSha",
	"currentHeadSha",
	"ttlSeconds",
	"freshnessVerdict",
	"runtimeIdentityRefs",
	"sourceRefs",
	"replaySeed",
	"hookProvenance",
	"normalizedEvents",
	"redactionStatus",
	"freshness",
	"staleState",
	"blockers",
	"nextAction",
]);
const REF_KEYS = new Set([
	"refId",
	"refKind",
	"ref",
	"hashAlgorithm",
	"sha256",
	"requiredForReplay",
	"requiresFilesystemExistence",
]);
const REPLAY_SEED_KEYS = new Set([
	"seedId",
	"inputRefs",
	"artifactRefs",
	"hashAlgorithm",
	"sha256",
]);
const HOOK_KEYS = new Set([
	"hookId",
	"triggerKind",
	"status",
	"blockerClass",
	"checkedAt",
	"hookRef",
	"inputRef",
	"outputRef",
	"producedArtifactRefs",
	"hookExecutionIdentity",
]);
const HOOK_IDENTITY_KEYS = new Set([
	"hookFileRef",
	"resolvedCommandRef",
	"runCorrelationId",
]);
const EVENT_KEYS = new Set([
	"eventType",
	"count",
	"observedAt",
	"sourceRefs",
	"hashes",
	"failureClass",
]);
const STALE_KEYS = new Set(["surface", "freshness", "reason"]);
const BLOCKER_KEYS = new Set(["class", "reason", "nextAction"]);

const REF_KINDS = new Set([
	"repo_file",
	"hook_file",
	"hook_input",
	"hook_output",
	"produced_artifact",
	"runtime_identity",
	"resolved_command",
	"seed",
]);
const REPLAY_KINDS = new Set([
	"hook_replay_seed",
	"session_replay_seed",
	"runtime_evidence_replay",
]);
const TRIGGERS = new Set([
	"pre_tool_use",
	"post_tool_use",
	"stop",
	"subagent_stop",
	"notification",
	"manual",
]);
const STATUSES = new Set(["pass", "fail", "blocked", "unknown"]);
const EVENTS = new Set([
	"tool_call",
	"command",
	"validation",
	"hook",
	"review",
	"artifact",
	"blocker",
	"recovery",
]);
const FRESHNESS = new Set([
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
]);
const VERDICTS = new Set([
	"current",
	"stale",
	"expired",
	"head_mismatch",
	"missing",
	"unknown",
]);

function parseArgs(argv) {
	const result = { errors: [], packetPath: null, repoRoot: process.cwd() };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--repo-root") {
			const value = argv[index + 1];
			if (!value || value.startsWith("-")) {
				result.errors.push("--repo-root: requires a value");
				continue;
			}
			result.repoRoot = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			result.errors.push(`${arg}: unknown option`);
			continue;
		}
		if (!result.packetPath) result.packetPath = arg;
	}
	return result;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const errors = [...args.errors];
	let packet;
	if (!args.packetPath) errors.push("packetPath: is required");
	try {
		if (args.packetPath) {
			packet = JSON.parse(fs.readFileSync(args.packetPath, "utf8"));
		}
	} catch (error) {
		errors.push(`packet: cannot read JSON: ${error.message}`);
	}
	let repoRoot = process.cwd();
	try {
		repoRoot = fs.realpathSync(path.resolve(args.repoRoot));
	} catch (error) {
		errors.push(`repoRoot: cannot resolve repository root: ${error.message}`);
	}
	if (packet) validatePacket(packet, repoRoot, new Date(), errors);
	const status = errors.length === 0 ? "pass" : "fail";
	console.log(
		JSON.stringify(
			{
				schemaVersion: "replay-packet-validation/v1",
				status,
				errors,
			},
			null,
			2,
		),
	);
	process.exit(status === "pass" ? 0 : 1);
}

function validatePacket(packet, repoRoot, now, errors) {
	if (!isRecord(packet)) {
		errors.push("packet: must be an object");
		return;
	}
	scanRawOrSecret(packet, "packet", errors);
	validateKnownKeys(packet, PACKET_KEYS, "packet", errors);
	requireFields(packet, PACKET_KEYS, "packet", errors);
	if (packet.schemaVersion !== SCHEMA_VERSION)
		errors.push("schemaVersion: must be replay-packet/v1");
	if (packet.runtimeStatus !== "not_yet_emitted")
		errors.push("runtimeStatus: must be not_yet_emitted");
	if (!["orientation", "audit_trail"].includes(packet.evidenceUse)) {
		errors.push("evidenceUse: must be orientation or audit_trail");
	}
	if (!REPLAY_KINDS.has(String(packet.replayKind))) {
		errors.push("replayKind: must be a recognized replay packet kind");
	}
	if (packet.evidenceUse === "claim_support") {
		errors.push("evidenceUse: claim_support is forbidden for replay-packet/v1");
	}
	if (!VERDICTS.has(String(packet.freshnessVerdict))) {
		errors.push("freshnessVerdict: must be a recognized freshness verdict");
	}
	if (!FRESHNESS.has(String(packet.freshness))) {
		errors.push("freshness: must be a recognized freshness value");
	}
	validatePointer(packet.producer, "producer", errors);
	validatePointer(packet.replayId, "replayId", errors);
	validateDateTime(packet.generatedAt, "generatedAt", errors);
	validateNullableHead(packet.headSha, "headSha", errors);
	validateNullableHead(packet.observedHeadSha, "observedHeadSha", errors);
	validateNullableHead(packet.currentHeadSha, "currentHeadSha", errors);
	if (!Number.isInteger(packet.ttlSeconds) || packet.ttlSeconds <= 0) {
		errors.push("ttlSeconds: must be a positive integer");
	}
	validateRefs(
		packet.runtimeIdentityRefs,
		"runtimeIdentityRefs",
		repoRoot,
		errors,
	);
	validateRefs(packet.sourceRefs, "sourceRefs", repoRoot, errors);
	validateReplaySeed(packet.replaySeed, repoRoot, errors);
	validateHooks(packet.hookProvenance, packet.generatedAt, repoRoot, errors);
	validateEvents(packet.normalizedEvents, packet.generatedAt, errors);
	validateStaleState(packet.staleState, errors);
	validateBlockers(packet.blockers, errors);
	validateStaleSemantics(packet, now, errors);
}

function validateReplaySeed(value, repoRoot, errors) {
	if (!isRecord(value)) {
		errors.push("replaySeed: must be an object");
		return;
	}
	validateKnownKeys(value, REPLAY_SEED_KEYS, "replaySeed", errors);
	requireFields(value, REPLAY_SEED_KEYS, "replaySeed", errors);
	validatePointer(value.seedId, "replaySeed.seedId", errors);
	if (value.hashAlgorithm !== "sha256")
		errors.push("replaySeed.hashAlgorithm: must be sha256");
	if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) {
		errors.push("replaySeed.sha256: must be a 64-character sha256");
	}
	validateRefs(value.inputRefs, "replaySeed.inputRefs", repoRoot, errors);
	validateRefs(value.artifactRefs, "replaySeed.artifactRefs", repoRoot, errors);
}

function validateHooks(value, generatedAt, repoRoot, errors) {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push("hookProvenance: must contain at least one hook entry");
		return;
	}
	value.forEach((hook, index) => {
		const prefix = `hookProvenance[${index}]`;
		if (!isRecord(hook)) {
			errors.push(`${prefix}: must be an object`);
			return;
		}
		validateKnownKeys(hook, HOOK_KEYS, prefix, errors);
		requireFields(hook, HOOK_KEYS, prefix, errors);
		validatePointer(hook.hookId, `${prefix}.hookId`, errors);
		if (!TRIGGERS.has(String(hook.triggerKind)))
			errors.push(`${prefix}.triggerKind: must be recognized`);
		if (!STATUSES.has(String(hook.status)))
			errors.push(`${prefix}.status: must be recognized`);
		if (hook.blockerClass !== null)
			validatePointer(hook.blockerClass, `${prefix}.blockerClass`, errors);
		validateDateTime(hook.checkedAt, `${prefix}.checkedAt`, errors);
		if (isAfter(hook.checkedAt, generatedAt))
			errors.push(`${prefix}.checkedAt: must not be after generatedAt`);
		validateRef(
			hook.hookRef,
			`${prefix}.hookRef`,
			repoRoot,
			errors,
			new Set(["hook_file"]),
		);
		validateRef(
			hook.inputRef,
			`${prefix}.inputRef`,
			repoRoot,
			errors,
			new Set(["hook_input", "repo_file", "produced_artifact"]),
		);
		validateRef(
			hook.outputRef,
			`${prefix}.outputRef`,
			repoRoot,
			errors,
			new Set(["hook_output", "repo_file", "produced_artifact"]),
		);
		validateRefs(
			hook.producedArtifactRefs,
			`${prefix}.producedArtifactRefs`,
			repoRoot,
			errors,
			new Set(["produced_artifact"]),
		);
		validateHookIdentity(
			hook.hookExecutionIdentity,
			`${prefix}.hookExecutionIdentity`,
			repoRoot,
			errors,
		);
	});
}

function validateHookIdentity(value, prefix, repoRoot, errors) {
	if (!isRecord(value)) {
		errors.push(`${prefix}: must be an object`);
		return;
	}
	validateKnownKeys(value, HOOK_IDENTITY_KEYS, prefix, errors);
	requireFields(value, HOOK_IDENTITY_KEYS, prefix, errors);
	validateRef(
		value.hookFileRef,
		`${prefix}.hookFileRef`,
		repoRoot,
		errors,
		new Set(["hook_file"]),
	);
	validateRef(
		value.resolvedCommandRef,
		`${prefix}.resolvedCommandRef`,
		repoRoot,
		errors,
		new Set(["resolved_command"]),
	);
	if (value.runCorrelationId !== null)
		validatePointer(
			value.runCorrelationId,
			`${prefix}.runCorrelationId`,
			errors,
		);
}

function validateEvents(value, generatedAt, errors) {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push("normalizedEvents: must contain at least one summary");
		return;
	}
	value.forEach((event, index) => {
		const prefix = `normalizedEvents[${index}]`;
		if (!isRecord(event)) {
			errors.push(`${prefix}: must be an object`);
			return;
		}
		validateKnownKeys(event, EVENT_KEYS, prefix, errors);
		requireFields(event, EVENT_KEYS, prefix, errors);
		if (!EVENTS.has(String(event.eventType)))
			errors.push(`${prefix}.eventType: must be recognized`);
		if (!Number.isInteger(event.count) || event.count < 1)
			errors.push(`${prefix}.count: must be a positive integer`);
		validateDateTime(event.observedAt, `${prefix}.observedAt`, errors);
		if (isAfter(event.observedAt, generatedAt))
			errors.push(`${prefix}.observedAt: must not be after generatedAt`);
		validatePointerArray(event.sourceRefs, `${prefix}.sourceRefs`, errors);
		validateHashArray(event.hashes, `${prefix}.hashes`, errors);
		if (event.failureClass !== null && typeof event.failureClass !== "string") {
			errors.push(`${prefix}.failureClass: must be a string or null`);
		}
	});
}

function validateStaleState(value, errors) {
	if (!Array.isArray(value)) {
		errors.push("staleState: must be an array");
		return;
	}
	value.forEach((entry, index) => {
		const prefix = `staleState[${index}]`;
		if (!isRecord(entry)) {
			errors.push(`${prefix}: must be an object`);
			return;
		}
		validateKnownKeys(entry, STALE_KEYS, prefix, errors);
		requireFields(entry, STALE_KEYS, prefix, errors);
		validatePointer(entry.surface, `${prefix}.surface`, errors);
		if (!FRESHNESS.has(String(entry.freshness)))
			errors.push(`${prefix}.freshness: must be recognized`);
		if (typeof entry.reason !== "string" || entry.reason.trim() === "")
			errors.push(`${prefix}.reason: must be non-empty`);
	});
}

function validateBlockers(value, errors) {
	if (!Array.isArray(value)) {
		errors.push("blockers: must be an array");
		return;
	}
	value.forEach((entry, index) => {
		const prefix = `blockers[${index}]`;
		if (!isRecord(entry)) {
			errors.push(`${prefix}: must be an object`);
			return;
		}
		validateKnownKeys(entry, BLOCKER_KEYS, prefix, errors);
		requireFields(entry, BLOCKER_KEYS, prefix, errors);
		validatePointer(entry.class, `${prefix}.class`, errors);
		if (typeof entry.reason !== "string" || entry.reason.trim() === "")
			errors.push(`${prefix}.reason: must be non-empty`);
		if (typeof entry.nextAction !== "string" || entry.nextAction.trim() === "")
			errors.push(`${prefix}.nextAction: must be non-empty`);
	});
}

function validateRefs(value, prefix, repoRoot, errors, allowedKinds) {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push(`${prefix}: must contain at least one ref`);
		return;
	}
	value.forEach((entry, index) => {
		validateRef(entry, `${prefix}[${index}]`, repoRoot, errors, allowedKinds);
	});
}

function validateRef(value, prefix, repoRoot, errors, allowedKinds) {
	if (!isRecord(value)) {
		errors.push(`${prefix}: must be an object`);
		return;
	}
	validateKnownKeys(value, REF_KEYS, prefix, errors);
	requireFields(value, REF_KEYS, prefix, errors);
	validatePointer(value.refId, `${prefix}.refId`, errors);
	const kindsToCheck = allowedKinds ?? REF_KINDS;
	if (!kindsToCheck.has(String(value.refKind)))
		errors.push(
			`${prefix}.refKind: must be recognized${allowedKinds ? ` (allowed: ${Array.from(allowedKinds).join(", ")})` : ""}`,
		);
	if (value.hashAlgorithm !== "sha256")
		errors.push(`${prefix}.hashAlgorithm: must be sha256`);
	if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256))
		errors.push(`${prefix}.sha256: must be a 64-character sha256`);
	if (typeof value.requiredForReplay !== "boolean")
		errors.push(`${prefix}.requiredForReplay: must be a boolean`);
	if (typeof value.requiresFilesystemExistence !== "boolean")
		errors.push(`${prefix}.requiresFilesystemExistence: must be a boolean`);
	if (typeof value.ref !== "string" || !isSafeRepoRef(value.ref)) {
		errors.push(`${prefix}.ref: must be a safe repo-relative reference`);
		return;
	}
	if (value.requiresFilesystemExistence === true)
		validateDigest(value, prefix, repoRoot, errors);
}

function validateDigest(value, prefix, repoRoot, errors) {
	const candidate = path.resolve(repoRoot, String(value.ref));
	let real;
	try {
		real = fs.existsSync(candidate) ? fs.realpathSync(candidate) : candidate;
	} catch {
		errors.push(`${prefix}.ref: cannot resolve required file`);
		return;
	}
	const relativePath = path.relative(repoRoot, real);
	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		errors.push(`${prefix}.ref: resolves outside repository root`);
		return;
	}
	if (!fs.existsSync(real)) {
		errors.push(`${prefix}.ref: required file is missing`);
		return;
	}
	const actual = crypto
		.createHash("sha256")
		.update(fs.readFileSync(real))
		.digest("hex");
	if (actual !== value.sha256)
		errors.push(`${prefix}.sha256: does not match referenced file digest`);
}

function validateStaleSemantics(packet, now, errors) {
	if (packet.evidenceUse === "orientation") {
		if (packet.freshness !== "current")
			errors.push("freshness: orientation requires current");
		if (packet.freshnessVerdict !== "current")
			errors.push("freshnessVerdict: orientation requires current");
		const staleState = Array.isArray(packet.staleState)
			? packet.staleState
			: [];
		if (staleState.length > 0)
			errors.push("staleState: orientation packets must not carry stale state");
		const blockers = Array.isArray(packet.blockers) ? packet.blockers : [];
		if (blockers.length > 0)
			errors.push("blockers: orientation packets must not carry blockers");
		if (packet.observedHeadSha !== packet.currentHeadSha)
			errors.push(
				"observedHeadSha: orientation requires observedHeadSha to equal currentHeadSha",
			);
		const generatedAt = Date.parse(String(packet.generatedAt));
		const ttlMillis = Number(packet.ttlSeconds) * 1000;
		if (
			Number.isFinite(generatedAt) &&
			Number.isFinite(ttlMillis) &&
			generatedAt + ttlMillis < now.getTime()
		) {
			errors.push("ttlSeconds: orientation packet is expired");
		}
	}
	if (
		packet.evidenceUse === "audit_trail" &&
		packet.freshnessVerdict !== "current"
	) {
		const staleState = Array.isArray(packet.staleState)
			? packet.staleState
			: [];
		const blockers = Array.isArray(packet.blockers) ? packet.blockers : [];
		if (staleState.length === 0 && blockers.length === 0) {
			errors.push(
				"staleState: stale audit-trail packets require staleState or blockers",
			);
		}
	}
}

function validatePointerArray(value, prefix, errors) {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push(`${prefix}: must contain at least one pointer`);
		return;
	}
	value.forEach((entry, index) => {
		validatePointer(entry, `${prefix}[${index}]`, errors);
	});
}

function validateHashArray(value, prefix, errors) {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push(`${prefix}: must contain at least one sha256`);
		return;
	}
	value.forEach((entry, index) => {
		if (typeof entry !== "string" || !SHA256.test(entry))
			errors.push(`${prefix}[${index}]: must be a 64-character sha256`);
	});
}

function scanRawOrSecret(value, prefix, errors) {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			scanRawOrSecret(entry, `${prefix}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) {
		if (typeof value === "string" && RAW_OR_SECRET_VALUE.test(value)) {
			errors.push(`${prefix}: raw or secret-like scalar value is forbidden`);
		}
		return;
	}
	for (const [key, nested] of Object.entries(value)) {
		if (RAW_OR_SECRET_KEY.test(key))
			errors.push(`${prefix}.${key}: raw or secret-like keys are forbidden`);
		scanRawOrSecret(nested, `${prefix}.${key}`, errors);
	}
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateKnownKeys(value, keys, prefix, errors) {
	if (!isRecord(value)) return;
	for (const key of Object.keys(value)) {
		if (!keys.has(key)) errors.push(`${prefix}.${key}: unknown field`);
	}
}

function requireFields(value, keys, prefix, errors) {
	if (!isRecord(value)) return;
	for (const key of keys) {
		if (!(key in value)) errors.push(`${prefix}.${key}: is required`);
	}
}

function validatePointer(value, prefix, errors) {
	if (typeof value !== "string" || !POINTER.test(value))
		errors.push(`${prefix}: must be a compact pointer`);
}

function validateDateTime(value, prefix, errors) {
	if (
		typeof value !== "string" ||
		!RFC3339.test(value) ||
		!Number.isFinite(Date.parse(value))
	) {
		errors.push(`${prefix}: must be an RFC3339 date-time string`);
	}
}

function validateNullableHead(value, prefix, errors) {
	if (value !== null && (typeof value !== "string" || !HEAD_SHA.test(value))) {
		errors.push(`${prefix}: must be a lowercase 40-character SHA or null`);
	}
}

function isAfter(left, right) {
	const leftTime = Date.parse(String(left));
	const rightTime = Date.parse(String(right));
	return (
		Number.isFinite(leftTime) &&
		Number.isFinite(rightTime) &&
		leftTime > rightTime
	);
}

function isSafeRepoRef(value) {
	return (
		SAFE_REPO_REF.test(value) &&
		!value.includes("..") &&
		!value.startsWith("/") &&
		!value.startsWith("~") &&
		!value.includes("://")
	);
}

if (require.main === module) {
	main();
}
