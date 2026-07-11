/** Effect classes that an agent must consider before invoking a command. */
import { UI_FAST_EFFECTS } from "./command-invocation-effects-ui.js";

export type CommandEffectClass =
	| "pure_read"
	| "writes_artifact"
	| "writes_repository"
	| "mutates_git"
	| "mutates_external";

/** One concrete command invocation and its declared operational effects. */
export interface CommandInvocationEffect {
	invocation: string;
	effectClasses: CommandEffectClass[];
	targets: string[];
	providerClass: string;
	authority: string;
	retryPolicy: "safe" | "conditional" | "manual";
	rollback: string;
	expectedEvidence: string[];
}

/** Derive coarse command mutability from the declared invocation effects. */
export function getInvocationMutability(
	effects: readonly CommandInvocationEffect[],
): "read" | "write" {
	return effects.every(
		(effect) =>
			effect.effectClasses.length === 1 &&
			effect.effectClasses[0] === "pure_read",
	)
		? "read"
		: "write";
}

type EffectInput = Omit<CommandInvocationEffect, "invocation">;

/** Creates an invocation declaration while keeping its shared effect payload typed. */
function effect(
	invocation: string,
	input: EffectInput,
): CommandInvocationEffect {
	return { invocation, ...input };
}

const PURE_LOCAL: EffectInput = {
	effectClasses: ["pure_read"],
	targets: ["repository working tree"],
	providerClass: "local_process",
	authority: "No write authority required.",
	retryPolicy: "safe",
	rollback: "No state change to roll back.",
	expectedEvidence: ["structured command output"],
};

/**
 * Characterized invocation effects for the JSC-442 Slice 1 command set.
 *
 * Each entry names the invocation rather than treating a command name as one
 * behavior. Commands outside this admitted set retain a conservative legacy
 * projection until they are characterized in a later slice.
 */
const CHARACTERIZED_EFFECTS_BY_NAME: Readonly<
	Record<string, readonly CommandInvocationEffect[]>
> = {
	doctor: [
		effect("doctor --json", PURE_LOCAL),
		effect("doctor --write-artifact --json", {
			effectClasses: ["writes_artifact"],
			targets: [
				"repository working tree",
				".harness/guardrails/north-star surface classification artifact",
			],
			providerClass: "local_filesystem",
			authority: "Repository artifact-write authority is required.",
			retryPolicy: "safe",
			rollback: "Remove the generated north-star classification artifact.",
			expectedEvidence: [
				"doctor JSON report",
				"north-star surface classification artifact",
			],
		}),
	],
	"docs-gate": [
		effect("docs-gate --json", {
			effectClasses: ["writes_artifact", "writes_repository"],
			targets: [
				"artifacts/consistency-gate docs-gate report",
				".harness contradiction history",
			],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback: "Remove the generated report and appended history entry.",
			expectedEvidence: ["docs-gate report and contradiction-history update"],
		}),
		effect("docs-gate --out <path> --json", {
			effectClasses: ["writes_repository"],
			targets: [
				"explicit docs-gate report output path",
				".harness contradiction history",
			],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback:
				"Restore or remove the explicit report output and contradiction-history entry.",
			expectedEvidence: [
				"docs-gate report at the explicit output path",
				"contradiction-history update",
			],
		}),
	],
	contract: [
		effect("contract validate --json", PURE_LOCAL),
		effect("contract schema", PURE_LOCAL),
		effect("contract init", {
			effectClasses: ["writes_repository"],
			targets: ["harness.contract.json"],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback: "Restore or remove the generated contract file.",
			expectedEvidence: ["created contract JSON"],
		}),
		effect("contract init --output <path>", {
			effectClasses: ["writes_repository"],
			targets: ["explicit local filesystem contract output path"],
			providerClass: "local_filesystem",
			authority: "Local filesystem write authority is required.",
			retryPolicy: "conditional",
			rollback: "Restore or remove the generated contract file.",
			expectedEvidence: ["created contract JSON at the explicit output path"],
		}),
		effect(
			"contract normalize-required-checks --manifest <path> --json",
			PURE_LOCAL,
		),
	],
	"context-health": [
		effect("context-health --json", {
			effectClasses: ["writes_artifact"],
			targets: [
				"artifacts/context-integrity context-health reports",
				"conditional memory-metrics snapshot artifact",
			],
			providerClass: "local_filesystem",
			authority: "Repository artifact-write authority is required.",
			retryPolicy: "safe",
			rollback:
				"Remove generated context-integrity reports and any memory-metrics snapshot.",
			expectedEvidence: [
				"context-health report artifact",
				"memory-metrics snapshot artifact when a source is present",
			],
		}),
		effect("context-health --out <path> --json", {
			effectClasses: ["writes_repository"],
			targets: [
				"explicit context-health output path",
				"artifacts/context-integrity index-source-inventory artifact",
				"conditional memory-metrics snapshot artifact",
			],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback:
				"Restore or remove the explicit report, generated index-source-inventory artifact, and any memory-metrics snapshot.",
			expectedEvidence: [
				"context-health report at the explicit output path",
				"index-source-inventory artifact",
				"memory-metrics snapshot artifact when a source is present",
			],
		}),
	],
	"workflow:generate": [
		effect("workflow:generate --source <path> --json", PURE_LOCAL),
		effect("workflow:generate --source <path> --dry-run", PURE_LOCAL),
		effect("workflow:generate --source <path> --output <path>", {
			effectClasses: ["writes_repository"],
			targets: ["explicit operational-spec output path"],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback: "Restore or remove the generated operational spec.",
			expectedEvidence: ["generated operational spec"],
		}),
		effect("workflow:generate --source <path> --output <path> --watch", {
			effectClasses: ["writes_repository"],
			targets: ["explicit operational-spec output path on each source change"],
			providerClass: "local_filesystem_watcher",
			authority: "Repository write authority is required for repeated writes.",
			retryPolicy: "manual",
			rollback: "Stop the watcher and restore or remove generated output.",
			expectedEvidence: ["watcher output and generated operational spec"],
		}),
	],
	"pattern-scope": [
		effect("pattern-scope --files <paths> --json", PURE_LOCAL),
		effect("pattern-scope --files <paths> --output <path> --json", {
			effectClasses: ["writes_repository"],
			targets: ["explicit pattern-scope output path"],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback: "Restore or remove the generated pattern-scope output.",
			expectedEvidence: ["pattern-scope JSON output"],
		}),
	],
	"drift-gate": [
		effect("drift-gate --json", {
			effectClasses: ["writes_repository", "writes_artifact"],
			targets: [
				"drift-gate baseline",
				"north-star findings artifact",
				"consistency report and guardrail state",
			],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback: "Restore the baseline and remove generated drift artifacts.",
			expectedEvidence: ["drift-gate report and north-star findings artifact"],
		}),
	],
	"check-environment": [
		effect("check-environment --json", PURE_LOCAL),
		effect("check-environment --attestation <path> --json", {
			effectClasses: ["writes_repository"],
			targets: ["explicit environment attestation path"],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback: "Restore or remove the environment attestation.",
			expectedEvidence: ["environment attestation JSON"],
		}),
	],
	"ui:fast": UI_FAST_EFFECTS,
	"ui:verify": [
		effect("ui:verify --mode prepare --json", {
			effectClasses: ["writes_artifact"],
			targets: ["UI evidence artifact output"],
			providerClass: "local_filesystem",
			authority: "Repository artifact-write authority is required.",
			retryPolicy: "safe",
			rollback: "Remove the generated UI evidence artifact.",
			expectedEvidence: ["UI verification evidence artifact"],
		}),
		effect("ui:verify --json", {
			effectClasses: [
				"writes_artifact",
				"writes_repository",
				"mutates_external",
			],
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
			expectedEvidence: ["UI verification execution evidence artifact"],
		}),
		effect("ui:verify --mode execute --json", {
			effectClasses: [
				"writes_artifact",
				"writes_repository",
				"mutates_external",
			],
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
			expectedEvidence: ["UI verification execution evidence artifact"],
		}),
	],
	"ui:explore": [
		effect("ui:explore --mode prepare --json", {
			effectClasses: ["writes_artifact"],
			targets: ["UI evidence artifact output"],
			providerClass: "local_filesystem",
			authority: "Repository artifact-write authority is required.",
			retryPolicy: "safe",
			rollback: "Remove the generated UI evidence artifact.",
			expectedEvidence: ["UI exploration evidence artifact"],
		}),
		effect("ui:explore --json", {
			effectClasses: [
				"writes_artifact",
				"writes_repository",
				"mutates_external",
			],
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
			expectedEvidence: ["UI exploration execution evidence artifact"],
		}),
		effect("ui:explore --mode execute --json", {
			effectClasses: [
				"writes_artifact",
				"writes_repository",
				"mutates_external",
			],
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
			expectedEvidence: ["UI exploration execution evidence artifact"],
		}),
	],
	"review-context": [
		effect("review-context --files <paths> --json", PURE_LOCAL),
		effect("review-context --files <paths> --output <path> --json", {
			effectClasses: ["writes_repository"],
			targets: ["explicit review-context output path"],
			providerClass: "local_filesystem",
			authority: "Repository write authority is required.",
			retryPolicy: "conditional",
			rollback: "Restore or remove the generated review-context output.",
			expectedEvidence: ["review-context JSON output"],
		}),
	],
	"linear-gate": [
		effect("linear-gate --json", {
			effectClasses: ["pure_read"],
			targets: ["repository issue-tracking policy", "current Git branch"],
			providerClass: "local_git_and_configuration",
			authority: "No write authority required.",
			retryPolicy: "safe",
			rollback: "No state change to roll back.",
			expectedEvidence: ["linear-gate JSON result"],
		}),
	],
};

/** Whether a catalog effect projection is source-characterized by this slice. */
export function getCommandEffectCharacterization(
	name: string,
): "characterized" | "legacy_uncharacterized" {
	return CHARACTERIZED_EFFECTS_BY_NAME[name]
		? "characterized"
		: "legacy_uncharacterized";
}

/** Return characterized effects when known, otherwise a conservative legacy projection. */
export function getCommandInvocationEffects(
	name: string,
	mutability: "read" | "write",
	retryPolicy: "safe" | "conditional" | "manual",
): CommandInvocationEffect[] {
	const characterized = CHARACTERIZED_EFFECTS_BY_NAME[name];
	if (characterized)
		return characterized.map((entry) => ({
			...entry,
			effectClasses: [...entry.effectClasses],
			targets: [...entry.targets],
			expectedEvidence: [...entry.expectedEvidence],
		}));

	return [
		effect(name, {
			effectClasses: [
				mutability === "read" ? "pure_read" : "writes_repository",
			],
			targets: ["repository working tree"],
			providerClass: "legacy_uncharacterized",
			authority:
				mutability === "read"
					? "No write authority required."
					: "Repository write authority is required.",
			retryPolicy,
			rollback:
				mutability === "read"
					? "No state change to roll back."
					: "Restore the affected repository state.",
			expectedEvidence: ["command output"],
		}),
	];
}
