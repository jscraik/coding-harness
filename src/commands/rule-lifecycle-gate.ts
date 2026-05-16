import { runRuleLifecycleGate } from "../lib/rule-lifecycle.js";

interface RuleLifecycleGateCliOptions {
	repoRoot?: string | undefined;
	manifestPath?: string | undefined;
	json?: boolean | undefined;
}

/** Execute the rule lifecycle governance gate. */
export function runRuleLifecycleGateCLI(
	options: RuleLifecycleGateCliOptions = {},
): number {
	const result = runRuleLifecycleGate({
		repoRoot: options.repoRoot,
		manifestPath: options.manifestPath,
	});

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		console.info(`rule-lifecycle-gate: ${result.status}`);
		for (const finding of result.findings) {
			const rule = finding.ruleId ? ` ${finding.ruleId}` : "";
			const fix = finding.fix ? ` Fix: ${finding.fix}` : "";
			const output = `  - [${finding.severity}]${rule} ${finding.message}${fix}`;
			if (finding.severity === "error") console.error(output);
			else console.info(output);
		}
	}

	return result.summary.errors > 0 ? 1 : 0;
}
