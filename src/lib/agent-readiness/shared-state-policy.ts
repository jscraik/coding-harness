import { readText } from "./repo-evidence.js";

const REQUIRED_SHARED_STATE_ACTIONS = [
	"stage",
	"commit",
	"push",
	"merge",
	"deploy",
	"external_mutation",
] as const;

/** Machine-readable shared-state authority coverage from the harness contract. */
export interface SharedStateActionPolicy {
	/** Whether every required shared-state action has an authority entry. */
	complete: boolean;
	/** Required shared-state actions missing from the contract. */
	missing: string[];
}

/** Read shared-state action authority from the repo harness contract. */
export function readSharedStateActionPolicy(
	repoRoot: string,
): SharedStateActionPolicy {
	const contractText = readText(repoRoot, "harness.contract.json");
	if (contractText.length === 0) {
		return { complete: false, missing: [...REQUIRED_SHARED_STATE_ACTIONS] };
	}
	try {
		const parsed = JSON.parse(contractText) as {
			toolingPolicy?: { sharedStateActions?: unknown };
		};
		const actions = Array.isArray(parsed.toolingPolicy?.sharedStateActions)
			? parsed.toolingPolicy.sharedStateActions
			: [];
		const names = new Set(
			actions
				.map((action) =>
					typeof action === "object" &&
					action !== null &&
					"name" in action &&
					typeof action.name === "string"
						? action.name
						: null,
				)
				.filter((name): name is string => name !== null),
		);
		const missing = REQUIRED_SHARED_STATE_ACTIONS.filter(
			(action) => !names.has(action),
		);
		return { complete: missing.length === 0, missing };
	} catch {
		return { complete: false, missing: [...REQUIRED_SHARED_STATE_ACTIONS] };
	}
}
