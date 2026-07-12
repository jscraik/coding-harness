import {
	type HarnessDecision,
	validateHarnessDecision,
} from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import { withSynaipseState } from "../lib/synaipse/state.js";
import { parseNextArgs } from "./next-args.js";
import { loadNextCliEvidence } from "./next-cli-evidence.js";
import type { HarnessNextPrCloseoutEvidence } from "./next-pr-closeout.js";
import { usageErrorDecision } from "./next-usage-errors.js";
import { type HarnessNextOptions, runHarnessNext } from "./next-runner.js";

// Architecture seam: next-cli-evidence owns harness-next artifact loading.
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

/** Build the validated decision payload for one CLI invocation. */
function buildNextCliDecision(
	parsed: ReturnType<typeof parseNextArgs>,
	options: Omit<HarnessNextOptions, "mode" | "files">,
): { decision: HarnessDecision | undefined; usageError: boolean } {
	if (parsed.error !== undefined) {
		const usageDecision = usageErrorDecision(parsed, options, runHarnessNext);
		return {
			usageError: true,
			decision:
				usageDecision === undefined
					? undefined
					: withSynaipseState(usageDecision, options.repoRoot ?? process.cwd()),
		};
	}

	let phaseExit: HePhaseExit | undefined;
	let runtimeCard: RuntimeCard | undefined;
	let prCloseout: HarnessNextPrCloseoutEvidence | undefined;
	let decision = loadNextCliEvidence(parsed, options, {
		setPhaseExit: (value) => {
			phaseExit = value;
		},
		setRuntimeCard: (value) => {
			runtimeCard = value;
		},
		setPrCloseout: (value) => {
			prCloseout = value;
		},
	});
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
		...(prCloseout !== undefined ? { prCloseout } : {}),
	});
	return { decision, usageError: false };
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
	const { decision, usageError } = buildNextCliDecision(parsed, options);

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
