import type { HarnessNextMode } from "./next-decisions.js";

/** Evidence strictness for phase-exit and runtime-card inputs. */
export type HarnessNextEvidenceMode = "optional" | "required";

/** Parsed CLI arguments for the `harness next` command. */
export interface ParsedNextArgs {
	/** Whether JSON output was requested. */
	json: boolean;
	/** Selected execution posture. */
	mode: HarnessNextMode;
	/** Evidence strictness selected by `--evidence`, when provided. */
	evidenceMode?: HarnessNextEvidenceMode;
	/** Changed-file override parsed from `--files`, when provided. */
	files?: string[];
	/** Phase-exit artifact path parsed from `--phase-exit`, when provided. */
	phaseExitPath?: string;
	/** Runtime-card artifact path parsed from `--runtime-card`, when provided. */
	runtimeCardPath?: string;
	/** Usage error discriminator when parsing fails. */
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
	/** Offending value for usage errors that need one. */
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

/** Return whether a value is a supported `harness next` mode. */
export function isHarnessNextMode(value: string): value is HarnessNextMode {
	return VALID_MODES.includes(value as HarnessNextMode);
}

function isHarnessNextEvidenceMode(
	value: string,
): value is HarnessNextEvidenceMode {
	return VALID_EVIDENCE_MODES.includes(value as HarnessNextEvidenceMode);
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

function parseFilesOption(args: string[], index: number): ParsedFilesOption {
	const values: string[] = [];
	let valueIndex = index + 1;
	while (valueIndex < args.length) {
		const value = args[valueIndex];
		if (value === undefined || value.startsWith("-")) break;
		values.push(...splitFiles(value));
		valueIndex += 1;
	}
	if (values.length === 0 && valueIndex === index + 1) {
		return { error: "files_missing", nextIndex: index };
	}
	if (values.length === 0) {
		return { error: "files_empty", files: [], nextIndex: valueIndex - 1 };
	}
	return { files: values, nextIndex: valueIndex - 1 };
}

/** Parse CLI-style arguments for the `harness next` command. */
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
