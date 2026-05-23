import { buildPromptGateOptionsFromCliArgs } from "./cli-args.js";
import { EXIT_CODES, type PromptGateOptions } from "./types.js";
import { runPromptGate } from "./validator.js";

/** Execute prompt-gate with typed CLI options and formatted output. */
export function runPromptGateCLI(options: PromptGateOptions): number {
	const result = runPromptGate(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		return result.error.code === "FILE_NOT_FOUND"
			? EXIT_CODES.TEMPLATE_MISSING
			: EXIT_CODES.SYSTEM_ERROR;
	}

	const { result: validation } = result;

	if (options.json) {
		console.info(JSON.stringify(validation, null, 2));
	} else {
		console.info(`Prompt Gate: ${validation.templateType}`);
		console.info("");

		for (const check of validation.checks) {
			const status = check.found ? "✓" : "✗";
			let line = `  ${status} ${check.section}`;
			if (check.itemsFound !== undefined && check.found) {
				line += ` (${check.itemsFound} items checked)`;
			}
			console.info(line);
		}

		if (validation.passed) {
			console.info("");
			console.info("All required sections present.");
		} else {
			console.error("");
			console.error(`Missing sections: ${validation.missing.join(", ")}`);
		}
	}

	return validation.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.VALIDATION_ERROR;
}

/** Run prompt-gate from raw command-line arguments. */
export function runPromptGateFromCliArgs(args: string[]): number {
	const parsed = buildPromptGateOptionsFromCliArgs(args);
	if (!parsed.ok) {
		console.error(parsed.message);
		return EXIT_CODES.VALIDATION_ERROR;
	}

	return runPromptGateCLI(parsed.options);
}
