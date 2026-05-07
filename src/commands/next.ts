import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import {
	buildHarnessDecision,
	type HarnessDecision,
	type HarnessDecisionDelayClass,
	type HarnessDecisionExecutionProfile,
	type HarnessDecisionFrictionClass,
	type HarnessDecisionInput,
	type HarnessDecisionOperationalMeta,
	type HarnessDecisionStartupCost,
	validateHarnessDecision,
} from "../lib/decision/harness-decision.js";
import { COMMAND_CATALOG_SCHEMA_VERSION } from "../lib/cli/registry/command-capabilities.js";
import {
	type DecisionSource,
	type RecommendationCandidate,
	collectSourceErrors,
	findBlockingSource,
} from "../lib/decision/sources.js";

/** Context posture used by `harness next` when selecting a recommendation. */
export type HarnessNextMode = "local" | "pr" | "ci";

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

function decodeGitQuotedPath(path: string): string {
	if (!path.startsWith('"') || !path.endsWith('"')) return path;
	const bytes: number[] = [];
	for (let index = 1; index < path.length - 1; index += 1) {
		const char = path[index];
		if (char === undefined) break;
		if (char !== "\\") {
			bytes.push(char.codePointAt(0) ?? 0);
			continue;
		}
		const next = path[index + 1];
		if (next === undefined) {
			bytes.push("\\".codePointAt(0) ?? 0);
			continue;
		}
		if (/^[0-7]$/.test(next)) {
			const octal = path.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0];
			if (octal) {
				bytes.push(Number.parseInt(octal, 8));
				index += octal.length;
				continue;
			}
		}
		const escaped: Record<string, string> = {
			"\\": "\\",
			'"': '"',
			n: "\n",
			r: "\r",
			t: "\t",
		};
		bytes.push((escaped[next] ?? next).codePointAt(0) ?? 0);
		index += 1;
	}
	return Buffer.from(bytes).toString("utf8");
}

function parseGitStatusPath(rawPath: string): string | null {
	const renameMarker = " -> ";
	const path = rawPath.includes(renameMarker)
		? rawPath.slice(rawPath.lastIndexOf(renameMarker) + renameMarker.length)
		: rawPath;
	const trimmed = decodeGitQuotedPath(path.trim()).trim();
	return trimmed.length > 0 ? trimmed : null;
}

/** Parse `git status --short` output into sorted changed-file paths. */
export function parseGitStatusShort(output: string): string[] {
	const files = new Set<string>();
	for (const line of output.split(/\r?\n/)) {
		if (line.trim().length === 0) continue;
		const parsed = parseGitStatusPath(line.slice(3));
		if (parsed) files.add(parsed);
	}
	return [...files].sort();
}

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

function inferRiskTier(files: string[]): HarnessDecision["riskTier"] {
	if (files.length === 0) return "low";
	if (
		files.some((file) =>
			/^(src\/|scripts\/|package\.json$|pnpm-lock\.yaml$|harness\.contract\.json$|\.github\/)/.test(
				file,
			),
		)
	) {
		return "medium";
	}
	return "low";
}

function shellQuote(value: string): string {
	if (/^[A-Za-z0-9_./:=@%+,-]+$/.test(value)) return value;
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function fileArgsForCommand(files: string[]): string {
	return files.map((file) => shellQuote(file)).join(" ");
}

function createDecision(decision: HarnessDecisionInput): HarnessDecision {
	return buildHarnessDecision("harness next", decision);
}

/**
 * Build a `HarnessDecision` representing a blocked, read-only state that requires human intervention.
 *
 * @param summary - Short human-readable summary of why the decision is blocked
 * @param nextAction - Instruction describing the next steps an operator should take
 * @param failureClass - Classification of the failure (e.g., `"source_blocked"`, `"git_state_unavailable"`)
 * @param retry - Suggested retry strategy; defaults to `"manual"`
 * @param evidenceRef - References identifying the evidence for this decision; defaults to `["input:argv"]`
 * @param meta - Optional additional metadata to attach to the decision
 * @returns A `HarnessDecision` with `status: "blocked"`, `safeToRun: false`, `requiresHuman: true`, and other standardized read-only fields populated
 */
function blockedDecision(args: {
	summary: string;
	nextAction: string;
	failureClass: string;
	retry?: HarnessDecision["retry"];
	evidenceRef?: string[];
	meta?: Record<string, unknown>;
}): HarnessDecision {
	return createDecision({
		status: "blocked",
		summary: args.summary,
		nextAction: args.nextAction,
		nextCommand: null,
		safeToRun: false,
		requiresHuman: true,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: args.evidenceRef ?? ["input:argv"],
		failureClass: args.failureClass,
		retry: args.retry ?? "manual",
		riskTier: "unknown",
		...(args.meta ? { meta: args.meta } : {}),
	});
}

/**
 * Produce a blocked decision signaling that the provided mode is unsupported.
 *
 * @param mode - The invalid mode value passed by the caller.
 * @returns A HarnessDecision with status `"blocked"` that instructs using `--mode local`, `--mode pr`, or `--mode ci` and classifies the failure as `invalid_mode`.
 */
function invalidModeDecision(mode: string): HarnessDecision {
	return blockedDecision({
		summary: `Unsupported next mode: ${mode}.`,
		nextAction: "Use --mode local, --mode pr, or --mode ci.",
		failureClass: "invalid_mode",
		meta: decisionMeta({
			mode,
			frictionClass: "unclear_instruction",
			delayClass: "human_needed",
			startupCost: "none",
			requiresHuman: true,
		}),
	});
}

/**
 * Create the CLI argument vector and a human-readable shell command for the next harness command based on mode and changed files.
 *
 * @param mode - Harness next mode; selects `review-context` when `"pr"`, otherwise `validation-plan`
 * @param files - Ordered list of file paths to pass to `--files`; used verbatim for `argv` and shell-quoted for `command`
 * @returns An object with `argv` (array of command arguments suitable for programmatic execution) and `command` (single shell-ready string for display)
 */
function chooseNextCommandParts(
	mode: HarnessNextMode,
	files: string[],
): { command: string; argv: string[] } {
	const commandName = mode === "pr" ? "review-context" : "validation-plan";
	const argv = ["harness", commandName, "--files", ...files, "--json"];
	const command = `harness ${commandName} --files ${fileArgsForCommand(files)} --json`;
	return { command, argv };
}

/**
 * Provide additional network decision sources when running in pull-request (`"pr"`) mode.
 *
 * @param mode - The current HarnessNextMode
 * @returns An array containing two blocked network `DecisionSource` entries (`network:github` and `network:linear`) when `mode` is `"pr"`, or an empty array otherwise.
 */
function optionalNetworkSources(mode: HarnessNextMode): DecisionSource[] {
	if (mode !== "pr") return [];
	return [
		{
			kind: "pr",
			ref: "network:github",
			freshness: "unknown",
			sha: null,
			status: "blocked",
			failureClass: "network_unavailable",
		},
		{
			kind: "linear",
			ref: "network:linear",
			freshness: "unknown",
			sha: null,
			status: "blocked",
			failureClass: "network_unavailable",
		},
	];
}

/**
 * Return an object containing a `sourceErrors` property when the input array is non-empty.
 *
 * @param sourceErrors - Decision source errors to include in the returned meta object
 * @returns An object with `sourceErrors` set to a shallow copy of `sourceErrors` when it has entries, otherwise an empty object
 */
function sourceMetaExtra(sourceErrors: readonly DecisionSource[]): {
	sourceErrors?: DecisionSource[];
} {
	return sourceErrors.length > 0 ? { sourceErrors: [...sourceErrors] } : {};
}

/**
 * Build a standardized operational `meta` object for a HarnessDecision from contextual inputs.
 *
 * @returns An object containing `mode`, optional `filesSource`, optional `changedFileCount` and `nextCommandArgv`, defaulted `frictionClass`/`delayClass`, and an `execution` block with `profile`, `startupCost` and a `permissionPlan` describing human/network/filesystem/command/secrets requirements
 */
function decisionMeta(args: {
	mode: string;
	filesSource?: "override" | "git";
	changedFileCount?: number;
	nextCommandArgv?: string[];
	frictionClass?: HarnessDecisionFrictionClass;
	delayClass?: HarnessDecisionDelayClass;
	executionProfile?: HarnessDecisionExecutionProfile;
	startupCost?: HarnessDecisionStartupCost;
	commands?: string[];
	requiresHuman?: boolean;
	requiresNetwork?: boolean;
	writesFiles?: boolean;
	requiresGitWrite?: boolean;
	filesystemWrite?: string[];
	secrets?: string[];
	extra?: Record<string, unknown>;
}): HarnessDecisionOperationalMeta & Record<string, unknown> {
	return {
		mode: args.mode,
		...(args.filesSource ? { filesSource: args.filesSource } : {}),
		...(args.changedFileCount !== undefined
			? { changedFileCount: args.changedFileCount }
			: {}),
		...(args.nextCommandArgv ? { nextCommandArgv: args.nextCommandArgv } : {}),
		...args.extra,
		frictionClass: args.frictionClass ?? "none",
		delayClass: args.delayClass ?? "normal",
		execution: {
			profile: args.executionProfile ?? "read_only",
			startupCost: args.startupCost ?? "low",
			permissionPlan: {
				requiresHuman: args.requiresHuman ?? false,
				requiresNetwork: args.requiresNetwork ?? false,
				writesFiles: args.writesFiles ?? false,
				requiresGitWrite: args.requiresGitWrite ?? false,
				filesystemWrite: args.filesystemWrite ?? [],
				commands: args.commands ?? [],
				secrets: args.secrets ?? [],
			},
		},
	};
}

/**
 * Produce a blocked HarnessDecision when a required decision source is unavailable.
 *
 * @param args - Arguments for constructing the blocked decision
 * @param args.mode - The current harness next mode (`"local" | "pr" | "ci"`)
 * @param args.source - The decision source that is blocked; its `ref` is used as evidence and its `failureClass` (if present) is used for the decision's failure classification
 * @param args.sourceErrors - Additional decision source error records to include in the decision meta
 * @returns A `HarnessDecision` with `status: "blocked"` that describes the blocked source, recommends running `harness doctor --json`, and includes metadata about remediation commands and source errors
 */
function sourceBlockedDecision(args: {
	mode: HarnessNextMode;
	source: DecisionSource;
	sourceErrors: DecisionSource[];
}): HarnessDecision {
	return createDecision({
		status: "blocked",
		summary: `Required decision source is blocked: ${args.source.ref}.`,
		nextAction:
			"Run harness doctor --json, fix the reported source issue, then retry harness next --json.",
		nextCommand: "harness doctor --json",
		phase: "repair",
		objective: "Restore usable decision sources before choosing workflow work.",
		requiredEvidence: [args.source.ref, "harness doctor --json output"],
		stopConditions: [
			`Stop if ${args.source.failureClass ?? "source_blocked"} remains blocked after harness doctor.`,
		],
		humanEscalation: null,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["decision-sources", "source-error-ranking"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [args.source.ref],
		failureClass: args.source.failureClass ?? "source_blocked",
		retry: "manual",
		riskTier: "unknown",
		meta: decisionMeta({
			mode: args.mode,
			frictionClass: "repo_state",
			delayClass: "human_needed",
			commands: ["harness doctor --json"],
			extra: sourceMetaExtra(args.sourceErrors),
		}),
	});
}

/**
 * Create a blocked decision indicating the repository git state could not be inspected.
 *
 * @param mode - The current Harness next mode used to populate decision metadata
 * @returns A `HarnessDecision` with `status: "blocked"` that points to `harness doctor --json` as the next command, includes `evidenceRef: ["git:status"]`, `failureClass: "git_state_unavailable"`, `retry: "manual"`, and meta describing the git files source and diagnostic command
 */
function gitInspectionBlockedDecision(mode: HarnessNextMode): HarnessDecision {
	const gitSourceError: DecisionSource = {
		kind: "git",
		ref: "git:status",
		freshness: "unknown",
		sha: null,
		status: "blocked",
		failureClass: "git_state_unavailable",
	};
	return createDecision({
		status: "blocked",
		summary: "Git state could not be inspected.",
		nextAction:
			"Run harness doctor --json, fix the reported setup issue, then retry harness next --json.",
		nextCommand: "harness doctor --json",
		phase: "repair",
		objective: "Restore git-state visibility before choosing workflow work.",
		requiredEvidence: ["git:status", "harness doctor --json output"],
		stopConditions: [
			"Stop if git_state_unavailable remains after harness doctor.",
		],
		humanEscalation: null,
		followUpCommands: ["harness next --json"],
		hiddenPlumbing: ["git:status", "decision-source-errors"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: ["git:status"],
		failureClass: "git_state_unavailable",
		retry: "manual",
		riskTier: "unknown",
		meta: decisionMeta({
			mode,
			filesSource: "git",
			frictionClass: "repo_state",
			delayClass: "human_needed",
			commands: ["harness doctor --json"],
			extra: sourceMetaExtra([gitSourceError]),
		}),
	});
}

/**
 * Produce a decision recommending conversion of a Harness upgrade matrix artifact into a fleet remediation plan.
 *
 * @param args.mode - The current harness next mode (`"local" | "pr" | "ci"`) used to populate decision metadata.
 * @param args.matrixArtifact - Filesystem path to the detected upgrade matrix artifact.
 * @returns A `HarnessDecision` with `status: "action_required"` that includes a `nextCommand` invoking `harness fleet-plan --from <artifact> --json`, execution metadata, evidence referencing the artifact, and a low risk tier.
 */
function fleetMatrixArtifactDecision(args: {
	mode: HarnessNextMode;
	matrixArtifact: string;
}): HarnessDecision {
	const command = `harness fleet-plan --from ${shellQuote(args.matrixArtifact)} --json`;
	return createDecision({
		status: "action_required",
		summary: "Harness upgrade matrix artifact detected.",
		nextAction:
			"Convert the upgrade matrix into an agent-native fleet remediation plan.",
		nextCommand: command,
		phase: "orient",
		objective:
			"Convert the detected upgrade matrix into a safe remediation plan.",
		requiredEvidence: [`artifact:${args.matrixArtifact}`],
		stopConditions: [
			"Stop if fleet-plan cannot parse the upgrade matrix artifact.",
		],
		humanEscalation: null,
		followUpCommands: [],
		hiddenPlumbing: ["artifact-discovery", "fleet-plan"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [`artifact:${args.matrixArtifact}`],
		failureClass: null,
		retry: "safe",
		riskTier: "low",
		meta: decisionMeta({
			mode: args.mode,
			nextCommandArgv: [
				"harness",
				"fleet-plan",
				"--from",
				args.matrixArtifact,
				"--json",
			],
			commands: [command],
		}),
	});
}

/**
 * Builds a passing HarnessDecision for the case where no changed files were found.
 *
 * @param args - Parameters for constructing the decision.
 * @param args.mode - The operating mode (`"local" | "pr" | "ci"`) used to populate meta.
 * @param args.filesSource - Source of the file list; `"git"` when discovered from git, `"override"` when supplied via CLI/options.
 * @param args.sourceErrors - Collected source errors to include in decision meta when present.
 * @returns A `HarnessDecision` with `status: "pass"` that recommends running `harness check --json`, includes evidence referencing the files source, marks the change count as 0, and contains execution/meta details.
 */
function noChangedFilesDecision(args: {
	mode: HarnessNextMode;
	filesSource: "override" | "git";
	sourceErrors: DecisionSource[];
}): HarnessDecision {
	return createDecision({
		status: "pass",
		summary: "No changed files detected.",
		nextAction: "Run harness check --json to confirm repo readiness.",
		nextCommand: "harness check --json",
		phase: "verify",
		objective:
			"Confirm the repository is ready when no changed files are detected.",
		requiredEvidence: [
			args.filesSource === "git" ? "git:status" : "input:files",
			"harness check --json output",
		],
		stopConditions: ["Stop if harness check reports a blocked or failed gate."],
		humanEscalation: null,
		followUpCommands: [],
		hiddenPlumbing: ["git:status", "check"],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [args.filesSource === "git" ? "git:status" : "input:files"],
		failureClass: null,
		retry: "safe",
		riskTier: "low",
		meta: decisionMeta({
			mode: args.mode,
			filesSource: args.filesSource,
			changedFileCount: 0,
			commands: ["harness check --json"],
			extra: sourceMetaExtra(args.sourceErrors),
		}),
	});
}

interface NextRecommendationCandidate extends RecommendationCandidate {
	argv: string[];
}

/**
 * Builds a recommendation candidate describing the next harness command for the provided changed files.
 *
 * The candidate includes the command string and argv, a human-readable reason (varies by `mode`), evidence source references,
 * a heuristic score, inferred risk tier, and execution permission flags.
 *
 * @param args.mode - Execution posture (`"local"`, `"pr"`, or `"ci"`) that influences the recommended command and reason
 * @param args.files - Sorted list of changed file paths to base the recommendation on
 * @param args.filesSource - Origin of the `files` value: `"git"` when discovered from git status, `"override"` when provided via CLI/override
 * @returns A NextRecommendationCandidate containing `command`, `argv`, `reason`, `sourceRefs`, `score`, `riskTier`, and execution flags (`safeToRun`, `requiresHuman`, `requiresNetwork`, `writesFiles`)
 */
function createRecommendationCandidate(args: {
	mode: HarnessNextMode;
	files: string[];
	filesSource: "override" | "git";
}): NextRecommendationCandidate {
	const nextCommand = chooseNextCommandParts(args.mode, args.files);
	return {
		command: nextCommand.command,
		argv: nextCommand.argv,
		reason:
			args.mode === "pr"
				? "Generate reviewer context for the changed files."
				: "Generate a repo-canonical validation plan for the changed files.",
		sourceRefs: [
			args.filesSource === "git" ? "git:status" : "input:files",
			`command-catalog:${COMMAND_CATALOG_SCHEMA_VERSION}`,
		],
		score: args.mode === "pr" ? 80 : 90,
		riskTier: inferRiskTier(args.files),
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
	};
}

/**
 * Produce an action-required HarnessDecision recommending the next harness command for the given changed files.
 *
 * @param args - Input arguments
 * @param args.mode - Execution mode (`"local"`, `"pr"`, or `"ci"`)
 * @param args.files - Sorted list of changed file paths to base the recommendation on
 * @param args.filesSource - Origin of `files`: `"override"` when provided by CLI, `"git"` when discovered from git status
 * @param args.sourceErrors - Collected DecisionSource entries describing any source errors encountered while gathering inputs
 * @returns A `HarnessDecision` with `status: "action_required"`, a recommended `nextCommand` and `nextAction`, evidence references, risk tier, and `meta` containing `changedFileCount`, `nextCommandArgv`, and related command metadata
 */
function changedFilesDecision(args: {
	mode: HarnessNextMode;
	files: string[];
	filesSource: "override" | "git";
	sourceErrors: DecisionSource[];
}): HarnessDecision {
	const candidate = createRecommendationCandidate(args);
	const reviewContextFollowUp = chooseNextCommandParts(
		"pr",
		args.files,
	).command;
	return createDecision({
		status: "action_required",
		summary: `Detected ${args.files.length} changed file${args.files.length === 1 ? "" : "s"}.`,
		nextAction: candidate.reason,
		nextCommand: candidate.command,
		phase: args.mode === "pr" ? "review" : "verify",
		objective:
			args.mode === "pr"
				? "Prepare reviewer-facing context for the changed files."
				: "Produce the repo-canonical validation plan for the changed files.",
		requiredEvidence: [...candidate.sourceRefs, `${candidate.command} output`],
		stopConditions: [
			`Stop if ${args.mode === "pr" ? "review-context" : "validation-plan"} cannot produce JSON for the changed files.`,
		],
		humanEscalation: null,
		followUpCommands:
			args.mode === "pr"
				? ["bash scripts/validate-codestyle.sh --fast"]
				: [reviewContextFollowUp],
		hiddenPlumbing: ["git:status", "command-catalog", "risk-tier"],
		safeToRun: candidate.safeToRun,
		requiresHuman: candidate.requiresHuman,
		requiresNetwork: candidate.requiresNetwork,
		writesFiles: candidate.writesFiles,
		evidenceRef: candidate.sourceRefs,
		failureClass: null,
		retry: "safe",
		riskTier: candidate.riskTier,
		meta: decisionMeta({
			mode: args.mode,
			filesSource: args.filesSource,
			changedFileCount: args.files.length,
			nextCommandArgv: candidate.argv,
			commands: candidate.command ? [candidate.command] : [],
			extra: sourceMetaExtra(args.sourceErrors),
		}),
	});
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
