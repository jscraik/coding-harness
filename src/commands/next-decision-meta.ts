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
import { orientationMeta } from "./next-orientation-meta.js";
import { decisionMeta, sourceMetaExtra } from "./next-support.js";
import type { HarnessNextMode } from "./next-decision-types.js";

type DecisionMetaArgs = Parameters<typeof decisionMeta>[0];
/** Build a standardized decision scoped to the harness next CLI. */
export function createNextDecision(
	decision: HarnessDecisionInput,
): HarnessDecision {
	return buildHarnessDecision("harness next", decision);
}
/** Normalize HE phase-exit evidence when present. */
function phaseExitMeta(
	phaseExit: HePhaseExit | undefined,
): Record<string, unknown> | undefined {
	if (!phaseExit) return undefined;
	return { hePhaseExit: normaliseHePhaseExitResult(phaseExit) };
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

/** Add optional decision metadata only when the caller observed a value. */
function addDefinedMetaArg<K extends keyof DecisionMetaArgs>(
	meta: DecisionMetaArgs,
	key: K,
	value: DecisionMetaArgs[K] | undefined,
): void {
	if (value !== undefined) meta[key] = value;
}

/** Build normalized operational metadata for harness next decisions. */
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
	requiresNetwork?: boolean;
	writesFiles?: boolean;
	sourceErrors?: readonly DecisionSource[];
	phaseExit?: HePhaseExit | undefined;
	runtimeCard?: RuntimeCard | undefined;
	agentReadinessContext?: AgentReadinessContextHealth | undefined;
	extra?: Record<string, unknown> | undefined;
}): ReturnType<typeof decisionMeta> {
	const metaArgs: DecisionMetaArgs = {
		mode: args.mode,
		extra: {
			...orientationMeta(),
			...(args.extra ?? {}),
			...sourceMetaExtra(args.sourceErrors ?? []),
			...phaseExitMeta(args.phaseExit),
			...runtimeCardMeta(args.runtimeCard),
			...agentReadinessContextMeta(args.agentReadinessContext),
		},
	};
	addDefinedMetaArg(metaArgs, "filesSource", args.filesSource);
	addDefinedMetaArg(metaArgs, "changedFileCount", args.changedFileCount);
	addDefinedMetaArg(metaArgs, "nextCommandArgv", args.nextCommandArgv);
	addDefinedMetaArg(metaArgs, "frictionClass", args.frictionClass);
	addDefinedMetaArg(metaArgs, "delayClass", args.delayClass);
	addDefinedMetaArg(metaArgs, "startupCost", args.startupCost);
	addDefinedMetaArg(metaArgs, "commands", args.commands);
	addDefinedMetaArg(metaArgs, "requiresHuman", args.requiresHuman);
	addDefinedMetaArg(metaArgs, "requiresNetwork", args.requiresNetwork);
	addDefinedMetaArg(metaArgs, "writesFiles", args.writesFiles);
	return decisionMeta(metaArgs);
}
