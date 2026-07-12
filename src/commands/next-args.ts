import type { HarnessNextMode } from "./next-decisions.js";
import {
	parseEvidenceMode,
	parseFilesOption,
	type HarnessNextEvidenceMode,
} from "./next-option-parsers.js";
import { NEXT_ARTIFACT_ARG_SPECS } from "./next-artifact-args.js";
export type { HarnessNextEvidenceMode } from "./next-option-parsers.js";
/** Worktree cleanliness posture accepted by `harness next`. */
export type HarnessNextWorktreeRole =
	| "clean"
	| "dirty-with-justification"
	| "fresh-worktree";
/** Parsed command-line options for `harness next`. */
export interface ParsedNextArgs {
	json: boolean;
	mode: HarnessNextMode;
	worktreeRole?: HarnessNextWorktreeRole;
	evidenceMode?: HarnessNextEvidenceMode;
	files?: string[];
	phaseExitPath?: string;
	runtimeCardPath?: string;
	prCloseoutPath?: string;
	fitnessReportPath?: string;
	synaipseTransitionPath?: string;
	error?:
		| "invalid_mode"
		| "mode_missing"
		| "files_missing"
		| "files_empty"
		| "phase_exit_missing"
		| "runtime_card_missing"
		| "pr_closeout_missing"
		| "fitness_report_missing"
		| "synaipse_transition_missing"
		| "evidence_missing"
		| "evidence_invalid"
		| "worktree_role_invalid"
		| "unknown_argument";
	errorValue?: string;
}
const VALID_MODES: readonly HarnessNextMode[] = ["local", "pr", "ci"];
interface NextArgsState {
	json: boolean;
	mode: HarnessNextMode;
	worktreeRole: HarnessNextWorktreeRole;
	evidenceMode?: HarnessNextEvidenceMode;
	files?: string[];
	phaseExitPath?: string;
	runtimeCardPath?: string;
	prCloseoutPath?: string;
	fitnessReportPath?: string;
	synaipseTransitionPath?: string;
}
type NextArgParseResult = { nextIndex: number } | { parsed: ParsedNextArgs };
type NextArgHandler = (
	state: NextArgsState,
	args: string[],
	index: number,
) => NextArgParseResult;
type ArtifactPathKey = (typeof NEXT_ARTIFACT_ARG_SPECS)[number]["field"];
type ArtifactMissingError = ParsedNextArgs["error"] & `${string}_missing`;
/** Return whether a string is a supported `harness next` mode. */
export function isHarnessNextMode(value: string): value is HarnessNextMode {
	return VALID_MODES.includes(value as HarnessNextMode);
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
		...(state.fitnessReportPath !== undefined
			? { fitnessReportPath: state.fitnessReportPath }
			: {}),
		...(state.synaipseTransitionPath !== undefined
			? { synaipseTransitionPath: state.synaipseTransitionPath }
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

function parseArtifactArg(
	state: NextArgsState,
	args: string[],
	index: number,
	field: ArtifactPathKey,
	error: ArtifactMissingError,
): NextArgParseResult {
	const value = readOptionValue(args, index);
	if (!value) return { parsed: stateToParsed(state, { error }) };
	state[field] = value;
	return { nextIndex: index + 1 };
}

const NEXT_ARG_HANDLERS: Record<string, NextArgHandler> = {
	"--mode": parseModeArg,
	"--worktree-role": parseWorktreeRoleArg,
	"--files": parseFilesArg,
	"--evidence": parseEvidenceArg,
	...artifactArgHandlers(),
};

function artifactArgHandlers(): Record<string, NextArgHandler> {
	return Object.fromEntries(
		NEXT_ARTIFACT_ARG_SPECS.map((spec) => [
			spec.flag,
			(state: NextArgsState, args: string[], index: number) =>
				parseArtifactArg(state, args, index, spec.field, spec.error),
		]),
	);
}

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

/** Parse command-line arguments for `harness next`. */
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
