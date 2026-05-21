import { buildObservabilityGateOptionsFromCliArgs } from "./cli-args.js";
import { runObservabilityGate } from "./label-cardinality.js";
import { EXIT_CODES } from "./types.js";
import type { ObservabilityGateOptions } from "./types.js";

/** CLI entry point with output formatting and exit codes. */
export function runObservabilityGateCLI(
	options: ObservabilityGateOptions,
): number {
	const result = runObservabilityGate(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		return result.error.code === "VALIDATION_ERROR"
			? EXIT_CODES.VALIDATION_ERROR
			: EXIT_CODES.SYSTEM_ERROR;
	}

	const { output } = result;

	if (options.json) {
		console.info(JSON.stringify(output, null, 2));
	} else {
		console.info("Observability Gate");
		console.info(`Labels checked: ${output.labelsChecked}`);
		console.info(`Violations: ${output.violations.length}`);

		if (output.violations.length > 0) {
			console.error("");
			console.error("Violations found:");
			for (const violation of output.violations) {
				console.error(`  [${violation.type}] ${violation.name}`);
				console.error(`    ${violation.message}`);
				console.error(`    Suggestion: ${violation.suggestion}`);
				console.error("");
			}
		} else {
			console.info("All labels pass cardinality checks.");
		}
	}

	return output.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.VIOLATION_FOUND;
}

/** Run observability-gate from raw CLI arguments. */
export function runObservabilityGateFromCliArgs(args: string[]): number {
	return runObservabilityGateCLI(
		buildObservabilityGateOptionsFromCliArgs(args),
	);
}
