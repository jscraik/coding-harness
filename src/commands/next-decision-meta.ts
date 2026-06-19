import {
	buildHarnessDecision,
	type HarnessDecision,
	type HarnessDecisionInput,
} from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import { normaliseHePhaseExitResult } from "../lib/output/normalise.js";
import {
	normaliseRuntimeCard,
	type RuntimeCard,
} from "../lib/runtime/runtime-card.js";
import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import { decisionMeta, sourceMetaExtra } from "./next-support.js";
import type { HarnessNextMode } from "./next-decision-types.js";

/**
 * Build a standardized HarnessDecision scoped to the "harness next" CLI.
 *
 * @param decision - Input decision fields used to construct the final HarnessDecision
 * @returns A fully formed HarnessDecision with "harness next" as its producer context
 */
export function createNextDecision(
	decision: HarnessDecisionInput,
): HarnessDecision {
	return buildHarnessDecision("harness next", decision);
}

function phaseExitMeta(
	phaseExit: HePhaseExit | undefined,
): Record<string, unknown> | undefined {
	if (!phaseExit) return undefined;
	return {
		hePhaseExit: normaliseHePhaseExitResult(phaseExit),
	};
}

function runtimeCardMeta(
	runtimeCard: RuntimeCard | undefined,
): Record<string, unknown> | undefined {
	if (!runtimeCard) return undefined;
	return {
		runtimeCard: normaliseRuntimeCard(runtimeCard),
	};
}

function agentReadinessContextMeta(
	contextHealth: AgentReadinessContextHealth | undefined,
): Record<string, unknown> | undefined {
	if (!contextHealth) return undefined;
	const degradedSurfaces = contextHealth.surfaces
		.filter((surface) => surface.status !== "pass")
		.map((surface) => ({
			id: surface.id,
			status: surface.status,
			evidenceUse: surface.evidenceUse,
			staleReasons: surface.staleReasons,
			...(surface.missingRefs ? { missingRefs: surface.missingRefs } : {}),
			suggestedRefreshCommands: surface.suggestedRefreshCommands,
		}));
	return {
		agentReadinessContext: {
			schemaVersion: contextHealth.schemaVersion,
			status: contextHealth.status,
			evidenceUse: contextHealth.evidenceUse,
			degradedSurfaceCount: degradedSurfaces.length,
			degradedSurfaces,
			suggestedRefreshCommands: contextHealth.suggestedRefreshCommands,
		},
	};
}

/**
 * Builds standardized operational metadata for a `harness next` decision.
 *
 * @param args - Operational context and optional evidence projections to attach to the decision metadata
 * @returns A decision meta object populated with operational fields and normalized source/evidence metadata
 */
export function nextDecisionOperationalMeta(args: {
	mode: HarnessNextMode;
	filesSource?: "override" | "git";
	changedFileCount?: number;
	nextCommandArgv?: string[];
	frictionClass?: Parameters<typeof decisionMeta>[0]["frictionClass"];
	delayClass?: Parameters<typeof decisionMeta>[0]["delayClass"];
	startupCost?: Parameters<typeof decisionMeta>[0]["startupCost"];
	commands?: string[];
	requiresHuman?: boolean;
	sourceErrors?: readonly DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
	agentReadinessContext?: AgentReadinessContextHealth | undefined;
	extra?: Record<string, unknown> | undefined;
}): ReturnType<typeof decisionMeta> {
	return decisionMeta({
		mode: args.mode,
		...(args.filesSource ? { filesSource: args.filesSource } : {}),
		...(args.changedFileCount !== undefined
			? { changedFileCount: args.changedFileCount }
			: {}),
		...(args.nextCommandArgv ? { nextCommandArgv: args.nextCommandArgv } : {}),
		...(args.frictionClass ? { frictionClass: args.frictionClass } : {}),
		...(args.delayClass ? { delayClass: args.delayClass } : {}),
		...(args.startupCost ? { startupCost: args.startupCost } : {}),
		...(args.commands ? { commands: args.commands } : {}),
		...(args.requiresHuman !== undefined
			? { requiresHuman: args.requiresHuman }
			: {}),
		extra: {
			...sourceMetaExtra(args.sourceErrors ?? []),
			...phaseExitMeta(args.phaseExit),
			...runtimeCardMeta(args.runtimeCard),
			...agentReadinessContextMeta(args.agentReadinessContext),
			...(args.extra ?? {}),
		},
	});
}
