import { cwd } from "node:process";
import {
	type HarnessDecision,
	validateHarnessDecision,
} from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import { parseNextArgs } from "./next-args.js";
import { loadPhaseExitArtifact } from "./next-phase-exit.js";
import { loadRuntimeCardArtifact } from "./next-runtime-card.js";
import { usageErrorDecision } from "./next-usage-errors.js";
import { type HarnessNextOptions, runHarnessNext } from "./next-runner.js";

export type { HarnessNextMode } from "./next-decisions.js";
export type { HarnessNextOptions } from "./next-runner.js";
export { runHarnessNext } from "./next-runner.js";

export { parseGitStatusShort } from "./next-support.js";

/**
 * Determine the process exit code for the given HarnessDecision and usage-error flag.
 *
 * @param decision - The decision whose status is used to determine the exit code
 * @param usageError - When true, indicates a CLI usage or argument error (overrides decision)
 * @returns `2` when `usageError` is true, `1` when `decision.status` is `"blocked"` or `"fail"`, `0` otherwise
 */
function decisionExitCode(
	decision: HarnessDecision,
	usageError = false,
): number {
	if (usageError) return 2;
	return decision.status === "blocked" || decision.status === "fail" ? 1 : 0;
}

function printDecision(decision: HarnessDecision, json: boolean): void {
	if (json) {
		console.info(JSON.stringify(decision, null, 2));
		return;
	}
	console.info(decision.summary);
	console.info(`Next action: ${decision.nextAction}`);
	if (decision.nextCommand)
		console.info(`Next command: ${decision.nextCommand}`);
}

/**
 * Parse CLI arguments for `harness next`, produce and print a HarnessDecision, and return an appropriate process exit code.
 *
 * @param args - Command-line tokens passed to the CLI (e.g., process.argv.slice(2))
 * @param options - Runner options forwarded to `runHarnessNext` (omitting `mode` and `files`)
 * @returns `0` on success, `1` on failure (including invalid decision or runtime errors), `2` for usage errors (invalid CLI usage)
 */
export function runNextCLI(
	args: string[],
	options: Omit<HarnessNextOptions, "mode" | "files"> = {},
): number {
	const parsed = parseNextArgs(args);
	let decision: HarnessDecision | undefined;
	let usageError = false;

	if (parsed.error !== undefined) {
		usageError = true;
		decision = usageErrorDecision(parsed, options, runHarnessNext);
	} else {
		let phaseExit: HePhaseExit | undefined;
		let runtimeCard: RuntimeCard | undefined;
		if (parsed.phaseExitPath !== undefined) {
			const loadedPhaseExit = loadPhaseExitArtifact(
				options.repoRoot ?? cwd(),
				parsed.phaseExitPath,
				parsed.mode,
			);
			if ("decision" in loadedPhaseExit) {
				decision = loadedPhaseExit.decision;
			} else {
				phaseExit = loadedPhaseExit.phaseExit;
			}
		}
		if (decision === undefined && parsed.runtimeCardPath !== undefined) {
			const loadedRuntimeCard = loadRuntimeCardArtifact(
				options.repoRoot ?? cwd(),
				parsed.runtimeCardPath,
				parsed.mode,
			);
			if ("decision" in loadedRuntimeCard) {
				decision = loadedRuntimeCard.decision;
			} else {
				runtimeCard = loadedRuntimeCard.runtimeCard;
			}
		}
		decision ??= runHarnessNext({
			...options,
			mode: parsed.mode,
			...(parsed.worktreeRole !== undefined
				? { worktreeRole: parsed.worktreeRole }
				: {}),
			...(parsed.evidenceMode !== undefined
				? { evidenceMode: parsed.evidenceMode }
				: {}),
			...(parsed.files !== undefined ? { files: parsed.files } : {}),
			...(phaseExit !== undefined ? { phaseExit } : {}),
			...(runtimeCard !== undefined ? { runtimeCard } : {}),
		});
	}

	if (decision === undefined) {
		console.error("Invalid harness next state: no decision was produced.");
		return 1;
	}

	const validation = validateHarnessDecision(decision);
	if (!validation.valid) {
		console.error(`Invalid HarnessDecision: ${validation.errors.join("; ")}`);
		return 1;
	}
	printDecision(decision, parsed.json);
	return decisionExitCode(decision, usageError);
}
