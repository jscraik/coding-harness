import type { CommandInvocationEffect } from "./command-invocation-effects.js";

/** Characterization for the local execution coordinator command. */
export const EXECUTION_EFFECTS: readonly CommandInvocationEffect[] = [
	{
		invocation: "run --command <executable> -- <args>",
		effectClasses: ["writes_artifact"],
		targets: ["artifacts/agent-runs/<run-id> execution result and logs"],
		providerClass: "local_process_coordinator",
		authority:
			"Local process and repository artifact-write authority are required.",
		retryPolicy: "conditional",
		rollback: "Remove the execution result and log artifacts for the run.",
		expectedEvidence: ["harness-execution-result/v1", "stdout and stderr logs"],
	},
];
