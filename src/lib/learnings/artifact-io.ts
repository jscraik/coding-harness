import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import {
	buildLearningSummary,
	parseCodeRabbitCsv,
	toSourceUri,
} from "./coderabbit-csv.js";
import { countLearningItems, normalizeLearningRows } from "./normalise.js";
import {
	LEARNING_ARTIFACT_SCHEMA_VERSION,
	type LearningImportArtifact,
	type LearningImportWarning,
} from "./types.js";

/** Default local artifact path for CodeRabbit CSV imports. */
export const DEFAULT_CODERABBIT_LOCAL_ARTIFACT =
	".harness/learnings/coderabbit.local.json";

/** Snapshot output reserved for a future sanitized shareable artifact. */
export const RESERVED_CODERABBIT_SNAPSHOT_ARTIFACT =
	".harness/learnings/coderabbit.snapshot.json";

/** Result from building an import artifact before writing it. */
export type BuildLearningArtifactResult =
	| { ok: true; artifact: LearningImportArtifact }
	| {
			ok: false;
			errorCode: string;
			message: string;
			warnings: LearningImportWarning[];
	  };

/** Result from writing a learning import artifact. */
export type WriteLearningArtifactResult =
	| { ok: true; artifactPath: string; warnings: LearningImportWarning[] }
	| {
			ok: false;
			errorCode: string;
			message: string;
			warnings: LearningImportWarning[];
	  };

/** Build a deterministic local artifact from a CodeRabbit CSV file. */
export function buildCodeRabbitLearningArtifact(options: {
	sourcePath: string;
	repository: string;
	previousArtifactPath?: string;
}): BuildLearningArtifactResult {
	if (!existsSync(options.sourcePath)) {
		return {
			ok: false,
			errorCode: "learnings.source_missing",
			message: `Source CSV not found: ${options.sourcePath}`,
			warnings: [],
		};
	}
	const sourceText = readFileSync(options.sourcePath, "utf-8");
	const sourceUri = toSourceUri(resolve(options.sourcePath));
	const parsed = parseCodeRabbitCsv(sourceText, {
		repository: options.repository,
	});
	if (parsed.rows.length === 0) {
		return {
			ok: false,
			errorCode:
				parsed.totalRows === 0
					? "learnings.csv.empty"
					: "learnings.csv.no_valid_rows",
			message:
				"CodeRabbit CSV produced no importable rows for the requested repository.",
			warnings: parsed.warnings,
		};
	}
	const normalized = normalizeLearningRows(parsed.rows, { sourceUri });
	const warnings = [...parsed.warnings, ...normalized.warnings];
	const countMaps = countLearningItems(normalized.items);
	const summary = buildLearningSummary({
		totalRows: parsed.totalRows,
		imported: normalized.items.length,
		skipped: parsed.skipped,
		invalid: parsed.invalid,
		warnings: warnings.length,
		...countMaps,
	});
	const staleWarning = buildStaleImportWarning(
		options.previousArtifactPath,
		summary.imported,
	);
	if (staleWarning) warnings.push(staleWarning);
	const artifact: LearningImportArtifact = {
		schemaVersion: LEARNING_ARTIFACT_SCHEMA_VERSION,
		provider: "coderabbit-csv",
		repository: normalized.items[0]?.repository ?? options.repository,
		source: {
			kind: "coderabbit_csv",
			uri: sourceUri,
			live: false,
		},
		inputFingerprint: createHash("sha256").update(sourceText).digest("hex"),
		items: normalized.items,
		warnings: warnings.sort(sortWarnings),
		summary: { ...summary, warnings: warnings.length },
	};
	return { ok: true, artifact };
}

/** Write a learning artifact atomically to the selected output path. */
export function writeLearningArtifact(options: {
	artifact: LearningImportArtifact;
	outputPath?: string;
	repoRoot?: string;
}): WriteLearningArtifactResult {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const outputPath = resolve(
		repoRoot,
		options.outputPath ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT,
	);
	const snapshotCheck = rejectSnapshotOutput(outputPath, repoRoot);
	if (!snapshotCheck.ok) {
		return {
			ok: false,
			errorCode: snapshotCheck.errorCode,
			message: snapshotCheck.message,
			warnings: options.artifact.warnings,
		};
	}
	const content = `${JSON.stringify(options.artifact, null, 2)}\n`;
	const tempPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
	try {
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(tempPath, content, "utf-8");
		renameSync(tempPath, outputPath);
		return {
			ok: true,
			artifactPath: outputPath,
			warnings: options.artifact.warnings,
		};
	} catch (error) {
		try {
			rmSync(tempPath, { force: true });
		} catch {
			// Best-effort cleanup only.
		}
		return {
			ok: false,
			errorCode: "learnings.write_failed",
			message: `Failed to write learning artifact: ${error instanceof Error ? error.message : String(error)}`,
			warnings: options.artifact.warnings,
		};
	}
}

/** Reject Phase 1A snapshot output, including equivalent relative path variants. */
export function rejectSnapshotOutput(
	outputPath: string,
	repoRoot = process.cwd(),
): { ok: true } | { ok: false; errorCode: string; message: string } {
	const resolvedOutput = resolve(outputPath);
	const resolvedSnapshot = resolve(
		repoRoot,
		RESERVED_CODERABBIT_SNAPSHOT_ARTIFACT,
	);
	if (resolvedOutput === resolvedSnapshot) {
		return {
			ok: false,
			errorCode: "learnings.snapshot_deferred",
			message:
				"Snapshot output is deferred for Phase 1A. Use .harness/learnings/coderabbit.local.json until sanitized shareable snapshots are planned.",
		};
	}
	return { ok: true };
}

function buildStaleImportWarning(
	previousArtifactPath: string | undefined,
	imported: number,
): LearningImportWarning | undefined {
	if (!previousArtifactPath || !existsSync(previousArtifactPath))
		return undefined;
	try {
		const raw = JSON.parse(
			readFileSync(previousArtifactPath, "utf-8"),
		) as unknown;
		if (typeof raw !== "object" || raw === null || !("summary" in raw)) {
			return undefined;
		}
		const previousSummary = (raw as { summary?: { imported?: unknown } })
			.summary;
		const previousImported = previousSummary?.imported;
		if (
			typeof previousImported === "number" &&
			previousImported >= 10 &&
			imported < Math.floor(previousImported / 2)
		) {
			return {
				code: "learnings.imported_count_drop",
				message: `Imported row count dropped from ${previousImported} to ${imported}. Confirm the source export before relying on this local artifact.`,
			};
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function sortWarnings(
	a: LearningImportWarning,
	b: LearningImportWarning,
): number {
	return (
		(a.row ?? Number.MAX_SAFE_INTEGER) - (b.row ?? Number.MAX_SAFE_INTEGER) ||
		a.code.localeCompare(b.code) ||
		a.message.localeCompare(b.message)
	);
}

/** Return true when a path is inside the repository root. */
export function isInsideRepo(path: string, repoRoot = process.cwd()): boolean {
	const rel = relative(resolve(repoRoot), resolve(path));
	return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
}
