import { inspectFlagValue } from "../lib/cli/parse-utils.js";
import { validateHarnessArtifactRoutine } from "../lib/harness-artifact-routine.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/**
 * Parse CLI flags for the harness artifact routine, run the validation, and emit formatted output.
 *
 * Parses `--json`, `--active-index`, `--repo-root`, and `--today` from `args`, validates required
 * flag values, invokes `validateHarnessArtifactRoutine` with the constructed options, and prints
 * results either as JSON or human-readable pass/fail output.
 *
 * @param args - The command-line arguments to process (e.g., `process.argv.slice(2)`).
 * @returns Exit code: `0` for pass, `1` for fail, `2` for a usage/flag-value error.
 */
export function runArtifactRoutineCLI(args: string[]): number {
	const json = args.includes("--json");
	const activeIndexFlag = inspectFlagValue(args, "--active-index");
	const assuranceMatrixFlag = inspectFlagValue(args, "--assurance-matrix");
	const repoRootFlag = inspectFlagValue(args, "--repo-root");
	const todayFlag = inspectFlagValue(args, "--today");
	const missingFlag = [
		{ flag: "--active-index", inspection: activeIndexFlag },
		{ flag: "--assurance-matrix", inspection: assuranceMatrixFlag },
		{ flag: "--repo-root", inspection: repoRootFlag },
		{ flag: "--today", inspection: todayFlag },
	].find(({ inspection }) => inspection.missingValue);

	if (missingFlag) {
		return emitUsage(
			json,
			`harness artifact-routine requires a value after ${missingFlag.flag}.`,
		);
	}

	const options: Parameters<typeof validateHarnessArtifactRoutine>[0] = {};
	if (activeIndexFlag.value !== undefined) {
		options.activeIndexPath = activeIndexFlag.value;
	}
	if (assuranceMatrixFlag.value !== undefined) {
		options.assuranceMatrixPath = assuranceMatrixFlag.value;
	}
	if (repoRootFlag.value !== undefined) {
		options.repoRoot = repoRootFlag.value;
	}
	if (todayFlag.value !== undefined) {
		options.today = todayFlag.value;
	}

	const result = validateHarnessArtifactRoutine(options);

	if (json) {
		console.info(JSON.stringify(result, null, 2));
	} else if (result.status === "pass") {
		console.info("artifact-routine: pass");
	} else {
		console.error("artifact-routine: fail");
		for (const finding of result.findings) {
			console.error(`- ${finding.check}/${finding.code}: ${finding.message}`);
		}
	}

	return result.status === "pass" ? EXIT_CODES.SUCCESS : EXIT_CODES.FAILURE;
}

/**
 * Emit a usage/flag-value error either as a structured JSON payload or as plain-text.
 *
 * @param json - If `true`, output a versioned JSON error object to stdout; otherwise output a plain `Error: ...` line to stderr.
 * @param message - Human-readable error message describing the missing flag value.
 * @returns The usage exit code (`EXIT_CODES.USAGE`).
 */
function emitUsage(json: boolean, message: string): number {
	if (json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "artifact-handling-routine/v1",
					status: "error",
					error: {
						code: "artifact-routine.flag_value_required",
						message,
					},
				},
				null,
				2,
			),
		);
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}
