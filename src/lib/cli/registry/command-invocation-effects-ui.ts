import type { CommandInvocationEffect } from "./command-invocation-effects.js";

/** Source-characterized UI fast invocations kept separate from the core catalog. */
export const UI_FAST_EFFECTS: readonly CommandInvocationEffect[] = [
	{
		invocation: "ui:fast --mode prepare --json",
		effectClasses: ["writes_artifact"],
		targets: ["UI evidence artifact output"],
		providerClass: "local_filesystem",
		authority: "Repository artifact-write authority is required.",
		retryPolicy: "safe",
		rollback: "Remove the generated UI evidence artifact.",
		expectedEvidence: ["UI fast evidence artifact"],
	},
	{
		invocation: "ui:fast --json",
		effectClasses: ["writes_artifact", "writes_repository", "mutates_external"],
		targets: [
			"UI evidence artifact output",
			"project-defined UI command outputs",
		],
		providerClass: "local_ui_runner",
		authority:
			"Repository-write and external UI-execution authority are required.",
		retryPolicy: "manual",
		rollback:
			"Restore changed UI outputs and remove generated evidence artifacts.",
		expectedEvidence: ["UI fast execution evidence artifact"],
	},
	{
		invocation: "ui:fast --mode execute --json",
		effectClasses: ["writes_artifact", "writes_repository", "mutates_external"],
		targets: [
			"UI evidence artifact output",
			"project-defined UI command outputs",
		],
		providerClass: "local_ui_runner",
		authority:
			"Repository-write and external UI-execution authority are required.",
		retryPolicy: "manual",
		rollback:
			"Restore changed UI outputs and remove generated evidence artifacts.",
		expectedEvidence: ["UI fast execution evidence artifact"],
	},
];
