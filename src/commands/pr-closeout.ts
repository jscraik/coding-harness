import { sanitizeError } from "../lib/input/sanitize.js";
import { buildPrCloseoutReport } from "../lib/pr-closeout.js";
import { parseArgs } from "./pr-closeout-args.js";
import { defaultRunner, type CommandRunner } from "./pr-closeout-env.js";
import { loadCloseoutGates, loadInput } from "./pr-closeout-input.js";
import { buildLiveInput } from "./pr-closeout-live-input.js";

/**
 * Execute the read-only PR closeout CLI flow: parse CLI arguments, assemble input (optionally loading closeout gates), build the closeout report, and write either a JSON or human-readable summary to stdout/stderr.
 *
 * @param args - Raw CLI arguments (as received from the command line)
 * @param options - Optional runtime options
 * @param options.runner - Optional command runner used when building live input
 * @returns `0` on success, `1` on failure
 */
export async function runPrCloseoutCLI(
	args: readonly string[],
	options: { runner?: CommandRunner } = {},
): Promise<number> {
	const parsed = parseArgs(args);
	if ("exitCode" in parsed) return parsed.exitCode;
	try {
		const input = parsed.options.inputPath
			? loadInput(parsed.options.inputPath)
			: buildLiveInput(parsed.options, options.runner ?? defaultRunner);
		const closeoutGatesPath =
			parsed.options.closeoutGatesPath ?? parsed.options.phaseExitPath;
		if (
			closeoutGatesPath &&
			("closeoutGates" in input || "phaseExit" in input)
		) {
			throw new Error(
				"Closeout evidence must come from either --input or --gates/--phase-exit, not both",
			);
		}
		const inputWithCloseoutGates = closeoutGatesPath
			? {
					...input,
					closeoutGates: loadCloseoutGates(
						closeoutGatesPath,
						parsed.options.repoRoot,
					),
				}
			: input;
		const report = buildPrCloseoutReport(inputWithCloseoutGates);
		if (parsed.options.json) {
			console.info(JSON.stringify(report, null, 2));
		} else {
			console.info(
				`PR #${String(report.pr)}: ${report.status} -> ${report.nextAction}`,
			);
			for (const blocker of report.blockers) {
				console.info(`- ${blocker.surface}: ${blocker.reason}`);
			}
		}
		return 0;
	} catch (error) {
		if (parsed.options.json) {
			console.info(
				JSON.stringify(
					{
						schemaVersion: "pr-closeout-error/v1",
						status: "fail",
						error: sanitizeError(error),
					},
					null,
					2,
				),
			);
		} else {
			console.error(`pr-closeout: ${sanitizeError(error)}`);
		}
		return 1;
	}
}
