import {
	buildHarnessDecision,
	HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION,
	type HarnessDecision,
	type HarnessDecisionInput,
	type HarnessDecisionPermissionPlan,
	type HarnessDecisionRecommendationEffects,
} from "../lib/decision/harness-decision.js";

/** Build a standardized decision scoped to the harness next CLI. */
export function createNextDecision(
	decision: HarnessDecisionInput,
): HarnessDecision {
	const built = buildHarnessDecision("harness next", decision);
	return {
		...built,
		meta: {
			...(built.meta ?? {}),
			recommendationEffects: recommendationEffectsFor(built),
		},
	};
}

/**
 * Reconstruct the legacy recommendation plan when a producer omitted operational metadata.
 *
 * @returns A conservative permission plan derived only from the decision's existing recommendation fields.
 */
function fallbackPermissionPlan(
	decision: HarnessDecision,
): HarnessDecisionPermissionPlan {
	return {
		requiresHuman: decision.requiresHuman,
		requiresNetwork: decision.requiresNetwork,
		writesFiles: decision.writesFiles,
		requiresGitWrite: false,
		filesystemWrite: [],
		commands: decision.nextCommand === null ? [] : [decision.nextCommand],
		secrets: [],
	};
}

/** Build the plan for a later recommendation without treating it as an invocation effect. */
function recommendationEffectsFor(
	decision: HarnessDecision,
): HarnessDecisionRecommendationEffects {
	const permissionPlan =
		decision.meta?.execution?.permissionPlan ??
		fallbackPermissionPlan(decision);
	return {
		schemaVersion: HARNESS_DECISION_RECOMMENDATION_EFFECTS_SCHEMA_VERSION,
		authority: {
			safeToRun: decision.safeToRun,
			requiresHuman: decision.requiresHuman,
			requiresNetwork: decision.requiresNetwork,
			requiresGitWrite: permissionPlan.requiresGitWrite,
		},
		rollbackPosture: "not_started",
		requiredEvidence: [...decision.requiredEvidence],
		retry: decision.retry,
		permissionPlan: {
			...permissionPlan,
			filesystemWrite: [...permissionPlan.filesystemWrite],
			commands: [...permissionPlan.commands],
			secrets: [...permissionPlan.secrets],
		},
	};
}
