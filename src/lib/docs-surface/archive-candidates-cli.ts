import {
	DESTRUCTIVE_ARCHIVE_CANDIDATE_OPTIONS,
	DOCS_ARCHIVE_CANDIDATES_ERROR_SCHEMA,
	type DocsArchiveCandidatesCliError,
} from "./archive-candidates-contract.js";
import {
	formatDocsArchiveCandidatesText,
	runDocsArchiveCandidates,
} from "./archive-candidates.js";

/** CLI streams used to keep archive-candidate command tests deterministic. */
export interface DocsArchiveCandidatesCliStreams {
	stdout: { write(content: string): void };
	stderr: { write(content: string): void };
}

/** Execute docs:archive-candidates CLI behavior and return a process exit code. */
export function runDocsArchiveCandidatesCli(
	args: readonly string[],
	streams: DocsArchiveCandidatesCliStreams,
	repoRoot = process.cwd(),
): number {
	const effectiveArgs = args.filter((arg) => arg !== "--");
	const json = effectiveArgs.includes("--json");
	const unsupportedOption = effectiveArgs.find((arg) =>
		DESTRUCTIVE_ARCHIVE_CANDIDATE_OPTIONS.includes(
			arg as (typeof DESTRUCTIVE_ARCHIVE_CANDIDATE_OPTIONS)[number],
		),
	);
	if (unsupportedOption) {
		writeError(streams, json, {
			schema: DOCS_ARCHIVE_CANDIDATES_ERROR_SCHEMA,
			status: "error",
			code: "destructive_option_unsupported",
			message:
				"docs:archive-candidates is advisory-only and does not mutate files.",
			option: unsupportedOption,
		});
		return 2;
	}
	const unknownOption = effectiveArgs.find(
		(arg) => arg.startsWith("-") && arg !== "--json" && arg !== "--help",
	);
	if (unknownOption) {
		writeError(streams, json, {
			schema: DOCS_ARCHIVE_CANDIDATES_ERROR_SCHEMA,
			status: "error",
			code: "usage_error",
			message: `Unsupported option: ${unknownOption}`,
			option: unknownOption,
		});
		return 2;
	}
	if (effectiveArgs.includes("--help")) {
		streams.stdout.write(
			"Usage: pnpm docs:archive-candidates [-- --json]\n\nReports advisory stale-document archive candidates without mutating files.\n",
		);
		return 0;
	}
	try {
		const report = runDocsArchiveCandidates({ repoRoot });
		streams.stdout.write(
			json
				? `${JSON.stringify(report, null, 2)}\n`
				: formatDocsArchiveCandidatesText(report),
		);
		return 0;
	} catch (error) {
		writeError(streams, json, {
			schema: DOCS_ARCHIVE_CANDIDATES_ERROR_SCHEMA,
			status: "error",
			code: "runtime_error",
			message: error instanceof Error ? error.message : String(error),
		});
		return 1;
	}
}

function writeError(
	streams: DocsArchiveCandidatesCliStreams,
	json: boolean,
	error: DocsArchiveCandidatesCliError,
): void {
	if (json) {
		streams.stdout.write(`${JSON.stringify(error, null, 2)}\n`);
		return;
	}
	streams.stderr.write(`${error.code}: ${error.message}\n`);
}
