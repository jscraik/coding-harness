import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import {
	SynaipseContextContractError,
	resolveSynaipseContext,
} from "../lib/synaipse/context-plane.js";
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
		if (targetRepository === null)
			return {
				decision: blockedDecision({
					summary: "SynAIpse context repository identity is unavailable.",
					nextAction:
						"Restore repository identity discovery, then rerun harness next --json.",
					failureClass: "context_repository_identity_unavailable",
					evidenceRef: ["repository:identity"],
				}),
				refs: [],
				unknowns: [],
			};
		if (targetRepository !== resolution.catalogRepository)
			return {
				decision: blockedDecision({
					summary: "SynAIpse context targets a different repository.",
					nextAction: "Rebuild the task context for the target repository.",
					failureClass: "context_project_mismatch",
					evidenceRef: [`repository:${resolution.catalogRepository}`],
				}),
				refs: [],
				unknowns: [],
			};
		if (resolution.status === "resolved")
			return {
				decision: null,
				refs: resolution.selectedRefs,
				unknowns: resolution.unknowns,
			};
		const blocker = resolution.blockers[0];
		return {
			decision: blockedDecision({
				summary: "Required SynAIpse context could not be resolved.",
				nextAction: blocker?.recovery ?? "repair_context_contract",
				failureClass: blocker?.code ?? "context_resolution_blocked",
				evidenceRef: blocker ? [`context:${blocker.contextId}`] : [],
			}),
			refs: resolution.selectedRefs,
			unknowns: resolution.unknowns,
		};
	} catch (error) {
		if (!(error instanceof SynaipseContextContractError)) throw error;
		const detail = `${error.path}: ${error.detail}`;
		return {
			decision: blockedDecision({
				summary: `SynAIpse context contract is malformed: ${detail}.`,
				nextAction:
					"Repair the context packet, then rerun harness next --json.",
				failureClass: "malformed_context",
				evidenceRef: ["context:input"],
			}),
			refs: [],
			unknowns: [],
		};
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
