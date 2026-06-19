/**
 * check-authz command for pilot authorization preflight validation.
 * Validates token scope, repo/branch targets, and artifact exclusion policy.
 */
import {
	type CheckAuthzOutput,
	type CheckAuthzOptions,
	runCheckAuthz,
} from "../lib/review-gate/authz-core.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	POLICY_VIOLATION: 1,
	VALIDATION_ERROR: 2,
	CONTRACT_ERROR: 3,
} as const;

function reportContractError(error: { message: string }, json?: boolean): void {
	if (json) {
		console.error(JSON.stringify({ error }, null, 2));
		return;
	}
	console.error(`Error: ${error.message}`);
}

function renderPassedOutput(output: CheckAuthzOutput): void {
	console.info("✓ Authorization check passed");
	if (output.repoChecked) {
		console.info(`  Repository: ${output.repoChecked}`);
	}
	if (output.branchChecked) {
		console.info(`  Branch: ${output.branchChecked}`);
	}
	if (output.tokenScopes && output.tokenScopes.length > 0) {
		console.info(`  Token scopes: ${output.tokenScopes.join(", ")}`);
	}
}

function renderFailedOutput(output: CheckAuthzOutput): void {
	console.error("✗ Authorization check failed");
	console.error("");
	for (const violation of output.violations) {
		console.error(`  ${violation.type}: ${violation.message}`);
		if (violation.expected) {
			console.error(`    Expected: ${violation.expected}`);
		}
	}
}

function renderHumanOutput(output: CheckAuthzOutput): void {
	if (output.passed) {
		renderPassedOutput(output);
		return;
	}
	renderFailedOutput(output);
}

function renderOutput(output: CheckAuthzOutput, json?: boolean): void {
	if (json) {
		console.info(JSON.stringify(output, null, 2));
		return;
	}
	renderHumanOutput(output);
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export async function runCheckAuthzCLI(
	options: CheckAuthzOptions,
): Promise<number> {
	const result = await runCheckAuthz(options);

	if (!result.ok) {
		reportContractError(result.error, options.json);
		return EXIT_CODES.CONTRACT_ERROR;
	}

	const { output } = result;
	renderOutput(output, options.json);

	return output.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_VIOLATION;
}
