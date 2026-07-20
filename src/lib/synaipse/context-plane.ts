import {
	SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION,
	type SynaipseContextFailureEnvelope,
} from "./context-failures.js";
import {
	contextFailureFromIssue,
	type ContextResolutionIssue,
} from "./context-failure-mapping.js";
import { synaipsePrivacyBlocks } from "./context-privacy.js";
import {
	parseSynaipseContextProjection,
	type ContextUnknownReason,
	type SynaipseContextProjection,
} from "./context-projection.js";
import {
	parseResolutionInput,
	type ContextRef,
} from "./context-resolution-input.js";

export { SynaipseContextContractError } from "./context-contract.js";
export {
	SYNAIPSE_CONTEXT_FAILURE_CODES,
	SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION,
	createSynaipseContextFailure,
	type SynaipseContextFailure,
	type SynaipseContextFailureCode,
	type SynaipseContextFailureEnvelope,
} from "./context-failures.js";
export { parseSynaipseContextFailureEnvelope } from "./context-failures.js";
export {
	createSynaipseTaskContext,
	type SynaipseTaskContext,
} from "./context-task.js";
export {
	parseSynaipseContextProjection,
	CONTEXT_UNKNOWN_REASONS,
	type ContextUnknownReason,
	type SynaipseContextProjection,
	validateSynaipseContextProjections,
} from "./context-projection.js";
export {
	parseSynaipseContextProvider,
	type SynaipseContextProvider,
} from "./context-provider.js";
export {
	parseSynaipseContextObservations,
	type SynaipseContextObservation,
} from "./context-observations.js";

const PURE_READ_EFFECTS = Object.freeze({
	writesFiles: false,
	mutatesGit: false,
	mutatesExternal: false,
});
type ContextBlockerCode =
	| "access_denied"
	| "historical_context"
	| "missing_context"
	| "provider_unavailable"
	| "stale_digest"
	| "superseded_context"
	| "unresolved_host_path";

/** Build one deterministic context-selection blocker and recovery. */
function contextBlocker(code: ContextBlockerCode, contextId: string) {
	return {
		code,
		contextId,
		recovery: {
			access_denied: "request_authorized_projection",
			historical_context: "select_current_context",
			missing_context: "refresh_context_provider",
			provider_unavailable: "restore_context_provider",
			stale_digest: "refresh_context_digest",
			superseded_context: "select_current_context",
			unresolved_host_path: "resolve_context_host_path",
		}[code],
	};
}

/** Return the first policy blocker for an applicable context ref. */
function policyBlocker(
	ref: ContextRef,
	input: ReturnType<typeof parseResolutionInput>,
): ContextBlockerCode | null {
	if (ref.lifecycle.status === "superseded") return "superseded_context";
	if (ref.lifecycle.status === "historical") return "historical_context";
	if (!input.acceptedAuthorities.includes(ref.authority))
		return "access_denied";
	if (
		synaipsePrivacyBlocks(
			ref.kind,
			ref.privacy.classification,
			ref.privacy.allowedConsumers,
			ref.privacy.prohibitedDestinations,
			input.taskContext.privacy,
			input.consumer,
			input.destination,
		)
	)
		return "access_denied";
	if (Date.parse(ref.freshness.observedAt) > Date.parse(input.observedAt))
		return "stale_digest";
	if (
		ref.freshness.expiresAt !== null &&
		Date.parse(ref.freshness.expiresAt) <= Date.parse(input.observedAt)
	)
		return "stale_digest";
	return null;
}

type RefResolution =
	| { kind: "skip" | "selected" }
	| { kind: "unknown"; reason: ContextUnknownReason }
	| { kind: "blocked"; code: ContextBlockerCode };

/** Project only requirement-consistent resolution failures into the envelope. */
function contextFailureIssue(
	resolution: RefResolution,
	ref: ContextRef,
	observedAt: string,
): ContextResolutionIssue | null {
	if (resolution.kind === "blocked")
		return {
			code: resolution.code,
			contextId: ref.contextId,
			requirement: ref.requirement,
			observedAt,
		};
	if (resolution.kind !== "unknown") return null;
	return {
		code: resolution.reason,
		contextId: ref.contextId,
		requirement: ref.requirement,
		observedAt,
	};
}

/** Resolve provider evidence after stage, task, authority, and privacy checks pass. */
function resolveObservation(
	ref: ContextRef,
	admittedDigest: string,
	input: ReturnType<typeof parseResolutionInput>,
): RefResolution {
	if (admittedDigest !== ref.digest)
		return { kind: "blocked", code: "stale_digest" };
	const observation = input.observations.find(
		(candidate) => candidate.contextId === ref.contextId,
	);
	if (!observation || observation.status === "unavailable")
		return ref.requirement === "required"
			? { kind: "blocked", code: "missing_context" }
			: { kind: "unknown", reason: "missing_context" };
	if (observation.status === "provider_unavailable")
		return ref.requirement === "required"
			? { kind: "blocked", code: "provider_unavailable" }
			: { kind: "unknown", reason: "provider_unavailable" };
	if (observation.status === "unresolved_host_path")
		return ref.requirement === "required"
			? { kind: "blocked", code: "unresolved_host_path" }
			: { kind: "unknown", reason: "unresolved_host_path" };
	if (observation.digest !== ref.digest)
		return { kind: "blocked", code: "stale_digest" };
	return { kind: "selected" };
}

/** Resolve one stage-applicable catalog ref against task admission and evidence. */
function resolveRef(
	ref: ContextRef,
	input: ReturnType<typeof parseResolutionInput>,
): RefResolution {
	if (!ref.stages.includes(input.stage)) return { kind: "skip" };
	const admitted = input.taskContext.selectedRefs.find(
		(candidate) => candidate.contextId === ref.contextId,
	);
	if (!admitted)
		return ref.requirement === "required"
			? { kind: "blocked", code: "missing_context" }
			: { kind: "skip" };
	const policy = policyBlocker(ref, input);
	if (policy) return { kind: "blocked", code: policy };
	return resolveObservation(ref, admitted.digest, input);
}

/** Resolve admitted context through metadata and supplied provider observations only. */
export function resolveSynaipseContext(value: unknown) {
	const input = parseResolutionInput(value);
	const selectedContextIds: string[] = [];
	const selectedRefs: SynaipseContextProjection[] = [];
	const unknownContextIds: string[] = [];
	const unknowns: Array<{ contextId: string; reason: ContextUnknownReason }> =
		[];
	const blockers: Array<ReturnType<typeof contextBlocker>> = [];
	const failureIssues: ContextResolutionIssue[] = [];
	for (const ref of input.catalog.refs) {
		const resolution = resolveRef(ref, input);
		if (resolution.kind === "skip") continue;
		const failureIssue = contextFailureIssue(resolution, ref, input.observedAt);
		if (failureIssue) failureIssues.push(failureIssue);
		if (resolution.kind === "blocked") {
			blockers.push(contextBlocker(resolution.code, ref.contextId));
		} else if (resolution.kind === "unknown") {
			unknownContextIds.push(ref.contextId);
			unknowns.push({ contextId: ref.contextId, reason: resolution.reason });
		} else {
			selectedContextIds.push(ref.contextId);
			selectedRefs.push(
				parseSynaipseContextProjection({
					contextId: ref.contextId,
					digest: ref.digest,
				}),
			);
		}
	}
	for (const admitted of input.taskContext.selectedRefs) {
		if (
			!input.catalog.refs.some((ref) => ref.contextId === admitted.contextId)
		) {
			blockers.push(contextBlocker("missing_context", admitted.contextId));
			failureIssues.push({
				code: "missing_context",
				contextId: admitted.contextId,
				requirement: "required",
				observedAt: input.observedAt,
			});
		}
	}
	const failures = failureIssues.map(contextFailureFromIssue);
	return {
		status:
			blockers.length === 0 ? ("resolved" as const) : ("blocked" as const),
		selectedContextIds,
		selectedRefs,
		unknownContextIds,
		unknowns,
		catalogRepository: input.catalog.repository,
		blockers,
		...(failures.length > 0
			? {
					contextFailures: {
						schemaVersion: SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION,
						failures,
					} satisfies SynaipseContextFailureEnvelope,
				}
			: {}),
		effects: PURE_READ_EFFECTS,
	};
}
