import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import {
	type HarnessDecision,
	validateHarnessDecision,
} from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import {
	type DecisionSource,
	collectSourceErrors,
	findBlockingSource,
} from "../lib/decision/sources.js";
import {
	runtimeCardBlocksContinuation,
	type RuntimeCard,
} from "../lib/runtime/runtime-card.js";
import { loadPhaseExitArtifact } from "./next-phase-exit.js";
import { loadRuntimeCardArtifact } from "./next-runtime-card.js";
import {
	humanRequiredDecisionMeta,
	optionalNetworkSources,
	parseGitStatusShort,
	sourceMetaExtra,
} from "./next-support.js";
import {
	blockedDecision,
	changedFilesDecision,
	fleetMatrixArtifactDecision,
	gitInspectionBlockedDecision,
	invalidModeDecision,
	noChangedFilesDecision,
	phaseExitBlockedDecision,
	runtimeCardBlockedDecision,
	sourceBlockedDecision,
	type HarnessNextMode,
} from "./next-decisions.js";

export type { HarnessNextMode } from "./next-decisions.js";

/** Options for the read-only `harness next` decision producer. */
export interface HarnessNextOptions {
	/** Optional context posture. Defaults to `local`. */
	mode?: HarnessNextMode;
	/** Optional changed-file override; when omitted, git state is inspected. */
	files?: string[];
	/** Repository root for git inspection. Defaults to the current directory. */
	repoRoot?: string;
	/** Test hook or alternate changed-file provider. */
	inspectChangedFiles?: (repoRoot: string) => string[];
	/** Test hook or future normalized source provider. */
	decisionSources?: DecisionSource[];
	/** Optional HE phase-exit evidence already collected by the caller. */
	phaseExit?: HePhaseExit;
	/** Optional runtime-card evidence already collected by the caller. */
	runtimeCard?: RuntimeCard;
}

interface ParsedNextArgs {
	json: boolean;
	mode: HarnessNextMode;
	files?: string[];
	phaseExitPath?: string;
	runtimeCardPath?: string;
	error?:
		| "invalid_mode"
		| "mode_missing"
		| "files_missing"
		| "files_empty"
		| "phase_exit_missing"
		| "runtime_card_missing"
		| "unknown_argument";
	errorValue?: string;
}

const VALID_MODES: readonly HarnessNextMode[] = ["local", "pr", "ci"];
const DEFAULT_FLEET_MATRIX_ARTIFACT =
	"artifacts/harness-upgrade-matrix-dev.json";

/**
 * Determine whether a string is a valid HarnessNextMode.
 *
 * @param value - The string to test
 * @returns `true` if `value` is one of `"local"`, `"pr"`, or `"ci"`, `false` otherwise.
 */
function isHarnessNextMode(value: string): value is HarnessNextMode {
	return VALID_MODES.includes(value as HarnessNextMode);
}

function splitFiles(raw: string): string[] {
	const entries = raw
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	if (
		entries.length === 2 &&
		entries[0]?.includes("/") &&
		/^[^/]+\.[^/]+$/.test(entries[1] ?? "")
	) {
		return [raw.trim()];
	}
	return entries;
}

export { parseGitStatusShort } from "./next-support.js";

function inspectGitChangedFiles(repoRoot: string): string[] {
	const output = execFileSync(
		"git",
		["status", "--short", "--untracked-files=all"],
		{
			cwd: repoRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10_000,
		},
	);
	return parseGitStatusShort(output);
}

/**
 * Produce a HarnessDecision recommending the next Harness command or explaining why no safe action can be taken.
 *
 * @param options - Configuration for decision production:
 *   - `mode`: execution posture (`"local" | "pr" | "ci"`); defaults to `"local"`.
 *   - `files`: optional override list of changed file paths; when provided, git is not inspected.
 *   - `repoRoot`: optional repository root for git inspection and artifact checks; defaults to the current working directory.
 *   - `inspectChangedFiles`: optional hook to obtain changed files (used instead of git inspection).
 *   - `decisionSources`: optional additional DecisionSource entries to consider for blocking conditions.
 *   - `phaseExit`: optional pre-collected HE phase-exit evidence that can prevent commit/exit actions.
 * @returns A `HarnessDecision` describing the next action; when actionable the decision includes a recommended `nextCommand`, otherwise it explains blocking or required remediation.
 */
export function runHarnessNext(
	options: HarnessNextOptions = {},
): HarnessDecision {
	const repoRoot = options.repoRoot ?? cwd();
	const mode = options.mode ?? "local";
	const filesFromOverride = options.files !== undefined;

	if (!isHarnessNextMode(mode)) {
		return invalidModeDecision(String(mode));
	}

	const allSources = [
		...(options.decisionSources ?? []),
		...optionalNetworkSources(mode),
	];
	const sourceErrors = collectSourceErrors(allSources);
	const blockingSource = findBlockingSource(sourceErrors);
	if (blockingSource) {
		return sourceBlockedDecision({
			mode,
			source: blockingSource,
			sourceErrors,
		});
	}

	if (
		options.phaseExit &&
		(!options.phaseExit.commitAllowed || !options.phaseExit.exitAllowed)
	) {
		return phaseExitBlockedDecision({
			mode,
			phaseExit: options.phaseExit,
			sourceErrors,
		});
	}

	if (
		options.runtimeCard &&
		runtimeCardBlocksContinuation(options.runtimeCard)
	) {
		return runtimeCardBlockedDecision({
			mode,
			runtimeCard: options.runtimeCard,
			sourceErrors,
		});
	}

	if (filesFromOverride && (options.files ?? []).length === 0) {
		return blockedDecision({
			summary: "--files did not include any paths.",
			nextAction:
				"Pass one or more changed files, or omit --files so harness next can inspect git state.",
			failureClass: "files_override_empty",
			evidenceRef: ["input:files"],
			meta: humanRequiredDecisionMeta({
				mode,
				filesSource: "override",
				frictionClass: "unclear_instruction",
				extra: sourceMetaExtra(sourceErrors),
			}),
		});
	}

	if (
		!filesFromOverride &&
		mode === "ci" &&
		existsSync(join(repoRoot, DEFAULT_FLEET_MATRIX_ARTIFACT))
	) {
		return fleetMatrixArtifactDecision({
			mode,
			matrixArtifact: DEFAULT_FLEET_MATRIX_ARTIFACT,
			...(options.phaseExit ? { phaseExit: options.phaseExit } : {}),
			...(options.runtimeCard ? { runtimeCard: options.runtimeCard } : {}),
		});
	}

	let files: string[];
	let filesSource: "override" | "git";
	try {
		if (filesFromOverride) {
			files = [...(options.files ?? [])].sort();
			filesSource = "override";
		} else {
			files = (options.inspectChangedFiles ?? inspectGitChangedFiles)(repoRoot);
			filesSource = "git";
		}
	} catch {
		return gitInspectionBlockedDecision(mode);
	}

	if (files.length === 0) {
		return noChangedFilesDecision({
			mode,
			filesSource,
			sourceErrors,
			...(options.phaseExit ? { phaseExit: options.phaseExit } : {}),
			...(options.runtimeCard ? { runtimeCard: options.runtimeCard } : {}),
		});
	}

	return changedFilesDecision({
		mode,
		files,
		filesSource,
		sourceErrors,
		...(options.phaseExit ? { phaseExit: options.phaseExit } : {}),
		...(options.runtimeCard ? { runtimeCard: options.runtimeCard } : {}),
	});
}

/**
 * Parse CLI-style arguments for the `harness next` command.
 *
 * @param args - Array of command-line tokens (e.g., process.argv.slice(2))
 * @returns An object with:
 *  - `json`: whether `--json` was present,
 *  - `mode`: the selected `HarnessNextMode` (defaults to `"local"`),
 *  - `files` (optional): parsed file paths from `--files` when provided,
 *  - or an `error` discriminator when parsing fails (`"mode_missing"`, `"invalid_mode"`, `"files_missing"`, `"files_empty"`, or `"unknown_argument"`). When `error` is `"invalid_mode"` or `"unknown_argument"`, `errorValue` contains the offending token.
 */
function parseNextArgs(args: string[]): ParsedNextArgs {
	let json = args.includes("--json");
	let mode: HarnessNextMode = "local";
	let files: string[] | undefined;
	let phaseExitPath: string | undefined;
	let runtimeCardPath: string | undefined;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === undefined) continue;
		if (arg === "--json") {
			json = true;
			continue;
		}
		if (arg === "--mode") {
			const value = args[index + 1];
			if (!value || value.startsWith("-")) {
				return { json, mode, error: "mode_missing" };
			}
			if (!isHarnessNextMode(value)) {
				return {
					json,
					mode,
					error: "invalid_mode",
					errorValue: value,
				};
			}
			mode = value;
			index += 1;
			continue;
		}
		if (arg === "--files") {
			const values: string[] = [];
			let valueIndex = index + 1;
			while (valueIndex < args.length) {
				const value = args[valueIndex];
				if (value === undefined || value.startsWith("-")) break;
				values.push(...splitFiles(value));
				valueIndex += 1;
			}
			if (values.length === 0 && valueIndex === index + 1) {
				return { json, mode, error: "files_missing" };
			}
			if (values.length === 0) {
				return { json, mode, files: [], error: "files_empty" };
			}
			files = values;
			index = valueIndex - 1;
			continue;
		}
		if (arg === "--phase-exit") {
			const value = args[index + 1];
			if (!value || value.startsWith("-")) {
				return { json, mode, error: "phase_exit_missing" };
			}
			phaseExitPath = value;
			index += 1;
			continue;
		}
		if (arg === "--runtime-card") {
			const value = args[index + 1];
			if (!value || value.startsWith("-")) {
				return { json, mode, error: "runtime_card_missing" };
			}
			runtimeCardPath = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("-")) {
			return {
				json,
				mode,
				error: "unknown_argument",
				errorValue: arg,
			};
		}
		return {
			json,
			mode,
			error: "unknown_argument",
			errorValue: arg,
		};
	}

	return {
		json,
		mode,
		...(files !== undefined ? { files } : {}),
		...(phaseExitPath !== undefined ? { phaseExitPath } : {}),
		...(runtimeCardPath !== undefined ? { runtimeCardPath } : {}),
	};
}

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

function usageErrorDecision(
	parsed: ParsedNextArgs,
	options: Omit<HarnessNextOptions, "mode" | "files">,
): HarnessDecision | undefined {
	switch (parsed.error) {
		case "invalid_mode":
			return invalidModeDecision(parsed.errorValue ?? "unknown");
		case "mode_missing":
			return blockedDecision({
				summary: "--mode requires a value.",
				nextAction: "Use --mode local, --mode pr, or --mode ci.",
				failureClass: "mode_missing",
				meta: humanRequiredDecisionMeta({
					mode: parsed.mode,
					frictionClass: "unclear_instruction",
				}),
			});
		case "files_missing":
			return blockedDecision({
				summary: "--files requires a comma-separated path list.",
				nextAction: "Pass one or more changed files, or omit --files.",
				failureClass: "files_missing",
				evidenceRef: ["input:files"],
				meta: humanRequiredDecisionMeta({
					mode: parsed.mode,
					filesSource: "override",
					frictionClass: "unclear_instruction",
				}),
			});
		case "files_empty":
			return runHarnessNext({
				...options,
				mode: parsed.mode,
				files: [],
			});
		case "phase_exit_missing":
			return blockedDecision({
				summary: "--phase-exit requires a JSON artifact path.",
				nextAction:
					"Pass a HePhaseExit/v1 artifact path, or omit --phase-exit.",
				failureClass: "phase_exit_missing",
				evidenceRef: ["input:phase-exit"],
				meta: humanRequiredDecisionMeta({
					mode: parsed.mode,
					frictionClass: "unclear_instruction",
				}),
			});
		case "runtime_card_missing":
			return blockedDecision({
				summary: "--runtime-card requires a JSON artifact path.",
				nextAction:
					"Pass a runtime-card/v1 artifact path, or omit --runtime-card.",
				failureClass: "runtime_card_missing",
				evidenceRef: ["input:runtime-card"],
				meta: humanRequiredDecisionMeta({
					mode: parsed.mode,
					frictionClass: "unclear_instruction",
				}),
			});
		case "unknown_argument":
			return blockedDecision({
				summary: `Unknown next argument: ${parsed.errorValue}.`,
				nextAction:
					"Use harness next --json with optional --files, --phase-exit, --runtime-card, and --mode flags.",
				failureClass: "unknown_argument",
				meta: humanRequiredDecisionMeta({
					mode: parsed.mode,
					frictionClass: "unclear_instruction",
					extra: { argument: parsed.errorValue },
				}),
			});
		default:
			return undefined;
	}
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
		decision = usageErrorDecision(parsed, options);
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
