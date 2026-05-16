import type {
	HarnessDecisionDelayClass,
	HarnessDecisionExecutionProfile,
	HarnessDecisionFrictionClass,
	HarnessDecisionOperationalMeta,
	HarnessDecisionStartupCost,
} from "../lib/decision/harness-decision.js";
import type { DecisionSource } from "../lib/decision/sources.js";
import type { HarnessNextMode } from "./next-decisions.js";

/**
 * Decode a Git-quoted path string into its unescaped UTF-8 form.
 *
 * Decodes when `path` is wrapped in double quotes; supports octal escapes (`\NNN`, up to 3 octal digits), common backslash escapes (`\\`, `\"`, `\n`, `\r`, `\t`), and treats a trailing backslash as a literal backslash. If `path` is not quoted, it is returned unchanged.
 *
 * @param path - A Git-style path string that may be wrapped in double quotes and contain escape sequences
 * @returns The decoded path as a UTF-8 string, or the original `path` if it was not quoted
 */
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

/** Quote a path or argument for display in a shell-ready command string. */
export function shellQuote(value: string): string {
	if (/^[A-Za-z0-9_./:=@%+,-]+$/.test(value)) return value;
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function fileArgsForCommand(files: string[]): string {
	return files.map((file) => shellQuote(file)).join(" ");
}

/**
 * Create the CLI argument vector and a human-readable shell command for the next harness command based on mode and changed files.
 *
 * @param mode - Harness next mode; selects `review-context` when `"pr"`, otherwise `validation-plan`
 * @param files - Ordered list of file paths to pass to `--files`; used verbatim for `argv` and shell-quoted for `command`
 * @returns An object with `argv` (array of command arguments suitable for programmatic execution) and `command` (single shell-ready string for display)
 */
export function chooseNextCommandParts(
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
export function optionalNetworkSources(
	mode: HarnessNextMode,
): DecisionSource[] {
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
export function sourceMetaExtra(sourceErrors: readonly DecisionSource[]): {
	sourceErrors?: DecisionSource[];
} {
	return sourceErrors.length > 0 ? { sourceErrors: [...sourceErrors] } : {};
}

/**
 * Construct a standardized operational metadata object for a HarnessDecision from contextual inputs.
 *
 * @returns An object containing `mode`; optional `filesSource`, `changedFileCount`, `nextCommandArgv`, and any `extra` fields; defaulted `frictionClass` and `delayClass`; and an `execution` block with `profile`, `startupCost`, and a `permissionPlan` describing `requiresHuman`, `requiresNetwork`, `writesFiles`, `requiresGitWrite`, `filesystemWrite`, `commands`, and `secrets`.
 */
export function decisionMeta(args: {
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
 * Build metadata for blocked harness next decisions that require operator
 * input before the command can safely continue.
 *
 * @param args - Mode, optional file-source context, friction class, and extra metadata to attach.
 * @returns Standard operational metadata with human intervention, no startup cost, and normal read-only execution defaults.
 */
export function humanRequiredDecisionMeta(args: {
	mode: string;
	filesSource?: "override" | "git";
	frictionClass: HarnessDecisionFrictionClass;
	extra?: Record<string, unknown>;
}): HarnessDecisionOperationalMeta & Record<string, unknown> {
	return decisionMeta({
		mode: args.mode,
		...(args.filesSource ? { filesSource: args.filesSource } : {}),
		frictionClass: args.frictionClass,
		delayClass: "human_needed",
		startupCost: "none",
		requiresHuman: true,
		...(args.extra ? { extra: args.extra } : {}),
	});
}
