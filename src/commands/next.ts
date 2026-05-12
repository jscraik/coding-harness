import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import {
	type HarnessDecision,
	validateHarnessDecision,
} from "../lib/decision/harness-decision.js";
import {
	type DecisionSource,
	collectSourceErrors,
	findBlockingSource,
} from "../lib/decision/sources.js";
import {
	decisionMeta,
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
}

interface ParsedNextArgs {
	json: boolean;
	mode: HarnessNextMode;
	files?: string[];
	error?:
		| "invalid_mode"
		| "mode_missing"
		| "files_missing"
		| "files_empty"
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
 * Determine the next recommended Harness command or produce a blocked/action-required/pass decision
 * based on the provided options, available decision sources, and changed-files state.
 *
 * The function validates `mode`, consults `decisionSources` (including optional network sources),
 * respects a `files` override when provided, handles a CI-specific upgrade-matrix artifact shortcut,
 * and falls back to inspecting git for changed files when no override is present.
 *
 * @param options - Configuration for decision production:
 *   - `mode`: execution posture (`"local" | "pr" | "ci"`); defaults to `"local"`.
 *   - `files`: optional override list of changed file paths; when provided, git is not inspected.
 *   - `repoRoot`: optional repository root for git inspection and artifact checks; defaults to cwd.
 *   - `inspectChangedFiles`: optional hook to obtain changed files (used instead of git inspection).
 *   - `decisionSources`: optional additional DecisionSource entries to consider for blocking conditions.
 * @returns A `HarnessDecision` describing the next action: a recommended command (`nextCommand`) when
 *   a safe recommendation can be made, or a blocked/action_required decision explaining required remediation.
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

	if (filesFromOverride && (options.files ?? []).length === 0) {
		return blockedDecision({
			summary: "--files did not include any paths.",
			nextAction:
				"Pass one or more changed files, or omit --files so harness next can inspect git state.",
			failureClass: "files_override_empty",
			evidenceRef: ["input:files"],
			meta: decisionMeta({
				mode,
				filesSource: "override",
				frictionClass: "unclear_instruction",
				delayClass: "human_needed",
				startupCost: "none",
				requiresHuman: true,
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
		return noChangedFilesDecision({ mode, filesSource, sourceErrors });
	}

	return changedFilesDecision({ mode, files, filesSource, sourceErrors });
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

	return { json, mode, ...(files !== undefined ? { files } : {}) };
}

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

/** CLI adapter for `harness next`. */
export function runNextCLI(
	args: string[],
	options: Omit<HarnessNextOptions, "mode" | "files"> = {},
): number {
	const parsed = parseNextArgs(args);
	let decision: HarnessDecision;
	let usageError = false;

	if (parsed.error === "invalid_mode") {
		usageError = true;
		decision = invalidModeDecision(parsed.errorValue ?? "unknown");
	} else if (parsed.error === "mode_missing") {
		usageError = true;
		decision = blockedDecision({
			summary: "--mode requires a value.",
			nextAction: "Use --mode local, --mode pr, or --mode ci.",
			failureClass: "mode_missing",
			meta: decisionMeta({
				mode: parsed.mode,
				frictionClass: "unclear_instruction",
				delayClass: "human_needed",
				startupCost: "none",
				requiresHuman: true,
			}),
		});
	} else if (parsed.error === "files_missing") {
		usageError = true;
		decision = blockedDecision({
			summary: "--files requires a comma-separated path list.",
			nextAction: "Pass one or more changed files, or omit --files.",
			failureClass: "files_missing",
			evidenceRef: ["input:files"],
			meta: decisionMeta({
				mode: parsed.mode,
				filesSource: "override",
				frictionClass: "unclear_instruction",
				delayClass: "human_needed",
				startupCost: "none",
				requiresHuman: true,
			}),
		});
	} else if (parsed.error === "files_empty") {
		usageError = true;
		decision = runHarnessNext({
			...options,
			mode: parsed.mode,
			files: [],
		});
	} else if (parsed.error === "unknown_argument") {
		usageError = true;
		decision = blockedDecision({
			summary: `Unknown next argument: ${parsed.errorValue}.`,
			nextAction:
				"Use harness next --json with optional --files and --mode flags.",
			failureClass: "unknown_argument",
			meta: decisionMeta({
				mode: parsed.mode,
				frictionClass: "unclear_instruction",
				delayClass: "human_needed",
				startupCost: "none",
				requiresHuman: true,
				extra: { argument: parsed.errorValue },
			}),
		});
	} else {
		decision = runHarnessNext({
			...options,
			mode: parsed.mode,
			...(parsed.files !== undefined ? { files: parsed.files } : {}),
		});
	}

	const validation = validateHarnessDecision(decision);
	if (!validation.valid) {
		console.error(`Invalid HarnessDecision: ${validation.errors.join("; ")}`);
		return 1;
	}
	printDecision(decision, parsed.json);
	return decisionExitCode(decision, usageError);
}
