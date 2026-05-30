import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

/** Replay packets can orient work or preserve audit history, but never prove delivery claims. */
export type ReplayPacketEvidenceUse = "orientation" | "audit_trail";

/** Closed taxonomy for content-bound references carried by ReplayPacket/v1. */
export type ReplayPacketRefKind =
	| "repo_file"
	| "hook_file"
	| "hook_input"
	| "hook_output"
	| "produced_artifact"
	| "runtime_identity"
	| "resolved_command"
	| "seed";

/** Digest-bound pointer to replay input, output, runtime identity, or hook provenance evidence. */
export type ReplayPacketRef = {
	refId: string;
	refKind: ReplayPacketRefKind;
	ref: string;
	hashAlgorithm: "sha256";
	sha256: string;
	requiredForReplay: boolean;
	requiresFilesystemExistence: boolean;
};

/** Contract-only runtime packet for replay seeds and hook provenance without raw transcripts. */
export type ReplayPacket = {
	schemaVersion: "replay-packet/v1";
	generatedAt: string;
	producer: string;
	runtimeStatus: "not_yet_emitted";
	evidenceUse: ReplayPacketEvidenceUse;
	replayId: string;
	replayKind:
		| "hook_replay_seed"
		| "session_replay_seed"
		| "runtime_evidence_replay";
	headSha: string | null;
	branch: string | null;
	observedHeadSha: string | null;
	currentHeadSha: string | null;
	ttlSeconds: number;
	freshnessVerdict:
		| "current"
		| "stale"
		| "expired"
		| "head_mismatch"
		| "missing"
		| "unknown";
	runtimeIdentityRefs: ReplayPacketRef[];
	sourceRefs: ReplayPacketRef[];
	replaySeed: {
		seedId: string;
		inputRefs: ReplayPacketRef[];
		artifactRefs: ReplayPacketRef[];
		hashAlgorithm: "sha256";
		sha256: string;
	};
	hookProvenance: Array<{
		hookId: string;
		triggerKind:
			| "pre_tool_use"
			| "post_tool_use"
			| "stop"
			| "subagent_stop"
			| "notification"
			| "manual";
		status: "pass" | "fail" | "blocked" | "unknown";
		blockerClass: string | null;
		checkedAt: string;
		hookRef: ReplayPacketRef;
		inputRef: ReplayPacketRef;
		outputRef: ReplayPacketRef;
		producedArtifactRefs: ReplayPacketRef[];
		hookExecutionIdentity: {
			hookFileRef: ReplayPacketRef;
			resolvedCommandRef: ReplayPacketRef;
			runCorrelationId: string | null;
		};
	}>;
	normalizedEvents: Array<{
		eventType:
			| "tool_call"
			| "command"
			| "validation"
			| "hook"
			| "review"
			| "artifact"
			| "blocker"
			| "recovery";
		count: number;
		observedAt: string;
		sourceRefs: string[];
		hashes: string[];
		failureClass: string | null;
	}>;
	redactionStatus: "redacted" | "summary_only";
	freshness: "current" | "stale" | "missing" | "unknown" | "not_applicable";
	staleState: Array<{
		surface: string;
		freshness: "current" | "stale" | "missing" | "unknown" | "not_applicable";
		reason: string;
	}>;
	blockers: Array<{
		class: string;
		reason: string;
		nextAction: string;
	}>;
	nextAction: string;
};

/** Runtime inputs needed to verify repo-bound refs and freshness semantics. */
export type ReplayPacketValidationOptions = {
	repoRoot?: string;
	now?: Date;
};

/** Machine-readable ReplayPacket semantic validation result. */
export type ReplayPacketValidationResult = {
	status: "pass" | "fail";
	errors: string[];
};

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

const TOP_LEVEL_KEYS = new Set([
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

const HOOK_PROVENANCE_KEYS = new Set([
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

const HOOK_EXECUTION_IDENTITY_KEYS = new Set([
	"hookFileRef",
	"resolvedCommandRef",
	"runCorrelationId",
]);

const NORMALIZED_EVENT_KEYS = new Set([
	"eventType",
	"count",
	"observedAt",
	"sourceRefs",
	"hashes",
	"failureClass",
]);

const STALE_STATE_KEYS = new Set(["surface", "freshness", "reason"]);

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

const HOOK_TRIGGER_KINDS = new Set([
	"pre_tool_use",
	"post_tool_use",
	"stop",
	"subagent_stop",
	"notification",
	"manual",
]);

const HOOK_STATUSES = new Set(["pass", "fail", "blocked", "unknown"]);

const EVENT_TYPES = new Set([
	"tool_call",
	"command",
	"validation",
	"hook",
	"review",
	"artifact",
	"blocker",
	"recovery",
]);

const FRESHNESS_VALUES = new Set([
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
]);

const FRESHNESS_VERDICTS = new Set([
	"current",
	"stale",
	"expired",
	"head_mismatch",
	"missing",
	"unknown",
]);

/** Validate ReplayPacket/v1 semantics beyond the public JSON Schema shape. */
export function validateReplayPacket(
	packet: unknown,
	options: ReplayPacketValidationOptions = {},
): ReplayPacketValidationResult {
	const errors: string[] = [];
	let repoRoot = process.cwd();
	if (options.repoRoot) {
	  try {
	    repoRoot = realpathSync(options.repoRoot);
	  } catch {
	    return {
	      status: "fail",
	      errors: ["repoRoot: cannot resolve repository root"],
	    };
	  }
	}
	const now = options.now ?? new Date();
	if (!isRecord(packet)) {
		return { status: "fail", errors: ["packet: must be an object"] };
	}
	scanRawOrSecret(packet, "packet", errors);
	validateKnownKeys(packet, TOP_LEVEL_KEYS, "packet", errors);
	requireFields(packet, TOP_LEVEL_KEYS, "packet", errors);
	if (packet.schemaVersion !== "replay-packet/v1")
		errors.push("schemaVersion: must be replay-packet/v1");
	if (packet.runtimeStatus !== "not_yet_emitted")
		errors.push("runtimeStatus: must be not_yet_emitted");
	if (
		packet.evidenceUse !== "orientation" &&
		packet.evidenceUse !== "audit_trail"
	) {
		errors.push("evidenceUse: must be orientation or audit_trail");
	}
	if (!REPLAY_KINDS.has(String(packet.replayKind))) {
		errors.push("replayKind: must be a recognized replay packet kind");
	}
	if (packet.evidenceUse === "claim_support") {
		errors.push("evidenceUse: claim_support is forbidden for replay-packet/v1");
	}
	if (!FRESHNESS_VERDICTS.has(String(packet.freshnessVerdict))) {
		errors.push("freshnessVerdict: must be a recognized freshness verdict");
	}
	if (!FRESHNESS_VALUES.has(String(packet.freshness))) {
		errors.push("freshness: must be a recognized freshness value");
	}
	validatePointer(packet.producer, "producer", errors);
	validatePointer(packet.replayId, "replayId", errors);
	validateDateTime(packet.generatedAt, "generatedAt", errors);
	validateNullableHead(packet.headSha, "headSha", errors);
	validateNullableHead(packet.observedHeadSha, "observedHeadSha", errors);
	validateNullableHead(packet.currentHeadSha, "currentHeadSha", errors);
	if (
		typeof packet.ttlSeconds !== "number" ||
		!Number.isInteger(packet.ttlSeconds) ||
		packet.ttlSeconds <= 0
	)
		errors.push("ttlSeconds: must be a positive integer");
	validateRefs(
		packet.runtimeIdentityRefs,
		"runtimeIdentityRefs",
		repoRoot,
		errors,
	);
	validateRefs(packet.sourceRefs, "sourceRefs", repoRoot, errors);
	validateReplaySeed(packet.replaySeed, repoRoot, errors);
	validateHookProvenance(
		packet.hookProvenance,
		packet.generatedAt,
		repoRoot,
		errors,
	);
	validateEvents(packet.normalizedEvents, packet.generatedAt, errors);
	validateStaleState(packet.staleState, errors);
	validateBlockers(packet.blockers, errors);
	validateStaleSemantics(packet as Record<string, unknown>, now, errors);
	return { status: errors.length === 0 ? "pass" : "fail", errors };
}

function validateReplaySeed(
	value: unknown,
	repoRoot: string,
	errors: string[],
) {
	if (!isRecord(value)) {
		errors.push("replaySeed: must be an object");
		return;
	}
	validateKnownKeys(value, REPLAY_SEED_KEYS, "replaySeed", errors);
	requireFields(value, REPLAY_SEED_KEYS, "replaySeed", errors);
	validatePointer(value.seedId, "replaySeed.seedId", errors);
	if (value.hashAlgorithm !== "sha256")
		errors.push("replaySeed.hashAlgorithm: must be sha256");
	if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256))
		errors.push("replaySeed.sha256: must be a 64-character sha256");
	validateRefs(value.inputRefs, "replaySeed.inputRefs", repoRoot, errors);
	validateRefs(value.artifactRefs, "replaySeed.artifactRefs", repoRoot, errors);
}

function validateHookProvenance(
	value: unknown,
	generatedAt: unknown,
	repoRoot: string,
	errors: string[],
) {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push("hookProvenance: must contain at least one hook entry");
		return;
	}
	for (const [index, hook] of value.entries()) {
		const path = `hookProvenance[${index}]`;
		if (!isRecord(hook)) {
			errors.push(`${path}: must be an object`);
			continue;
		}
		validateKnownKeys(hook, HOOK_PROVENANCE_KEYS, path, errors);
		requireFields(hook, HOOK_PROVENANCE_KEYS, path, errors);
		validatePointer(hook.hookId, `${path}.hookId`, errors);
		if (!HOOK_TRIGGER_KINDS.has(String(hook.triggerKind)))
			errors.push(`${path}.triggerKind: must be a recognized hook trigger`);
		if (!HOOK_STATUSES.has(String(hook.status)))
			errors.push(`${path}.status: must be pass, fail, blocked, or unknown`);
		if (hook.blockerClass !== null && typeof hook.blockerClass !== "string")
			errors.push(`${path}.blockerClass: must be a string or null`);
		validateDateTime(hook.checkedAt, `${path}.checkedAt`, errors);
		if (isAfter(hook.checkedAt, generatedAt))
			errors.push(`${path}.checkedAt: must not be after generatedAt`);
		validateRef(hook.hookRef, `${path}.hookRef`, repoRoot, errors);
		validateRef(hook.inputRef, `${path}.inputRef`, repoRoot, errors);
		validateRef(hook.outputRef, `${path}.outputRef`, repoRoot, errors);
		validateRefs(
			hook.producedArtifactRefs,
			`${path}.producedArtifactRefs`,
			repoRoot,
			errors,
		);
		const identity = hook.hookExecutionIdentity;
		if (!isRecord(identity)) {
			errors.push(`${path}.hookExecutionIdentity: must be an object`);
			continue;
		}
		validateKnownKeys(
			identity,
			HOOK_EXECUTION_IDENTITY_KEYS,
			`${path}.hookExecutionIdentity`,
			errors,
		);
		requireFields(
			identity,
			HOOK_EXECUTION_IDENTITY_KEYS,
			`${path}.hookExecutionIdentity`,
			errors,
		);
		validateRef(
			identity.hookFileRef,
			`${path}.hookExecutionIdentity.hookFileRef`,
			repoRoot,
			errors,
		);
		validateRef(
			identity.resolvedCommandRef,
			`${path}.hookExecutionIdentity.resolvedCommandRef`,
			repoRoot,
			errors,
		);
		if (identity.runCorrelationId !== null)
			validatePointer(
				identity.runCorrelationId,
				`${path}.hookExecutionIdentity.runCorrelationId`,
				errors,
			);
	}
}

function validateEvents(
	value: unknown,
	generatedAt: unknown,
	errors: string[],
) {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push("normalizedEvents: must contain at least one summary");
		return;
	}
	for (const [index, event] of value.entries()) {
		const path = `normalizedEvents[${index}]`;
		if (!isRecord(event)) {
			errors.push(`${path}: must be an object`);
			continue;
		}
		validateKnownKeys(event, NORMALIZED_EVENT_KEYS, path, errors);
		requireFields(event, NORMALIZED_EVENT_KEYS, path, errors);
		if (!EVENT_TYPES.has(String(event.eventType)))
			errors.push(
				`${path}.eventType: must be a recognized normalized event type`,
			);
		if (
			typeof event.count !== "number" ||
			!Number.isInteger(event.count) ||
			event.count < 1
		)
			errors.push(`${path}.count: must be a positive integer`);
		validateDateTime(event.observedAt, `${path}.observedAt`, errors);
		if (isAfter(event.observedAt, generatedAt))
			errors.push(`${path}.observedAt: must not be after generatedAt`);
		if (!Array.isArray(event.sourceRefs)) {
			errors.push(`${path}.sourceRefs: must be an array`);
		} else {
			if (event.sourceRefs.length === 0) {
				errors.push(`${path}.sourceRefs: must contain at least one pointer`);
			}
			event.sourceRefs.forEach((ref, refIndex) => {
				validatePointer(ref, `${path}.sourceRefs[${refIndex}]`, errors);
			});
		}
		if (!Array.isArray(event.hashes)) {
			errors.push(`${path}.hashes: must be an array`);
		} else {
			if (event.hashes.length === 0) {
				errors.push(`${path}.hashes: must contain at least one sha256`);
			}
			event.hashes.forEach((hash, hashIndex) => {
				if (typeof hash !== "string" || !SHA256.test(hash))
					errors.push(
						`${path}.hashes[${hashIndex}]: must be a 64-character sha256`,
					);
			});
		}
		if (event.failureClass !== null && typeof event.failureClass !== "string")
			errors.push(`${path}.failureClass: must be a string or null`);
	}
}

function validateStaleState(value: unknown, errors: string[]) {
	if (!Array.isArray(value)) {
		errors.push("staleState: must be an array");
		return;
	}
	for (const [index, entry] of value.entries()) {
		const path = `staleState[${index}]`;
		if (!isRecord(entry)) {
			errors.push(`${path}: must be an object`);
			continue;
		}
		validateKnownKeys(entry, STALE_STATE_KEYS, path, errors);
		requireFields(entry, STALE_STATE_KEYS, path, errors);
		validatePointer(entry.surface, `${path}.surface`, errors);
		if (!FRESHNESS_VALUES.has(String(entry.freshness)))
			errors.push(`${path}.freshness: must be a recognized freshness value`);
		if (typeof entry.reason !== "string" || entry.reason.trim() === "")
			errors.push(`${path}.reason: must be a non-empty string`);
	}
}

function validateBlockers(value: unknown, errors: string[]) {
	if (!Array.isArray(value)) {
		errors.push("blockers: must be an array");
		return;
	}
	for (const [index, entry] of value.entries()) {
		const path = `blockers[${index}]`;
		if (!isRecord(entry)) {
			errors.push(`${path}: must be an object`);
			continue;
		}
		validateKnownKeys(entry, BLOCKER_KEYS, path, errors);
		requireFields(entry, BLOCKER_KEYS, path, errors);
		validatePointer(entry.class, `${path}.class`, errors);
		if (typeof entry.reason !== "string" || entry.reason.trim() === "")
			errors.push(`${path}.reason: must be a non-empty string`);
		if (typeof entry.nextAction !== "string" || entry.nextAction.trim() === "")
			errors.push(`${path}.nextAction: must be a non-empty string`);
	}
}

function validateStaleSemantics(
	packet: Record<string, unknown>,
	now: Date,
	errors: string[],
) {
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

function validateRefs(
	value: unknown,
	path: string,
	repoRoot: string,
	errors: string[],
) {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push(`${path}: must contain at least one ref`);
		return;
	}
	value.forEach((entry, index) => {
		validateRef(entry, `${path}[${index}]`, repoRoot, errors);
	});
}

function validateRef(
	value: unknown,
	path: string,
	repoRoot: string,
	errors: string[],
) {
	if (!isRecord(value)) {
		errors.push(`${path}: must be an object`);
		return;
	}
	validateKnownKeys(value, REF_KEYS, path, errors);
	requireFields(value, REF_KEYS, path, errors);
	validatePointer(value.refId, `${path}.refId`, errors);
	if (value.hashAlgorithm !== "sha256")
		errors.push(`${path}.hashAlgorithm: must be sha256`);
	if (!REF_KINDS.has(String(value.refKind)))
		errors.push(`${path}.refKind: must be a recognized ref kind`);
	if (typeof value.requiredForReplay !== "boolean")
		errors.push(`${path}.requiredForReplay: must be a boolean`);
	if (typeof value.requiresFilesystemExistence !== "boolean")
		errors.push(`${path}.requiresFilesystemExistence: must be a boolean`);
	if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256))
		errors.push(`${path}.sha256: must be a 64-character sha256`);
	if (typeof value.ref !== "string" || !isSafeRepoRef(value.ref)) {
		errors.push(`${path}.ref: must be a safe repo-relative reference`);
		return;
	}
	if (value.requiresFilesystemExistence === true)
		validateRefDigest(value, path, repoRoot, errors);
}

function validateRefDigest(
	value: Record<string, unknown>,
	path: string,
	repoRoot: string,
	errors: string[],
) {
	const candidate = resolve(repoRoot, String(value.ref));
	let real: string;
	try {
		real = existsSync(candidate) ? realpathSync(candidate) : candidate;
	} catch {
		errors.push(`${path}.ref: cannot resolve required file`);
		return;
	}
	const rel = relative(repoRoot, real);
	if (rel.startsWith("..") || isAbsolute(rel)) {
		errors.push(`${path}.ref: resolves outside repository root`);
		return;
	}
	if (!existsSync(real)) {
		errors.push(`${path}.ref: required file is missing`);
		return;
	}
	const actual = createHash("sha256").update(readFileSync(real)).digest("hex");
	if (actual !== value.sha256)
		errors.push(`${path}.sha256: does not match referenced file digest`);
}

function scanRawOrSecret(value: unknown, path: string, errors: string[]) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			scanRawOrSecret(item, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) {
		if (typeof value === "string" && RAW_OR_SECRET_VALUE.test(value))
			errors.push(`${path}: raw or secret-like scalar value is forbidden`);
		return;
	}
	for (const [key, nested] of Object.entries(value)) {
		if (RAW_OR_SECRET_KEY.test(key))
			errors.push(`${path}.${key}: raw or secret-like keys are forbidden`);
		scanRawOrSecret(nested, `${path}.${key}`, errors);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateKnownKeys(
	value: unknown,
	keys: Set<string>,
	path: string,
	errors: string[],
) {
	if (!isRecord(value)) return;
	for (const key of Object.keys(value)) {
		if (!keys.has(key)) errors.push(`${path}.${key}: unknown field`);
	}
}

function requireFields(
	value: Record<string, unknown>,
	keys: Set<string>,
	path: string,
	errors: string[],
) {
	for (const key of keys) {
		if (!(key in value)) errors.push(`${path}.${key}: is required`);
	}
}

function validatePointer(value: unknown, path: string, errors: string[]) {
	if (typeof value !== "string" || !POINTER.test(value))
		errors.push(`${path}: must be a compact pointer`);
}

function validateDateTime(value: unknown, path: string, errors: string[]) {
	if (
		typeof value !== "string" ||
		!RFC3339.test(value) ||
		!Number.isFinite(Date.parse(value))
	) {
		errors.push(`${path}: must be an RFC3339 date-time string`);
	}
}

function validateNullableHead(value: unknown, path: string, errors: string[]) {
	if (value !== null && (typeof value !== "string" || !HEAD_SHA.test(value))) {
		errors.push(`${path}: must be a lowercase 40-character SHA or null`);
	}
}

function isAfter(left: unknown, right: unknown) {
	const leftTime = Date.parse(String(left));
	const rightTime = Date.parse(String(right));
	return (
		Number.isFinite(leftTime) &&
		Number.isFinite(rightTime) &&
		leftTime > rightTime
	);
}

function isSafeRepoRef(value: string) {
	return (
		SAFE_REPO_REF.test(value) &&
		!value.includes("..") &&
		!value.startsWith("/") &&
		!value.startsWith("~") &&
		!value.includes("://")
	);
}
