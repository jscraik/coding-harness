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

/** Enforce requirement, identity, and freshness invariants for one failure. */
function validateFailureSemantics(
	path: string,
	code: SynaipseContextFailureCode,
	requirement: (typeof REQUIREMENTS)[number],
	contextId: string | null,
	freshnessStatus: SynaipseContextFailureFreshness,
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
		if (contextId === null)
			throw new SynaipseContextContractError(
				`${path}.contextId`,
				`${code} must identify a logical context`,
			);
	}
	if (code === "stale_context_digest") {
		if (freshnessStatus !== "stale")
			throw new SynaipseContextContractError(
				`${path}.freshness.status`,
				"stale_context_digest must carry stale freshness",
			);
	}
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
	const contextId =
		failure.contextId === undefined || failure.contextId === null
			? null
			: harnessId(failure.contextId, "ch_context", `${path}.contextId`);
	const freshness = contractObject(failure.freshness, `${path}.freshness`);
	rejectUnknown(freshness, ["status", "observedAt"], `${path}.freshness`);
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
	const freshnessStatus = contractEnum(
		freshness.status,
		SYNAIPSE_CONTEXT_FAILURE_FRESHNESS,
		`${path}.freshness.status`,
	);
	validateFailureSemantics(path, code, requirement, contextId, freshnessStatus);
	return {
		code,
		requirement,
		contextId,
		recovery: contractString(failure.recovery, `${path}.recovery`),
		owner: contractString(failure.owner, `${path}.owner`),
		stopCondition: contractString(
			failure.stopCondition,
			`${path}.stopCondition`,
		),
		evidenceRefs: contractUniqueArray(
			failure.evidenceRefs,
			`${path}.evidenceRefs`,
			(item, itemPath) => contractString(item, itemPath),
		),
		freshness: {
			status: freshnessStatus,
			observedAt: dateTime(
				freshness.observedAt,
				`${path}.freshness.observedAt`,
			),
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
	recovery: string;
	owner?: string;
	stopCondition?: string;
	evidenceRefs: string[];
	freshness?: SynaipseContextFailureFreshness;
	observedAt: string;
}): SynaipseContextFailure {
	const contextId = args.contextId ?? null;
	if (contextId !== null) harnessId(contextId, "ch_context", "contextId");
	validateFailureSemantics(
		"failure",
		args.code,
		args.requirement,
		contextId,
		args.freshness ?? "unknown",
	);
	return {
		code: args.code,
		requirement: args.requirement,
		contextId,
		recovery: contractString(args.recovery, "recovery"),
		owner: contractString(args.owner ?? "synaipse-context-plane", "owner"),
		stopCondition: contractString(
			args.stopCondition ?? `Stop until ${args.code} is resolved.`,
			"stopCondition",
		),
		evidenceRefs: contractUniqueArray(
			args.evidenceRefs,
			"evidenceRefs",
			(item, path) => contractString(item, path),
		),
		freshness: {
			status: args.freshness ?? "unknown",
			observedAt: dateTime(args.observedAt, "freshness.observedAt"),
		},
	};
}
