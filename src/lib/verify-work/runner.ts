import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { join, resolve } from "node:path";
import { sanitizeError } from "../input/sanitize.js";
import { buildVerifyWorkArgs } from "./args.js";
import { EXIT_CODES, type VerifyWorkCliOptions } from "./types.js";

function buildVerifyWorkWrapperEnv(
	environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	return {
		...Object.fromEntries(
			Object.entries(environment).filter(([key]) => !key.startsWith("GIT_")),
		),
		HARNESS_VERIFY_WORK_NO_DELEGATE: "1",
	};
}

/** Runtime adapter for invoking the repository-local verify-work wrapper. */
export const verifyWorkRuntime = {
	executeVerifyWorkWrapper(
		scriptPath: string,
		commandArgs: string[],
		repoRoot: string,
	) {
		return spawnSync("bash", [scriptPath, ...commandArgs], {
			cwd: repoRoot,
			stdio: "inherit",
			env: buildVerifyWorkWrapperEnv(),
		});
	},
};

/**
 * Execute the repository's verify-work wrapper script with the given CLI options.
 *
 * Spawns the repository scripts/verify-work.sh wrapper with flags derived from
 * options. The child process runs with inherited stdio, cwd set to the
 * repository root, and HARNESS_VERIFY_WORK_NO_DELEGATE enabled.
 */
export function runVerifyWork(options: VerifyWorkCliOptions): number {
	if (options.all && options.changedOnly) {
		console.error("Error: --all and --changed-only are mutually exclusive");
		return EXIT_CODES.USAGE_ERROR;
	}
	if (options.projectGovernance && options.workspaceGovernance) {
		console.error(
			"Error: --project-governance and --workspace-governance are mutually exclusive",
		);
		return EXIT_CODES.USAGE_ERROR;
	}

	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const scriptPath = join(repoRoot, "scripts/verify-work.sh");
	if (!existsSync(scriptPath)) {
		console.error(
			`Error: verify-work wrapper not found at ${scriptPath}. Run from a harness-managed repository root or pass --repo-root.`,
		);
		return EXIT_CODES.PRECONDITION_FAILED;
	}

	const commandArgs = buildVerifyWorkArgs(options);
	const result = verifyWorkRuntime.executeVerifyWorkWrapper(
		scriptPath,
		commandArgs,
		repoRoot,
	);

	if (result.error) {
		console.error(
			`Error: failed to run verify-work wrapper: ${sanitizeError(result.error)}`,
		);
		return EXIT_CODES.FAILED;
	}

	if (result.signal) {
		console.error(`verify-work terminated by signal: ${result.signal}`);
		const signalNumber =
			osConstants.signals[result.signal as keyof typeof osConstants.signals];
		if (typeof signalNumber === "number") {
			return EXIT_CODES.SIGNAL_TERMINATED + signalNumber;
		}
		console.error(`Error: failed to map signal exit code for ${result.signal}`);
		return EXIT_CODES.SIGNAL_TERMINATED;
	}

	return result.status ?? EXIT_CODES.FAILED;
}
