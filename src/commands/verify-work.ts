import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { sanitizeError } from "../lib/input/sanitize.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	FAILED: 1,
	USAGE_ERROR: 2,
	PRECONDITION_FAILED: 3,
	SIGNAL_TERMINATED: 128,
} as const;

export interface VerifyWorkCliOptions {
	all?: boolean;
	changedOnly?: boolean;
	strict?: boolean;
	fast?: boolean;
	resumeFrom?: string;
	json?: boolean;
	repoRoot?: string;
}

/**
 * Builds command-line arguments for the verify-work wrapper based on provided options.
 *
 * The resulting array contains the appropriate flags for the wrapper script:
 * - `--all` or `--changed-only` (mutually exclusive; `--all` takes precedence)
 * - `--strict`, `--fast`
 * - `--resume-from <value>`
 * - `--json`
 * - `--repo-root <resolved path>`
 *
 * @param options - Options that control which flags are included
 * @returns Array of command-line arguments ready to be passed to the verify-work script
 */
function buildVerifyWorkArgs(options: VerifyWorkCliOptions): string[] {
	const args: string[] = [];
	if (options.all) {
		args.push("--all");
	} else if (options.changedOnly) {
		args.push("--changed-only");
	}
	if (options.strict) {
		args.push("--strict");
	}
	if (options.fast) {
		args.push("--fast");
	}
	if (options.resumeFrom) {
		args.push("--resume-from", options.resumeFrom);
	}
	if (options.json) {
		args.push("--json");
	}
	if (options.repoRoot) {
		args.push("--repo-root", resolve(options.repoRoot));
	}
	return args;
}

/**
 * Run the repository's verify-work wrapper script using the provided CLI options.
 *
 * @param options - Options that control which flags are passed to the wrapper and optionally where to find the repository root.
 * @returns The process exit code: `EXIT_CODES.SUCCESS` on success, `EXIT_CODES.PRECONDITION_FAILED` if the wrapper is missing, `EXIT_CODES.FAILED` on execution error, `EXIT_CODES.SIGNAL_TERMINATED + N` when terminated by a signal, or the child process' status code when available.
 */
export function runVerifyWorkCLI(options: VerifyWorkCliOptions): number {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const scriptPath = join(repoRoot, "scripts/verify-work.sh");
	if (!existsSync(scriptPath)) {
		console.error(
			`Error: verify-work wrapper not found at ${scriptPath}. Run from a harness-managed repository root or pass --repo-root.`,
		);
		return EXIT_CODES.PRECONDITION_FAILED;
	}

	const commandArgs = buildVerifyWorkArgs(options);
	const result = spawnSync("bash", [scriptPath, ...commandArgs], {
		cwd: repoRoot,
		stdio: "inherit",
		env: {
			...process.env,
			HARNESS_VERIFY_WORK_NO_DELEGATE: "1",
		},
	});

	if (result.error) {
		console.error(
			`Error: failed to run verify-work wrapper: ${sanitizeError(result.error)}`,
		);
		return EXIT_CODES.FAILED;
	}

	if (result.signal) {
		console.error(`verify-work terminated by signal: ${result.signal}`);
		// Map signal to exit code (128 + signal number convention)
		// For string signals, use base SIGNAL_TERMINATED constant
		const signalNum =
			typeof result.signal === "string"
				? 0
				: (result.signal as unknown as number);
		return EXIT_CODES.SIGNAL_TERMINATED + signalNum;
	}

	return result.status ?? EXIT_CODES.FAILED;
}
