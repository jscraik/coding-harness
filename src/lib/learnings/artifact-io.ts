import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
	buildLearningSummary,
	parseCodeRabbitCsv,
	toSourceUri,
} from "./coderabbit-csv.js";
import { countLearningItems, normalizeLearningRows } from "./normalise.js";
import { redactSensitiveText } from "./sensitive-text.js";
import {
	LEARNING_ARTIFACT_SCHEMA_VERSION,
	type LearningImportArtifact,
	type LearningImportWarning,
} from "./types.js";

/** Default local artifact path for CodeRabbit CSV imports. */
export const DEFAULT_CODERABBIT_LOCAL_ARTIFACT =
	".harness/learnings/coderabbit.local.json";

/** Sanitized shareable snapshot artifact path for CodeRabbit CSV imports. */
export const RESERVED_CODERABBIT_SNAPSHOT_ARTIFACT =
	".harness/learnings/coderabbit.snapshot.json";

/** Schema version for sanitized shareable learning snapshots. */
export const LEARNING_SNAPSHOT_SCHEMA_VERSION = "harness-learnings-snapshot/v1";

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

/**
 * Construct a deterministic local LearningImportArtifact from a CodeRabbit CSV export.
 *
 * @param options.sourcePath - Filesystem path to the CodeRabbit CSV to import.
 * @param options.repository - Repository identifier to filter/associate parsed rows.
 * @param options.previousArtifactPath - Optional path to a previously written artifact; when present, used to detect and emit a stale-import warning if the imported count drops significantly.
 * @param options.liveCompanion - Optional live companion metadata to include on the artifact; when provided, `rowLevelEvidence` is forcibly set to `false`.
 * @returns A BuildLearningArtifactResult: on success `{ ok: true, artifact }`; on failure `{ ok: false, errorCode, message, warnings }`.
 */
export function buildCodeRabbitLearningArtifact(options: {
	sourcePath: string;
	repository: string;
	previousArtifactPath?: string;
	liveCompanion?: LearningImportArtifact["liveCompanion"];
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
		...(options.liveCompanion
			? {
					liveCompanion: {
						...options.liveCompanion,
						rowLevelEvidence: false,
					},
				}
			: {}),
	};
	return { ok: true, artifact };
}

/**
 * Write a learning artifact atomically to the selected output path.
 *
 * @param options.outputPath - Optional path to write the artifact, resolved against `repoRoot`. Defaults to the module's default local artifact path.
 * @param options.repoRoot - Optional repository root used to resolve `outputPath`. Defaults to the current working directory.
 * @returns An object indicating success (`ok: true`) with `artifactPath` and `warnings`, or failure (`ok: false`) with `errorCode`, `message`, and `warnings`.
 */
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
	const payload = isSnapshotOutput(outputPath, repoRoot)
		? buildSanitizedLearningSnapshot(options.artifact)
		: options.artifact;
	const content = `${JSON.stringify(payload, null, 2)}\n`;
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

/**
 * Determine whether a given output path targets the reserved sanitized snapshot location for the repository.
 *
 * @returns `true` if the resolved output path equals the repository's reserved snapshot path or ends with the platform-specific snapshot suffix, `false` otherwise.
 */
export function isSnapshotOutput(
	outputPath: string,
	repoRoot = process.cwd(),
): boolean {
	const resolvedOutput = resolve(outputPath);
	const resolvedSnapshot = resolve(
		repoRoot,
		RESERVED_CODERABBIT_SNAPSHOT_ARTIFACT,
	);
	const snapshotSuffix = RESERVED_CODERABBIT_SNAPSHOT_ARTIFACT.replaceAll(
		"/",
		sep,
	);
	return (
		resolvedOutput === resolvedSnapshot ||
		resolvedOutput.endsWith(`${sep}${snapshotSuffix}`)
	);
}

/**
 * Produce a privacy-preserving snapshot projection of a local learning artifact suitable for sharing.
 *
 * @param artifact - The local `LearningImportArtifact` to project and redact for sharing.
 * @returns A sanitized snapshot object containing schemaVersion, provider, repository, a minimal `source` description, `inputFingerprint`, a redacted `items` array, redacted `warnings`, and the original `summary`. Sensitive text fields in items and warnings are redacted, item `learning` content is always redacted, and `liveCompanion.rowLevelEvidence` is set to `false` when a live companion is present.
 */
export function buildSanitizedLearningSnapshot(
	artifact: LearningImportArtifact,
): Record<string, unknown> {
	return {
		schemaVersion: LEARNING_SNAPSHOT_SCHEMA_VERSION,
		provider: artifact.provider,
		repository: artifact.repository,
		source: {
			kind: artifact.source.kind,
			sourceLabel: "CodeRabbit CSV export",
			live: artifact.source.live,
		},
		inputFingerprint: artifact.inputFingerprint,
		items: artifact.items.map((item) => ({
			id: item.id,
			provider: item.provider,
			source: {
				kind: item.source.kind,
				sourceLabel: "CodeRabbit CSV export",
				row: item.source.row,
				live: item.source.live,
			},
			repository: item.repository,
			...(item.file ? { file: redactSensitiveText(item.file) } : {}),
			...(item.pullRequest ? { pullRequest: item.pullRequest } : {}),
			...(item.githubUrl
				? { githubUrl: redactSensitiveText(item.githubUrl) }
				: {}),
			usage: item.usage,
			learning: redactSensitiveText(item.learning),
			...(item.createdBy
				? { createdBy: redactSensitiveText(item.createdBy) }
				: {}),
			...(item.lastUsed === undefined
				? {}
				: { lastUsed: redactNullableText(item.lastUsed) }),
			...(item.createdAt
				? { createdAt: redactSensitiveText(item.createdAt) }
				: {}),
			...(item.updatedAt
				? { updatedAt: redactSensitiveText(item.updatedAt) }
				: {}),
			...(item.targetPatterns
				? {
						targetPatterns: item.targetPatterns.map((pattern) =>
							redactSensitiveText(pattern),
						),
					}
				: {}),
			classification: item.classification,
			enforcement: item.enforcement,
			promotionStatus: item.promotionStatus,
			...(item.enforcedBy
				? {
						enforcedBy: item.enforcedBy.map((path) =>
							redactSensitiveText(path),
						),
					}
				: {}),
		})),
		warnings: artifact.warnings.map((warning) => ({
			...warning,
			message: redactSensitiveText(warning.message),
		})),
		summary: artifact.summary,
		...(artifact.liveCompanion
			? {
					liveCompanion: {
						...artifact.liveCompanion,
						rowLevelEvidence: false,
					},
				}
			: {}),
	};
}

/**
 * Redacts a string value while preserving `null`.
 *
 * @param value - The string to redact, or `null` to preserve
 * @returns The redacted string, or `null` if `value` was `null`
 */
function redactNullableText(value: string | null): string | null {
	return value === null ? null : redactSensitiveText(value);
}

/**
 * Detects a substantial drop in imported row count by comparing the current count against a previous artifact's summary.
 *
 * @param previousArtifactPath - Filesystem path to a previously written learning artifact; ignored if `undefined` or missing.
 * @param imported - Current number of imported rows.
 * @returns A warning object when the previous artifact reports at least 10 imported rows and `imported` is less than the true half-count threshold; `undefined` otherwise.
 */
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
			imported < previousImported / 2
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

/**
 * Compare two learning import warnings for deterministic ordering.
 *
 * @param a - The first warning to compare
 * @param b - The second warning to compare
 * @returns A negative number if `a` should come before `b`, a positive number if `a` should come after `b`, `0` if they are equivalent
 */
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

/**
 * Determine whether a filesystem path is the same as or contained within a repository root.
 *
 * @param path - The path to test (file or directory)
 * @param repoRoot - Repository root to test against; defaults to the current working directory
 * @returns `true` if `path` is the same as `repoRoot` or is located inside `repoRoot`, `false` otherwise.
 */
export function isInsideRepo(path: string, repoRoot = process.cwd()): boolean {
	const rel = relative(resolve(repoRoot), resolve(path));
	return (
		rel === "" ||
		(!isAbsolute(rel) && !rel.startsWith("..") && !rel.startsWith(sep))
	);
}
