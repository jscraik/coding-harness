import {
	REQUIREMENTS,
	SynaipseContextContractError,
	contractEnum,
	contractObject,
	contractString,
	contractUniqueArray,
	dateTime,
	harnessId,
	rejectUnknown,
} from "./context-contract.js";

/** Version tag for the additive, decision-owned context failure envelope. */
export const SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION =
	"synaipse-context-failure-envelope/v1" as const;

/** Canonical failure taxonomy for context normalization. */
export const SYNAIPSE_CONTEXT_FAILURE_CODES = [
	"missing_project_identity",
	"missing_context_catalog",
	"missing_required_context",
	"missing_optional_context",
	"context_access_denied",
	"stale_context_digest",
	"superseded_context",
	"malformed_context_catalog",
	"provider_unavailable",
	"unresolved_host_path",
] as const;

/** Freshness status carried by a context failure diagnostic. */
export const SYNAIPSE_CONTEXT_FAILURE_FRESHNESS = [
	"current",
	"stale",
	"unknown",
] as const;

/** Stable code for one canonical context-resolution failure. */
export type SynaipseContextFailureCode =
	(typeof SYNAIPSE_CONTEXT_FAILURE_CODES)[number];

/** Freshness classification for one context-resolution failure. */
export type SynaipseContextFailureFreshness =
	(typeof SYNAIPSE_CONTEXT_FAILURE_FRESHNESS)[number];

/** Canonical owner for every v1 context failure. */
export const SYNAIPSE_CONTEXT_FAILURE_OWNER = "synaipse-context-plane" as const;

/** Canonical code-to-recovery mapping for the v1 failure envelope. */
export const SYNAIPSE_CONTEXT_FAILURE_RECOVERIES: Record<
	SynaipseContextFailureCode,
	string
> = {
	missing_project_identity: "establish_project_identity",
	missing_context_catalog: "admit_context_catalog",
	missing_required_context: "supply_required_context",
	missing_optional_context: "supply_optional_context",
	context_access_denied: "request_authorized_projection",
	stale_context_digest: "refresh_context_digest",
	superseded_context: "select_current_context",
	malformed_context_catalog: "repair_context_catalog",
	provider_unavailable: "restore_context_provider",
	unresolved_host_path: "resolve_context_host_path",
};

/** One canonical, deterministic context-resolution failure record. */
export interface SynaipseContextFailure {
	code: SynaipseContextFailureCode;
	requirement: (typeof REQUIREMENTS)[number];
	contextId: string | null;
	recovery: string;
	owner: string;
	stopCondition: string;
	evidenceRefs: string[];
	freshness: {
		status: SynaipseContextFailureFreshness;
		observedAt: string;
	};
}

/** Versioned envelope attached additively to `harness-decision/v1.meta`. */
export interface SynaipseContextFailureEnvelope {
	schemaVersion: typeof SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION;
	failures: SynaipseContextFailure[];
}

/** Enforce requirement, identity, and freshness invariants for one failure. */
function isCatalogFailure(code: SynaipseContextFailureCode): boolean {
	return (
		code === "missing_project_identity" ||
		code === "missing_context_catalog" ||
		code === "malformed_context_catalog"
	);
}

/** Return the only freshness classification allowed for a v1 failure code. */
export function canonicalContextFailureFreshness(
	code: SynaipseContextFailureCode,
): SynaipseContextFailureFreshness {
	if (isCatalogFailure(code)) return "unknown";
	return code === "stale_context_digest" ? "stale" : "current";
}

/** Return the only stop condition allowed for a v1 failure code. */
export function canonicalContextFailureStopCondition(
	code: SynaipseContextFailureCode,
	requirement: (typeof REQUIREMENTS)[number],
): string {
	if (
		requirement === "optional" &&
		(code === "missing_optional_context" ||
			code === "provider_unavailable" ||
			code === "unresolved_host_path")
	)
		return `Continue with explicit context unknown until ${code} is resolved.`;
	return `Stop until ${code} is resolved.`;
}

/** Enforce requirement and identity invariants for one failure. */
function validateFailureIdentity(
	path: string,
	code: SynaipseContextFailureCode,
	requirement: (typeof REQUIREMENTS)[number],
	contextId: string | null,
): void {
	if (isCatalogFailure(code)) {
		if (requirement !== "required")
			throw new SynaipseContextContractError(
				`${path}.requirement`,
				`${code} must be required`,
			);
		if (contextId !== null)
			throw new SynaipseContextContractError(
				`${path}.contextId`,
				`${code} must not identify a logical context`,
			);
	} else {
		if (code === "missing_required_context") {
			if (requirement !== "required")
				throw new SynaipseContextContractError(
					`${path}.requirement`,
					"missing_required_context must be required",
				);
		}
		if (code === "missing_optional_context" && requirement !== "optional")
			throw new SynaipseContextContractError(
				`${path}.requirement`,
				"missing_optional_context must be optional",
			);
		if (contextId === null)
			throw new SynaipseContextContractError(
				`${path}.contextId`,
				`${code} must identify a logical context`,
			);
	}
}

/** Enforce code-derived recovery, ownership, stop, and freshness metadata. */
function validateFailureMetadata(
	path: string,
	code: SynaipseContextFailureCode,
	requirement: (typeof REQUIREMENTS)[number],
	recovery: string,
	owner: string,
	stopCondition: string,
	freshnessStatus: SynaipseContextFailureFreshness,
): void {
	const expectedRecovery = SYNAIPSE_CONTEXT_FAILURE_RECOVERIES[code];
	if (recovery !== expectedRecovery)
		throw new SynaipseContextContractError(
			`${path}.recovery`,
			`${code} must use recovery ${expectedRecovery}`,
		);
	if (owner !== SYNAIPSE_CONTEXT_FAILURE_OWNER)
		throw new SynaipseContextContractError(
			`${path}.owner`,
			`must be ${SYNAIPSE_CONTEXT_FAILURE_OWNER}`,
		);
	const expectedStopCondition = canonicalContextFailureStopCondition(
		code,
		requirement,
	);
	if (stopCondition !== expectedStopCondition)
		throw new SynaipseContextContractError(
			`${path}.stopCondition`,
			`${code} must use stop condition ${expectedStopCondition}`,
		);
	const expectedFreshness = canonicalContextFailureFreshness(code);
	if (freshnessStatus !== expectedFreshness)
		throw new SynaipseContextContractError(
			`${path}.freshness.status`,
			`${code} must carry ${expectedFreshness} freshness`,
		);
}

/** Parse and validate code-derived metadata for one failure record. */
function parseFailureMetadata(
	failure: Record<string, unknown>,
	path: string,
	code: SynaipseContextFailureCode,
	requirement: (typeof REQUIREMENTS)[number],
) {
	const freshness = contractObject(failure.freshness, `${path}.freshness`);
	rejectUnknown(freshness, ["status", "observedAt"], `${path}.freshness`);
	const recovery = contractString(failure.recovery, `${path}.recovery`);
	const owner = contractString(failure.owner, `${path}.owner`);
	const stopCondition = contractString(
		failure.stopCondition,
		`${path}.stopCondition`,
	);
	const freshnessStatus = contractEnum(
		freshness.status,
		SYNAIPSE_CONTEXT_FAILURE_FRESHNESS,
		`${path}.freshness.status`,
	);
	validateFailureMetadata(
		path,
		code,
		requirement,
		recovery,
		owner,
		stopCondition,
		freshnessStatus,
	);
	return {
		recovery,
		owner,
		stopCondition,
		freshnessStatus,
		observedAt: dateTime(freshness.observedAt, `${path}.freshness.observedAt`),
	};
}

/** Parse one canonical context failure record at the decision boundary. */
function parseContextFailure(
	value: unknown,
	path: string,
): SynaipseContextFailure {
	const failure = contractObject(value, path);
	rejectUnknown(
		failure,
		[
			"code",
			"requirement",
			"contextId",
			"recovery",
			"owner",
			"stopCondition",
			"evidenceRefs",
			"freshness",
		],
		path,
	);
	if (!Object.hasOwn(failure, "contextId"))
		throw new SynaipseContextContractError(
			`${path}.contextId`,
			"must be explicitly present (null for catalog failures)",
		);
	const contextId =
		failure.contextId === null
			? null
			: harnessId(failure.contextId, "ch_context", `${path}.contextId`);
	const code = contractEnum(
		failure.code,
		SYNAIPSE_CONTEXT_FAILURE_CODES,
		`${path}.code`,
	);
	const requirement = contractEnum(
		failure.requirement,
		REQUIREMENTS,
		`${path}.requirement`,
	);
	validateFailureIdentity(path, code, requirement, contextId);
	const { recovery, owner, stopCondition, freshnessStatus, observedAt } =
		parseFailureMetadata(failure, path, code, requirement);
	return {
		code,
		requirement,
		contextId,
		recovery,
		owner,
		stopCondition,
		evidenceRefs: contractUniqueArray(
			failure.evidenceRefs,
			`${path}.evidenceRefs`,
			(item, itemPath) => contractString(item, itemPath),
		),
		freshness: {
			status: freshnessStatus,
			observedAt,
		},
	};
}

/** Parse and fail closed on an unknown or malformed failure envelope. */
export function parseSynaipseContextFailureEnvelope(
	value: unknown,
	path = "meta.synaipseContextFailures",
): SynaipseContextFailureEnvelope {
	const envelope = contractObject(value, path);
	rejectUnknown(envelope, ["schemaVersion", "failures"], path);
	if (
		envelope.schemaVersion !== SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION
	)
		throw new SynaipseContextContractError(
			`${path}.schemaVersion`,
			`must be ${SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION}`,
		);
	const failures = contractUniqueArray(
		envelope.failures,
		`${path}.failures`,
		parseContextFailure,
		(failure) => failure.contextId ?? `catalog:${failure.code}`,
	);
	return {
		schemaVersion: SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION,
		failures,
	};
}

/** Build a normalized failure record without resolving a provider body. */
export function createSynaipseContextFailure(args: {
	code: SynaipseContextFailureCode;
	requirement: (typeof REQUIREMENTS)[number];
	contextId?: string | null;
	evidenceRefs: string[];
	observedAt: string;
}): SynaipseContextFailure {
	const contextId = args.contextId ?? null;
	if (contextId !== null) harnessId(contextId, "ch_context", "contextId");
	const recovery = SYNAIPSE_CONTEXT_FAILURE_RECOVERIES[args.code];
	const owner = SYNAIPSE_CONTEXT_FAILURE_OWNER;
	const stopCondition = canonicalContextFailureStopCondition(
		args.code,
		args.requirement,
	);
	const freshness = canonicalContextFailureFreshness(args.code);
	validateFailureIdentity("failure", args.code, args.requirement, contextId);
	validateFailureMetadata(
		"failure",
		args.code,
		args.requirement,
		recovery,
		owner,
		stopCondition,
		freshness,
	);
	return {
		code: args.code,
		requirement: args.requirement,
		contextId,
		recovery,
		owner,
		stopCondition,
		evidenceRefs: contractUniqueArray(
			args.evidenceRefs,
			"evidenceRefs",
			(item, path) => contractString(item, path),
		),
		freshness: {
			status: freshness,
			observedAt: dateTime(args.observedAt, "freshness.observedAt"),
		},
	};
}
