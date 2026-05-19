import { runRuleLifecycleGateCLI } from "../../../commands/rule-lifecycle-gate.js";
import { inspectFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the rule lifecycle gate command spec for the CLI registry. */
export function createRuleLifecycleGateCommandSpec(): CommandSpec {
	return {
		name: "rule-lifecycle-gate",
		summary:
			"Validate governance rules have owner, evidence, enforcement, freshness, and retirement metadata",
		example: "rule-lifecycle-gate --json",
		errorLabel: "Rule Lifecycle Gate Error",
		execute: (args) => runRuleLifecycleGateCommand(args),
	};
}

function runRuleLifecycleGateCommand(args: string[]): number {
	const jsonFlag = args.includes("--json");
	const manifestFlag = inspectFlagValue(args, "--manifest");
	const repoRootFlag = inspectFlagValue(args, "--repo-root");

	if (manifestFlag.present && manifestFlag.missingValue) {
		console.error("rule-lifecycle-gate requires a value for --manifest.");
		return 2;
	}
	if (repoRootFlag.present && repoRootFlag.missingValue) {
		console.error("rule-lifecycle-gate requires a value for --repo-root.");
		return 2;
	}

	const options: Parameters<typeof runRuleLifecycleGateCLI>[0] = {};
	if (jsonFlag) options.json = true;
	if (manifestFlag.value !== undefined) {
		options.manifestPath = manifestFlag.value;
	}
	if (repoRootFlag.value !== undefined) {
		options.repoRoot = repoRootFlag.value;
	}
	return runRuleLifecycleGateCLI(options);
}
