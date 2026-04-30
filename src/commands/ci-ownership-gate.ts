import { runCIOwnershipGate } from "../lib/ci/ownership-gate.js";

interface CIOwnershipGateCliOptions {
	repoRoot?: string | undefined;
	contractPath?: string | undefined;
	json?: boolean | undefined;
}

/**
 * Run the CI ownership gate and write the results to the console.
 *
 * @param options - Optional CLI settings. `repoRoot` and `contractPath` specify paths to inspect; `json` forces printing the full result as JSON.
 * @returns Process exit code: `1` if one or more errors were found, `0` otherwise.
 */
export function runCIOwnershipGateCLI(
	options: CIOwnershipGateCliOptions = {},
): number {
	const result = runCIOwnershipGate({
		repoRoot: options.repoRoot,
		contractPath: options.contractPath,
	});

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		console.info(`ci-ownership-gate: ${result.status}`);
		for (const finding of result.findings) {
			const output = `  - [${finding.severity}] ${finding.message}`;
			if (finding.severity === "error") console.error(output);
			else console.info(output);
		}
	}

	return result.summary.errors > 0 ? 1 : 0;
}
