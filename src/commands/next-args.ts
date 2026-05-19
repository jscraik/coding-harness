import type { HarnessNextMode } from "./next-decisions.js";

/**
 * Evidence strictness for phase-exit and runtime-card inputs.
 *
 * This type controls whether the `harness next` command requires or allows
 * optional evidence artifacts for decision-making.
 *
 * - `"optional"`: Phase-exit and runtime-card evidence may be omitted.
 * - `"required"`: The command will fail if evidence artifacts are not provided.
 */
export type HarnessNextEvidenceMode = "optional" | "required";

/**
 * Parsed CLI arguments for the `harness next` command.
 *
 * This interface represents the result of parsing raw CLI arguments via
 * {@link parseNextArgs}. On success, `error` is undefined and all requested
 * options are populated. On failure, `error` contains a discriminator value
 * and `errorValue` may hold the offending input.
 */
export interface ParsedNextArgs {
	/** Whether JSON output was requested via `--json`. */
	json: boolean;
	/** Selected execution posture (one of `"local"`, `"pr"`, `"ci"`). */
	mode: HarnessNextMode;
	/**
	 * Evidence strictness selected by `--evidence`, when provided.
	 * Controls whether phase-exit and runtime-card evidence is optional or required.
	 */
	evidenceMode?: HarnessNextEvidenceMode;
	/**
	 * Changed-file override parsed from `--files`, when provided.
	 * Contains one or more file paths (comma-separated in the CLI).
	 */
	files?: string[];
	/**
	 * Phase-exit artifact path parsed from `--phase-exit`, when provided.
	 * References a JSON artifact emitted by `harness phase-exit`.
	 */
	phaseExitPath?: string;
	/**
	 * Runtime-card artifact path parsed from `--runtime-card`, when provided.
	 * References a JSON artifact describing the runtime environment.
	 */
	runtimeCardPath?: string;
	/**
	 * Usage error discriminator when parsing fails.
	 *
	 * Error values:
	 * - `"invalid_mode"`: The `--mode` value is not a valid {@link HarnessNextMode}.
	 * - `"mode_missing"`: `--mode` flag present but no argument followed.
	 * - `"files_missing"`: `--files` flag present but no file arguments provided.
	 * - `"files_empty"`: `--files` consumed arguments but all were empty after trimming.
	 * - `"phase_exit_missing"`: `--phase-exit` flag present but no path argument followed.
	 * - `"runtime_card_missing"`: `--runtime-card` flag present but no path argument followed.
	 * - `"evidence_missing"`: `--evidence` flag present but no mode argument followed.
	 * - `"evidence_invalid"`: `--evidence` value is not a valid {@link HarnessNextEvidenceMode}.
	 * - `"unknown_argument"`: An unrecognized argument was encountered.
	 */
	error?:
		| "invalid_mode"
		| "mode_missing"
		| "files_missing"
		| "files_empty"
		| "phase_exit_missing"
		| "runtime_card_missing"
		| "evidence_missing"
		| "evidence_invalid"
		| "unknown_argument";
	/**
	 * Offending value for usage errors that need one.
	 * Populated when `error` is set and the failure involves a specific input value.
	 */
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

/**
 * Return whether a value is a supported `harness next` mode.
 *
 * This type guard checks if the provided string is one of the valid
 * {@link HarnessNextMode} values (`"local"`, `"pr"`, `"ci"`).
 *
 * @param value - The string to validate.
 * @returns `true` if `value` is a valid mode, narrowing its type to {@link HarnessNextMode}.
 */
export function isHarnessNextMode(value: string): value is HarnessNextMode {
	return VALID_MODES.includes(value as HarnessNextMode);
}

function isHarnessNextEvidenceMode(
	value: string,
): value is HarnessNextEvidenceMode {
	return VALID_EVIDENCE_MODES.includes(value as HarnessNextEvidenceMode);
}

/**
 * Split comma-separated file paths, with heuristics to detect commas inside paths.
 *
 * The function splits on commas by default. However, if exactly two entries result
 * and the first contains a `/` while the second matches `basename.extension` (no slashes),
 * it assumes the comma is part of a single file path (e.g., `"dir/subdir,file.ext"`)
 * and returns the original string as a single entry.
 */
function splitFiles(raw: string): string[] {
	const entries = raw
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	// Heuristic: if we have exactly two entries where the first contains a slash
	// and the second looks like a simple filename with extension (no slashes),
	// treat the entire input as a single file path containing a comma.
	if (
		entries.length === 2 &&
		entries[0]?.includes("/") &&
		/^[^/]+\.[^/]+$/.test(entries[1] ?? "")
	) {
		return [raw.trim()];
	}
	return entries;
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
	// files_missing: --files was present but no argument followed (e.g., `--files --json` or `--files` at end).
	if (values.length === 0 && valueIndex === index + 1) {
		return { error: "files_missing", nextIndex: index };
	}
	// files_empty: Arguments were consumed but all entries were empty after trimming (e.g., `--files ""`).
	if (values.length === 0) {
		return { error: "files_empty", files: [], nextIndex: valueIndex - 1 };
	}
	return { files: values, nextIndex: valueIndex - 1 };
}

/**
 * Parse CLI-style arguments for the `harness next` command.
 *
 * This is the public argument parser for `harness next`. It accepts an array
 * of CLI argument strings and returns a {@link ParsedNextArgs} result.
 *
 * @param args - Raw CLI arguments (typically `process.argv.slice(2)`).
 * @returns A {@link ParsedNextArgs} object containing parsed fields or an error discriminator.
 *
 * On success, the returned object includes:
 * - `json`: Whether `--json` was provided.
 * - `mode`: The selected {@link HarnessNextMode} (defaults to `"local"`).
 * - `evidenceMode`: Optional {@link HarnessNextEvidenceMode} from `--evidence`.
 * - `files`: Optional array of file paths from `--files`.
 * - `phaseExitPath`: Optional path from `--phase-exit`.
 * - `runtimeCardPath`: Optional path from `--runtime-card`.
 *
 * On failure, the `error` field is set to one of:
 * - `"invalid_mode"`: `--mode` value is not valid.
 * - `"mode_missing"`: `--mode` flag present but no argument.
 * - `"files_missing"`: `--files` flag present but no arguments.
 * - `"files_empty"`: `--files` arguments all empty after trimming.
 * - `"phase_exit_missing"`: `--phase-exit` flag present but no argument.
 * - `"runtime_card_missing"`: `--runtime-card` flag present but no argument.
 * - `"evidence_missing"`: `--evidence` flag present but no argument.
 * - `"evidence_invalid"`: `--evidence` value is not valid.
 * - `"unknown_argument"`: Unrecognized argument encountered.
 *
 * The parser validates modes using {@link isHarnessNextMode} and has no side effects.
 */
export function parseNextArgs(args: string[]): ParsedNextArgs {
	let json = args.includes("--json");
	let mode: HarnessNextMode = "local";
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
		...(evidenceMode !== undefined ? { evidenceMode } : {}),
		...(files !== undefined ? { files } : {}),
		...(phaseExitPath !== undefined ? { phaseExitPath } : {}),
		...(runtimeCardPath !== undefined ? { runtimeCardPath } : {}),
	};
}
