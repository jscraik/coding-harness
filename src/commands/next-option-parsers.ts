/** Evidence strictness for optional phase-exit and runtime-card inputs. */
export type HarnessNextEvidenceMode = "optional" | "required";

const VALID_EVIDENCE_MODES: readonly HarnessNextEvidenceMode[] = [
	"optional",
	"required",
];

/** Parsed result for the multi-value \`harness next --files\` option. */
export interface ParsedFilesOption {
	files?: string[];
	error?: "files_missing" | "files_empty";
	nextIndex: number;
}

/** Parse the optional \`harness next --evidence\` strictness mode. */
export function parseEvidenceMode(
	value: string | undefined,
):
	| { evidenceMode: HarnessNextEvidenceMode }
	| { error: "evidence_missing" | "evidence_invalid"; errorValue?: string } {
	if (!value || value.startsWith("-")) return { error: "evidence_missing" };
	if (!VALID_EVIDENCE_MODES.includes(value as HarnessNextEvidenceMode)) {
		return { error: "evidence_invalid", errorValue: value };
	}
	return { evidenceMode: value as HarnessNextEvidenceMode };
}

/** Split comma-separated file paths into trimmed non-empty entries. */
function splitFiles(raw: string): string[] {
	return raw
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

/** Parse the \`harness next --files\` option from comma-separated or repeated path tokens. */
export function parseFilesOption(
	args: string[],
	index: number,
): ParsedFilesOption {
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
