import type { HarnessNextMode } from "./next-decisions.js";

/** Evidence strictness for optional phase-exit and runtime-card inputs. */
export type HarnessNextEvidenceMode = "optional" | "required";

/** Worktree handling posture for the harness next recommendation.
 *
 * - clean: enforce a clean and in-sync worktree before recommending local changes.
 * - dirty-with-justification: allow a dirty worktree when the caller explicitly acknowledges that state.
 * - fresh-worktree: recommend and enforce worktrees that are clean and in sync before running local recommendations.
 */
export type HarnessNextWorktreeRole =
	| "clean"
	| "dirty-with-justification"
	| "fresh-worktree";

/** Parsed CLI arguments for the harness next command. */
export interface ParsedNextArgs {
	json: boolean;
	mode: HarnessNextMode;
	worktreeRole?: HarnessNextWorktreeRole;
	evidenceMode?: HarnessNextEvidenceMode;
	files?: string[];
	phaseExitPath?: string;
	runtimeCardPath?: string;
	prCloseoutPath?: string;
	error?:
		| "invalid_mode"
		| "mode_missing"
		| "files_missing"
		| "files_empty"
		| "phase_exit_missing"
		| "runtime_card_missing"
		| "pr_closeout_missing"
		| "evidence_missing"
		| "evidence_invalid"
		| "worktree_role_invalid"
		| "unknown_argument";
	errorValue?: string;
}

const VALID_MODES: readonly HarnessNextMode[] = ["local", "pr", "ci"];
const VALID_EVIDENCE_MODES: readonly HarnessNextEvidenceMode[] = [
	"optional",
	"required",
];

interface ParsedFilesOption {
	files?: string[];
	error?: "files_missing" | "files_empty";
	nextIndex: number;
}

interface NextArgsState {
	json: boolean;
	mode: HarnessNextMode;
	worktreeRole: HarnessNextWorktreeRole;
	evidenceMode?: HarnessNextEvidenceMode;
	files?: string[];
	phaseExitPath?: string;
	runtimeCardPath?: string;
	prCloseoutPath?: string;
}

type NextArgParseResult = { nextIndex: number } | { parsed: ParsedNextArgs };
type NextArgHandler = (
	state: NextArgsState,
	args: string[],
	index: number,
) => NextArgParseResult;
type ArtifactPathKey = "phaseExitPath" | "runtimeCardPath" | "prCloseoutPath";
type ArtifactMissingError =
	| "phase_exit_missing"
	| "runtime_card_missing"
	| "pr_closeout_missing";

function parseEvidenceMode(
	value: string | undefined,
):
	| { evidenceMode: HarnessNextEvidenceMode }
	| { error: "evidence_missing" | "evidence_invalid"; errorValue?: string } {
	if (!value || value.startsWith("-")) return { error: "evidence_missing" };
	if (!isHarnessNextEvidenceMode(value)) {
		return { error: "evidence_invalid", errorValue: value };
	}
	return { evidenceMode: value };
}

/** Return whether a value is a supported harness next execution mode. */
export function isHarnessNextMode(value: string): value is HarnessNextMode {
	return VALID_MODES.includes(value as HarnessNextMode);
}

function isHarnessNextEvidenceMode(
	value: string,
): value is HarnessNextEvidenceMode {
	return VALID_EVIDENCE_MODES.includes(value as HarnessNextEvidenceMode);
}

/** Split comma-separated file paths into trimmed non-empty entries. */
function splitFiles(raw: string): string[] {
	return raw
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseFilesOption(args: string[], index: number): ParsedFilesOption {
	const values: string[] = [];
	let valueIndex = index + 1;
	while (valueIndex < args.length) {
		const value = args[valueIndex];
		if (value === undefined || value.startsWith("-")) break;
		values.push(...splitFiles(value));
		valueIndex += 1;
	}
	// --files was present but no argument followed.
	if (values.length === 0 && valueIndex === index + 1) {
		return { error: "files_missing", nextIndex: index };
	}
	// Arguments were consumed but all entries were empty after trimming.
	if (values.length === 0) {
		return { error: "files_empty", files: [], nextIndex: valueIndex - 1 };
	}
	return { files: values, nextIndex: valueIndex - 1 };
}

function isHarnessNextWorktreeRole(
	value: string,
): value is HarnessNextWorktreeRole {
	return ["clean", "dirty-with-justification", "fresh-worktree"].includes(
		value,
	);
}

function parseWorktreeRole(value: string | undefined): {
	worktreeRole?: HarnessNextWorktreeRole;
	error?: "worktree_role_invalid";
	errorValue?: string | undefined;
} {
	if (value === undefined) return { error: "worktree_role_invalid" };
	if (!isHarnessNextWorktreeRole(value)) {
		return { error: "worktree_role_invalid", errorValue: value };
	}
	return { worktreeRole: value };
}

function stateToParsed(
	state: NextArgsState,
	overrides: Partial<ParsedNextArgs> = {},
): ParsedNextArgs {
	return {
		json: state.json,
		mode: state.mode,
		worktreeRole: state.worktreeRole,
		...(state.evidenceMode !== undefined
			? { evidenceMode: state.evidenceMode }
			: {}),
		...(state.files !== undefined ? { files: state.files } : {}),
		...(state.phaseExitPath !== undefined
			? { phaseExitPath: state.phaseExitPath }
			: {}),
		...(state.runtimeCardPath !== undefined
			? { runtimeCardPath: state.runtimeCardPath }
			: {}),
		...(state.prCloseoutPath !== undefined
			? { prCloseoutPath: state.prCloseoutPath }
			: {}),
		...overrides,
	};
}

function readOptionValue(args: string[], index: number): string | undefined {
	const value = args[index + 1];
	return value === undefined || value.startsWith("-") ? undefined : value;
}

function parseModeArg(
	state: NextArgsState,
	args: string[],
	index: number,
): NextArgParseResult {
	const value = readOptionValue(args, index);
	if (!value) {
		return { parsed: stateToParsed(state, { error: "mode_missing" }) };
	}
	if (!isHarnessNextMode(value)) {
		return {
			parsed: stateToParsed(state, {
				error: "invalid_mode",
				errorValue: value,
			}),
		};
	}
	state.mode = value;
	return { nextIndex: index + 1 };
}

function parseWorktreeRoleArg(
	state: NextArgsState,
	args: string[],
	index: number,
): NextArgParseResult {
	const parsedRole = parseWorktreeRole(args[index + 1]);
	if (parsedRole.error === undefined) {
		state.worktreeRole = parsedRole.worktreeRole ?? "clean";
		return { nextIndex: index + 1 };
	}
	return {
		parsed: stateToParsed(state, {
			error: "worktree_role_invalid",
			...(parsedRole.errorValue !== undefined
				? { errorValue: parsedRole.errorValue }
				: {}),
		}),
	};
}

function parseFilesArg(
	state: NextArgsState,
	args: string[],
	index: number,
): NextArgParseResult {
	const parsedFiles = parseFilesOption(args, index);
	if (parsedFiles.error) {
		return {
			parsed: stateToParsed(state, {
				...(parsedFiles.files ? { files: parsedFiles.files } : {}),
				error: parsedFiles.error,
			}),
		};
	}
	if (parsedFiles.files !== undefined) {
		state.files = parsedFiles.files;
	}
	return { nextIndex: parsedFiles.nextIndex };
}

function parseEvidenceArg(
	state: NextArgsState,
	args: string[],
	index: number,
): NextArgParseResult {
	const parsedEvidence = parseEvidenceMode(args[index + 1]);
	if ("error" in parsedEvidence) {
		return { parsed: stateToParsed(state, parsedEvidence) };
	}
	state.evidenceMode = parsedEvidence.evidenceMode;
	return { nextIndex: index + 1 };
}

function parseArtifactPathArg(args: string[], index: number): string | null {
	return readOptionValue(args, index) ?? null;
}

function parseArtifactArg(
	state: NextArgsState,
	args: string[],
	index: number,
	field: ArtifactPathKey,
	error: ArtifactMissingError,
): NextArgParseResult {
	const value = parseArtifactPathArg(args, index);
	if (!value) return { parsed: stateToParsed(state, { error }) };
	state[field] = value;
	return { nextIndex: index + 1 };
}

const NEXT_ARG_HANDLERS: Record<string, NextArgHandler> = {
	"--mode": parseModeArg,
	"--worktree-role": parseWorktreeRoleArg,
	"--files": parseFilesArg,
	"--evidence": parseEvidenceArg,
	"--phase-exit": (state, args, index) =>
		parseArtifactArg(state, args, index, "phaseExitPath", "phase_exit_missing"),
	"--runtime-card": (state, args, index) =>
		parseArtifactArg(
			state,
			args,
			index,
			"runtimeCardPath",
			"runtime_card_missing",
		),
	"--pr-closeout": (state, args, index) =>
		parseArtifactArg(
			state,
			args,
			index,
			"prCloseoutPath",
			"pr_closeout_missing",
		),
};

function parseNextArg(
	state: NextArgsState,
	args: string[],
	index: number,
): NextArgParseResult {
	const arg = args[index];
	if (arg === undefined || arg === "--json") {
		state.json = true;
		return { nextIndex: index };
	}
	const handler = NEXT_ARG_HANDLERS[arg];
	return handler
		? handler(state, args, index)
		: {
				parsed: stateToParsed(state, {
					error: "unknown_argument",
					errorValue: arg,
				}),
			};
}

/** Parse CLI-style arguments for the harness next command. */
export function parseNextArgs(args: string[]): ParsedNextArgs {
	const state: NextArgsState = {
		json: args.includes("--json"),
		mode: "local",
		worktreeRole: "clean",
	};

	for (let index = 0; index < args.length; index += 1) {
		const result = parseNextArg(state, args, index);
		if ("parsed" in result) return result.parsed;
		index = result.nextIndex;
	}

	return stateToParsed(state);
}
