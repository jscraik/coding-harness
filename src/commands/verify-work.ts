import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { constants as osConstants } from "node:os";
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
 * Create the argument list for the verify-work wrapper according to the provided options.
 *
 * This helper only maps option values to wrapper flags. Mutual-exclusion validation for
 * `--all` and `--changed-only` is enforced by `runVerifyWorkCLI` before this helper is used.
 * If `repoRoot` is provided, it is resolved and forwarded as
 * `--repo-root <resolved absolute path>`.
 *
 * @param options - CLI options used to build wrapper arguments:
 *  - `all`: include `--all`
 *  - `changedOnly`: include `--changed-only`
 *  - `strict`: include `--strict`
 *  - `fast`: include `--fast`
 *  - `resumeFrom`: include `--resume-from <gateId>`
 *  - `json`: include `--json`
 *  - `repoRoot`: include `--repo-root <resolved path>`
 * @returns An array of command-line arguments for the verify-work script
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
 * Execute the repository's verify-work wrapper script with the given CLI options.
 *
 * Spawns `bash <repoRoot>/scripts/verify-work.sh` with flags derived from `options`, using `repoRoot` from `options.repoRoot` or the current working directory. The child process runs with inherited stdio, `cwd` set to the repository root, and the environment extended with `HARNESS_VERIFY_WORK_NO_DELEGATE=1`.
 *
 * @param options - Wrapper/CLI options. `all` and `changedOnly` are mutually exclusive (the command returns `USAGE_ERROR` when both are set). `repoRoot`, when provided, is resolved and forwarded as `--repo-root <resolved path>`.
 * @returns The chosen exit code: `EXIT_CODES.SUCCESS` for successful execution; `EXIT_CODES.PRECONDITION_FAILED` if the wrapper script is not found; `EXIT_CODES.FAILED` on execution error; `EXIT_CODES.SIGNAL_TERMINATED + N` when the child was terminated by a named signal that maps through `os.constants.signals`; `EXIT_CODES.SIGNAL_TERMINATED` when the signal cannot be mapped; or the child process' numeric exit status when available.
 */
export function runVerifyWorkCLI(options: VerifyWorkCliOptions): number {
	if (options.all && options.changedOnly) {
		console.error("Error: --all and --changed-only are mutually exclusive");
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
