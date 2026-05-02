import { execFileSync } from "node:child_process";
import { cwd } from "node:process";
import {
	HARNESS_DECISION_SCHEMA_VERSION,
	type HarnessDecision,
	validateHarnessDecision,
} from "../lib/decision/harness-decision.js";

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

function isHarnessNextMode(value: string): value is HarnessNextMode {
	return VALID_MODES.includes(value as HarnessNextMode);
}

function splitFiles(raw: string): string[] {
	return raw
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseGitStatusPath(rawPath: string): string | null {
	const renameMarker = " -> ";
	const path = rawPath.includes(renameMarker)
		? rawPath.slice(rawPath.indexOf(renameMarker) + renameMarker.length)
		: rawPath;
	const trimmed = path.trim().replace(/^"|"$/g, "");
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

function createDecision(
	decision: Omit<HarnessDecision, "schemaVersion" | "producer">,
): HarnessDecision {
	return {
		schemaVersion: HARNESS_DECISION_SCHEMA_VERSION,
		producer: "harness next",
		...decision,
	};
}

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

function chooseNextCommandParts(
	mode: HarnessNextMode,
	files: string[],
): { command: string; argv: string[] } {
	const commandName = mode === "pr" ? "review-context" : "validation-plan";
	const argv = ["harness", commandName, "--files", ...files, "--json"];
	const command = `harness ${commandName} --files ${fileArgsForCommand(files)} --json`;
	return { command, argv };
}

function decisionMeta(args: {
	mode: HarnessNextMode;
	filesSource: "override" | "git";
	changedFileCount: number;
	nextCommandArgv?: string[];
}): Record<string, unknown> {
	return {
		mode: args.mode,
		filesSource: args.filesSource,
		changedFileCount: args.changedFileCount,
		...(args.nextCommandArgv ? { nextCommandArgv: args.nextCommandArgv } : {}),
	};
}

/** Produce the next safe harness command decision without mutating files. */
export function runHarnessNext(
	options: HarnessNextOptions = {},
): HarnessDecision {
	const repoRoot = options.repoRoot ?? cwd();
	const mode = options.mode ?? "local";
	const filesFromOverride = options.files !== undefined;

	if (!isHarnessNextMode(mode)) {
		return blockedDecision({
			summary: `Unsupported next mode: ${String(mode)}.`,
			nextAction: "Use --mode local, --mode pr, or --mode ci.",
			failureClass: "invalid_mode",
			meta: { mode: String(mode) },
		});
	}

	if (filesFromOverride && (options.files ?? []).length === 0) {
		return blockedDecision({
			summary: "--files did not include any paths.",
			nextAction:
				"Pass one or more changed files, or omit --files so harness next can inspect git state.",
			failureClass: "files_override_empty",
			evidenceRef: ["input:files"],
			meta: { mode, filesSource: "override" },
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
		return createDecision({
			status: "blocked",
			summary: "Git state could not be inspected.",
			nextAction:
				"Run harness doctor --json, fix the reported setup issue, then retry harness next --json.",
			nextCommand: "harness doctor --json",
			safeToRun: true,
			requiresHuman: false,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: ["git:status"],
			failureClass: "git_state_unavailable",
			retry: "manual",
			riskTier: "unknown",
			meta: { mode, filesSource: "git" },
		});
	}

	if (files.length === 0) {
		return createDecision({
			status: "pass",
			summary: "No changed files detected.",
			nextAction: "Run harness check --json to confirm repo readiness.",
			nextCommand: "harness check --json",
			safeToRun: true,
			requiresHuman: false,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: [filesSource === "git" ? "git:status" : "input:files"],
			failureClass: null,
			retry: "safe",
			riskTier: "low",
			meta: { mode, filesSource, changedFileCount: 0 },
		});
	}

	const nextCommand = chooseNextCommandParts(mode, files);
	return createDecision({
		status: "action_required",
		summary: `Detected ${files.length} changed file${files.length === 1 ? "" : "s"}.`,
		nextAction:
			mode === "pr"
				? "Generate reviewer context for the changed files."
				: "Generate a repo-canonical validation plan for the changed files.",
		nextCommand: nextCommand.command,
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: [
			filesSource === "git" ? "git:status" : "input:files",
			"command-catalog:harness-command-catalog/v2",
		],
		failureClass: null,
		retry: "safe",
		riskTier: inferRiskTier(files),
		meta: decisionMeta({
			mode,
			filesSource,
			changedFileCount: files.length,
			nextCommandArgv: nextCommand.argv,
		}),
	});
}

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
		decision = blockedDecision({
			summary: `Unsupported next mode: ${parsed.errorValue}.`,
			nextAction: "Use --mode local, --mode pr, or --mode ci.",
			failureClass: "invalid_mode",
			meta: { mode: parsed.errorValue },
		});
	} else if (parsed.error === "mode_missing") {
		usageError = true;
		decision = blockedDecision({
			summary: "--mode requires a value.",
			nextAction: "Use --mode local, --mode pr, or --mode ci.",
			failureClass: "mode_missing",
		});
	} else if (parsed.error === "files_missing") {
		usageError = true;
		decision = blockedDecision({
			summary: "--files requires a comma-separated path list.",
			nextAction: "Pass one or more changed files, or omit --files.",
			failureClass: "files_missing",
			evidenceRef: ["input:files"],
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
			meta: { argument: parsed.errorValue },
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
