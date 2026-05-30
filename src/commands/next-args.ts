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
	error?:
		| "invalid_mode"
		| "mode_missing"
		| "files_missing"
		| "files_empty"
		| "phase_exit_missing"
		| "runtime_card_missing"
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

/** Parse CLI-style arguments for the harness next command. */
export function parseNextArgs(args: string[]): ParsedNextArgs {
	let json = args.includes("--json");
	let mode: HarnessNextMode = "local";
	let worktreeRole: HarnessNextWorktreeRole = "clean";
	let evidenceMode: HarnessNextEvidenceMode | undefined;
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
				return { json, mode, error: "invalid_mode", errorValue: value };
			}
			mode = value;
			index += 1;
			continue;
		}
		if (arg === "--worktree-role") {
			const parsedRole = parseWorktreeRole(args[index + 1]);
			if (parsedRole.error !== undefined) {
				return {
					json,
					mode,
					error: "worktree_role_invalid",
					...(parsedRole.errorValue !== undefined
						? { errorValue: parsedRole.errorValue }
						: {}),
				};
			}
			worktreeRole = parsedRole.worktreeRole ?? "clean";
			index += 1;
			continue;
		}
		if (arg === "--files") {
			const parsedFiles = parseFilesOption(args, index);
			if (parsedFiles.error) {
				return {
					json,
					mode,
					...(parsedFiles.files ? { files: parsedFiles.files } : {}),
					error: parsedFiles.error,
				};
			}
			files = parsedFiles.files;
			index = parsedFiles.nextIndex;
			continue;
		}
		if (arg === "--evidence") {
			const parsedEvidence = parseEvidenceMode(args[index + 1]);
			if ("error" in parsedEvidence) {
				return { json, mode, ...parsedEvidence };
			}
			evidenceMode = parsedEvidence.evidenceMode;
			index += 1;
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
		return { json, mode, error: "unknown_argument", errorValue: arg };
	}

	return {
		json,
		mode,
		worktreeRole,
		...(evidenceMode !== undefined ? { evidenceMode } : {}),
		...(files !== undefined ? { files } : {}),
		...(phaseExitPath !== undefined ? { phaseExitPath } : {}),
		...(runtimeCardPath !== undefined ? { runtimeCardPath } : {}),
	};
}
