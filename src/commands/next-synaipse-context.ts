import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import {
	SynaipseContextContractError,
	SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION,
	createSynaipseContextFailure,
	resolveSynaipseContext,
} from "../lib/synaipse/context-plane.js";
import type { SynaipseContextFailureEnvelope } from "../lib/synaipse/context-plane.js";
import type {
	SynaipseContextProjection,
	SynaipseContextUnknown,
} from "../lib/synaipse/context-projection.js";
import { readSynaipseRepositoryName } from "../lib/synaipse/state.js";
import { blockedDecision } from "./next-decisions.js";

interface OptionalNextContext {
	decision: HarnessDecision | null;
	refs: SynaipseContextProjection[];
	unknowns: SynaipseContextUnknown[];
	/** Additive failure diagnostics retained for successful optional resolution. */
	contextFailures?: SynaipseContextFailureEnvelope;
}

/** Build the required envelope for project/catalog identity failures. */
function failureEnvelope(
	code:
		| "missing_project_identity"
		| "missing_context_catalog"
		| "malformed_context_catalog",
	evidenceRef: string,
	observedAt = new Date().toISOString(),
): SynaipseContextFailureEnvelope {
	return {
		schemaVersion: SYNAIPSE_CONTEXT_FAILURE_ENVELOPE_SCHEMA_VERSION,
		failures: [
			createSynaipseContextFailure({
				code,
				requirement: "required",
				contextId: null,
				recovery: {
					missing_project_identity: "establish_project_identity",
					missing_context_catalog: "admit_context_catalog",
					malformed_context_catalog: "repair_context_catalog",
				}[code],
				evidenceRefs: [evidenceRef],
				freshness: "unknown",
				observedAt,
			}),
		],
	};
}

/** Map a parser path to the most precise required catalog failure code. */
function malformedFailureCode(error: SynaipseContextContractError) {
	if (error.path === "catalog") return "missing_context_catalog" as const;
	if (error.path.endsWith(".projectId"))
		return "missing_project_identity" as const;
	return "malformed_context_catalog" as const;
}

/** Return the blocked decision for a missing repository identity. */
function missingRepositoryContext(): OptionalNextContext {
	return {
		decision: blockedDecision({
			summary: "SynAIpse context repository identity is unavailable.",
			nextAction:
				"Restore repository identity discovery, then rerun harness next --json.",
			failureClass: "context_repository_identity_unavailable",
			evidenceRef: ["repository:identity"],
			meta: {
				synaipseContextFailures: failureEnvelope(
					"missing_project_identity",
					"repository:identity",
				),
			},
		}),
		refs: [],
		unknowns: [],
	};
}

/** Return the blocked decision for a repository identity mismatch. */
function mismatchedRepositoryContext(repository: string): OptionalNextContext {
	return {
		decision: blockedDecision({
			summary: "SynAIpse context targets a different repository.",
			nextAction: "Rebuild the task context for the target repository.",
			failureClass: "context_project_mismatch",
			evidenceRef: [`repository:${repository}`],
			meta: {
				synaipseContextFailures: failureEnvelope(
					"missing_project_identity",
					`repository:${repository}`,
				),
			},
		}),
		refs: [],
		unknowns: [],
	};
}

/** Project a blocked resolution and preserve its canonical failure envelope. */
function blockedResolutionContext(
	resolution: ReturnType<typeof resolveSynaipseContext>,
): OptionalNextContext {
	const blocker = resolution.blockers[0];
	return {
		decision: blockedDecision({
			summary: "Required SynAIpse context could not be resolved.",
			nextAction: blocker?.recovery ?? "repair_context_contract",
			failureClass: blocker?.code ?? "context_resolution_blocked",
			evidenceRef: blocker ? [`context:${blocker.contextId}`] : [],
			...(resolution.contextFailures
				? { meta: { synaipseContextFailures: resolution.contextFailures } }
				: {}),
		}),
		refs: resolution.selectedRefs,
		unknowns: resolution.unknowns,
	};
}

/** Project a malformed input error as a required catalog failure. */
function malformedContext(
	error: SynaipseContextContractError,
): OptionalNextContext {
	const detail = `${error.path}: ${error.detail}`;
	return {
		decision: blockedDecision({
			summary: `SynAIpse context contract is malformed: ${detail}.`,
			nextAction: "Repair the context packet, then rerun harness next --json.",
			failureClass: "malformed_context",
			evidenceRef: ["context:input"],
			meta: {
				synaipseContextFailures: failureEnvelope(
					malformedFailureCode(error),
					"context:input",
				),
			},
		}),
		refs: [],
		unknowns: [],
	};
}

/** Resolve supplied task-admitted context before repository inspection begins. */
function resolveNextContext(
	value: unknown,
	repoRoot: string,
	readRepositoryName: (
		repoRoot: string,
	) => string | null = readSynaipseRepositoryName,
): OptionalNextContext {
	try {
		const resolution = resolveSynaipseContext(value);
		const targetRepository = readRepositoryName(repoRoot);
		if (targetRepository === null) return missingRepositoryContext();
		if (targetRepository !== resolution.catalogRepository)
			return mismatchedRepositoryContext(resolution.catalogRepository);
		if (resolution.status === "resolved")
			return {
				decision: null,
				refs: resolution.selectedRefs,
				unknowns: resolution.unknowns,
				...(resolution.contextFailures
					? { contextFailures: resolution.contextFailures }
					: {}),
			};
		return blockedResolutionContext(resolution);
	} catch (error) {
		if (!(error instanceof SynaipseContextContractError)) throw error;
		return malformedContext(error);
	}
}

/** Resolve optional context input, preserving the no-context compatibility path. */
export function resolveOptionalNextContext(
	value: unknown,
	repoRoot: string,
	readRepositoryName: (repoRoot: string) => string | null,
): OptionalNextContext {
	return value === undefined
		? { decision: null, refs: [], unknowns: [] }
		: resolveNextContext(value, repoRoot, readRepositoryName);
}
