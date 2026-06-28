import { runOrientCLI as runOrientCliWithProvider } from "../lib/orient/cli.js";
import type { HarnessOrientNextDecisionProvider } from "../lib/orient/types.js";
import { runHarnessNext } from "./next-runner.js";

/** Provide harness-next evidence to the public orient command. */
const nextDecisionProvider: HarnessOrientNextDecisionProvider = ({
	repoRoot,
	contextHealth,
}) =>
	runHarnessNext({
		repoRoot,
		agentReadinessContext: contextHealth,
	});

/** Run the public orient command with command-layer next decision evidence. */
export function runOrientCLI(args: string[]): number {
	return runOrientCliWithProvider(args, nextDecisionProvider);
}

export {
	PREFLIGHT_RECEIPT_PATH,
	collectHarnessOrient,
} from "../lib/orient/collector.js";
export type {
	HarnessOrientArchitectureContext,
	HarnessOrientConditionalContext,
	HarnessOrientContextCommand,
	HarnessOrientContextRef,
	HarnessOrientEvidenceUse,
	HarnessOrientNextDecision,
	HarnessOrientOptions,
	HarnessOrientPreflightReceipt,
	HarnessOrientPreflightStatus,
	HarnessOrientProjectBrain,
	HarnessOrientReport,
	HarnessOrientSessionContext,
	HarnessOrientStatus,
	HarnessOrientTruthLaneWarning,
	HarnessOrientUsageError,
} from "../lib/orient/types.js";
