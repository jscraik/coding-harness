import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGateResult } from "../output/normalise-core.js";
import type { GateFinding, GateResult } from "../output/types.js";
import { DEFAULT_CODERABBIT_LOCAL_ARTIFACT } from "./artifact-io.js";
import { matchLearningToFile } from "./fuzzy-match.js";
import {
	type LearningOverrideMode,
	type OverrideAwareGateFinding,
	applyLearningOverrides,
	loadLearningOverrides,
} from "./overrides.js";
import type {
	LearningArtifactLoadResult,
	LearningImportArtifact,
	LearningImportWarning,
	LearningItem,
} from "./types.js";

const GATE_NAME = "learnings-gate";
const LEARNING_CLASSIFICATIONS = new Set([
	"guardrail",
	"validation_contract",
	"source_of_truth",
	"generated_artifact",
	"scaffold_default",
	"ci_ownership",
	"review_context",
	"memory_only",
]);
const LEARNING_ENFORCEMENTS = new Set(["error", "warning", "info", "none"]);
const LEARNING_PROMOTION_STATUSES = new Set([
	"unreviewed",
	"candidate",
	"accepted",
	"enforced",
	"rejected",
	"deferred",
	"non_goal",
]);

/** Options for the exact-file learning gate. */
export interface LearningsGateOptions {
	/** Imported learning artifact path. */
	source?: string;
	/** Changed files or explicit files to match. */
	files: string[];
	/** Repository root used for relative artifact resolution. */
	repoRoot?: string;
	/** Optional learning override file. */
	overrides?: string;
	/** Expired override handling mode. */
	overrideMode?: LearningOverrideMode;
	/** Clock override for deterministic tests. */
	now?: Date;
}

/**
 * Load and validate a local learning artifact, returning the parsed artifact or a structured failure and any detectable source staleness warnings.
 *
 * @param sourcePath - Path to the learning artifact JSON file (defaults to DEFAULT_CODERABBIT_LOCAL_ARTIFACT)
 * @param repoRoot - Repository root used to resolve `sourcePath` (defaults to process.cwd())
 * @returns On success, an object with `ok: true`, the parsed `artifact`, and `warnings` for detectable stale or missing CSV sources. On failure, an object with `ok: false`, a `code` (`learnings.artifact_missing` or `learnings.artifact_invalid`), a human-readable `message`, and a `fix` hint.
 */
export function loadLearningArtifact(
	sourcePath = DEFAULT_CODERABBIT_LOCAL_ARTIFACT,
	repoRoot = process.cwd(),
): LearningArtifactLoadResult {
	const resolvedSource = resolve(repoRoot, sourcePath);
	if (!existsSync(resolvedSource)) {
		return {
			ok: false,
			code: "learnings.artifact_missing",
			message: `Learning artifact not found: ${sourcePath}`,
			fix: "Run harness learnings import --provider coderabbit-csv --source <learnings.csv> --repo <repo> --json.",
		};
	}
	let artifact: LearningImportArtifact;
	try {
		const parsed = JSON.parse(readFileSync(resolvedSource, "utf-8")) as unknown;
		if (!isLearningImportArtifact(parsed)) {
			return {
				ok: false,
				code: "learnings.artifact_invalid",
				message: `Learning artifact at ${sourcePath} must use schemaVersion harness-learnings/v1 with inputFingerprint, source.uri, repository, and items.`,
				fix: "Re-run harness learnings import --provider coderabbit-csv --source <learnings.csv> --repo <repo> --json.",
			};
		}
		artifact = parsed;
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			code: "learnings.artifact_invalid",
			message: `Failed to read learning artifact at ${sourcePath}: ${detail}`,
			fix: "Re-run harness learnings import --provider coderabbit-csv --source <learnings.csv> --repo <repo> --json.",
		};
	}
	return {
		ok: true,
		artifact,
		warnings: detectSourceWarnings(artifact, resolvedSource),
	};
}

function isLearningImportArtifact(
	value: unknown,
): value is LearningImportArtifact {
	if (!isRecord(value)) return false;
	if (value.schemaVersion !== "harness-learnings/v1") return false;
	if (typeof value.provider !== "string") return false;
	if (typeof value.repository !== "string") return false;
	if (!isNonEmptyString(value.inputFingerprint)) return false;
	if (!isRecord(value.source) || typeof value.source.uri !== "string") {
		return false;
	}
	if (!Array.isArray(value.items)) return false;
	return value.items.every(isLearningItemLike);
}

function isLearningItemLike(value: unknown): value is LearningItem {
	if (!isRecord(value)) return false;
	if (!isNonEmptyString(value.id)) return false;
	if (!isNonEmptyString(value.learning)) return false;
	if (!isNonEmptyString(value.repository)) return false;
	if (typeof value.usage !== "number") return false;
	if (!LEARNING_CLASSIFICATIONS.has(String(value.classification))) return false;
	if (!LEARNING_ENFORCEMENTS.has(String(value.enforcement))) return false;
	if (!LEARNING_PROMOTION_STATUSES.has(String(value.promotionStatus))) {
		return false;
	}
	if (value.file !== undefined && typeof value.file !== "string") return false;
	if (
		value.targetPatterns !== undefined &&
		(!Array.isArray(value.targetPatterns) ||
			!value.targetPatterns.every((item) => typeof item === "string"))
	) {
		return false;
	}
	return (
		isRecord(value.source) &&
		value.source.kind === "coderabbit_csv" &&
		isNonEmptyString(value.source.uri) &&
		Number.isInteger(value.source.row) &&
		Number(value.source.row) > 1
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * Execute the Phase 1B exact-file learnings gate for a set of changed or specified files.
 *
 * @param options - Configuration including artifact source, files to evaluate, repository root, optional overrides and override mode, and an optional clock override for deterministic behavior
 * @returns A GateResult containing the gate name, computed status (`pass`, `warn`, or `fail`), accumulated findings, decision evidence references, and meta information (resolved source, matched files, repository, and override configuration)
 */
export function runLearningsGate(options: LearningsGateOptions): GateResult {
	const files = normalizeFiles(options.files);
	const loaded = loadLearningArtifact(options.source, options.repoRoot);
	if (!loaded.ok) {
		const finding: GateFinding = {
			id:
				loaded.code === "learnings.artifact_missing"
					? "learnings-gate.artifact.missing"
					: "learnings-gate.artifact.invalid",
			severity: "error",
			gate: GATE_NAME,
			message: loaded.message,
			baseline: false,
			fix: {
				manual:
					loaded.fix ??
					"Run harness learnings import before relying on learnings gate results.",
				suppressible: false,
			},
		};
		return buildGateResult({
			gate: GATE_NAME,
			status: "fail",
			findings: [finding],
			decision: {
				evidenceRef: [
					`artifact:${options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT}`,
				],
			},
		});
	}

	const overrides = loadLearningOverrides({
		...(options.overrides ? { path: options.overrides } : {}),
		...(options.repoRoot ? { repoRoot: options.repoRoot } : {}),
		...(options.overrideMode ? { mode: options.overrideMode } : {}),
		...(options.now ? { now: options.now } : {}),
	});
	if (!overrides.ok) {
		return buildGateResult({
			gate: GATE_NAME,
			status: "fail",
			findings: overrides.findings,
			decision: {
				evidenceRef: [`overrides:${options.overrides ?? "not-configured"}`],
			},
		});
	}

	const learningFindings = applyLearningOverrides({
		findings: buildLearningFindings(loaded.artifact.items, files),
		overrides: overrides.overrides,
		...(options.now ? { now: options.now } : {}),
	});
	const sourceFindings = loaded.warnings.map(sourceWarningToFinding);
	const findings = [
		...learningFindings,
		...sourceFindings,
		...overrides.warnings,
	].sort(sortFindings);
	const status = findings.some((finding) => finding.severity === "error")
		? "fail"
		: findings.some((finding) => finding.severity === "warning")
			? "warn"
			: "pass";

	return buildGateResult({
		gate: GATE_NAME,
		status,
		findings,
		decision: {
			evidenceRef: buildEvidenceRefs(loaded.artifact, findings),
		},
		meta: {
			source: options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT,
			matchedFiles: files,
			repository: loaded.artifact.repository,
			overrideSource: options.overrides ?? null,
			overrideMode: options.overrideMode ?? "strict",
		},
	});
}

/**
 * Builds gate findings for each learning item that matches any of the provided files.
 *
 * @param items - Learning items from the imported artifact to evaluate for matches
 * @param files - Normalized file paths to check against each learning item
 * @returns An array of findings (one per item-file match) containing severity, message, path, manual fix guidance, override support flags, and match metadata
 */
function buildLearningFindings(
	items: LearningItem[],
	files: string[],
): OverrideAwareGateFinding[] {
	const findings: OverrideAwareGateFinding[] = [];
	for (const item of items) {
		for (const file of files) {
			const match = matchLearningToFile(item, file);
			if (!match) continue;
			findings.push({
				id: `learnings-gate.learning.${item.id}`,
				severity: deriveFindingSeverity(item, match.advisoryOnly),
				gate: GATE_NAME,
				message: `${item.learning} (usage: ${item.usage})`,
				path: file,
				baseline: false,
				fix: {
					manual: buildManualFix(item),
					suppressible: true,
				},
				overrideSupport: {
					suppressible: true,
				},
				match: {
					kind: match.kind,
					confidence: match.confidence,
					reason: match.reason,
					advisoryOnly: match.advisoryOnly,
					falsePositiveCandidate: match.falsePositiveCandidate,
				},
			});
		}
	}
	return findings;
}

/**
 * Determine whether a learning item matches a file path.
 *
 * @param item - The learning item to test
 * @param file - File path to check; the path will be normalized before matching
 * @returns `true` if the learning item matches the given file path, `false` otherwise
 */
export function learningMatchesFile(item: LearningItem, file: string): boolean {
	return matchLearningToFile(item, normalizeFile(file)) !== undefined;
}

/**
 * Determine the effective severity for a learning finding, taking into account advisory-only matches.
 *
 * @param item - The learning item whose `enforcement` sets the base severity (`"error"`, `"warning"`, or `"none"`).
 * @param advisoryOnly - If true, downgrade an `"error"` base severity to `"warning"`.
 * @returns The effective severity: `"error"`, `"warning"`, or `"info"`. `"info"` corresponds to `enforcement === "none"`.
 */
function deriveFindingSeverity(
	item: LearningItem,
	advisoryOnly: boolean,
): GateFinding["severity"] {
	const severity = item.enforcement === "none" ? "info" : item.enforcement;
	if (!advisoryOnly) return severity;
	return severity === "error" ? "warning" : severity;
}

/**
 * Convert an artifact source-level warning into a gate finding suitable for the learnings gate.
 *
 * @param warning - The import-level warning describing a stale or unavailable learning CSV source
 * @returns A `GateFinding` with severity `warning` representing the source warning; includes a non-suppressible manual fix advising to re-run the harness learnings import
 */
function sourceWarningToFinding(warning: LearningImportWarning): GateFinding {
	const sourceCode = warning.code
		.replace(/^learnings\.source_?/, "")
		.replace(/_/g, ".");

	return {
		id: `learnings-gate.source.${sourceCode}`,
		severity: "warning",
		gate: GATE_NAME,
		message: warning.message,
		baseline: false,
		fix: {
			manual:
				"Re-run harness learnings import from the latest CodeRabbit CSV export.",
			suppressible: false,
		},
	};
}

/**
 * Detects whether the learning artifact's CSV source is missing or appears stale and returns any relevant warnings.
 *
 * @param artifact - The parsed learning import artifact whose `source.uri` and optional `inputFingerprint` are checked.
 * @param artifactPath - Filesystem path to the local artifact JSON file (used for mtime comparison).
 * @returns An array of `LearningImportWarning` entries describing detected issues:
 * - empty when no problems are found;
 * - a single warning with code `learnings.source_unavailable` if the referenced local source file is missing;
 * - a single warning with code `learnings.source_stale` if the source content fingerprint differs or the source file mtime is newer than the artifact.
 */
function detectSourceWarnings(
	artifact: LearningImportArtifact,
	artifactPath: string,
): LearningImportWarning[] {
	if (!artifact.source.uri.startsWith("file:")) return [];
	let sourcePath: string;
	try {
		sourcePath = fileURLToPath(artifact.source.uri);
	} catch {
		return [];
	}
	if (!existsSync(sourcePath)) {
		return [
			{
				code: "learnings.source_unavailable",
				message:
					"Imported CodeRabbit CSV source is no longer available locally; gate results use the existing local artifact.",
			},
		];
	}
	if (artifact.inputFingerprint) {
		try {
			const sourceFingerprint = createHash("sha256")
				.update(readFileSync(sourcePath))
				.digest("hex");
			if (sourceFingerprint !== artifact.inputFingerprint) {
				return [
					{
						code: "learnings.source_stale",
						message:
							"Imported CodeRabbit CSV source content differs from the local learning artifact; re-import before relying on gate results.",
					},
				];
			}
			return [];
		} catch {
			// Fall back to mtime when content hashing is unavailable.
		}
	}
	const sourceMtime = statSync(sourcePath).mtimeMs;
	const artifactMtime = statSync(artifactPath).mtimeMs;
	if (sourceMtime > artifactMtime) {
		return [
			{
				code: "learnings.source_stale",
				message:
					"Imported CodeRabbit CSV source is newer than the local learning artifact; re-import before relying on gate results.",
			},
		];
	}
	return [];
}

/**
 * Produce a human-readable manual fix instruction for a matched learning item.
 *
 * Returns a docs-specific instruction when the learning is a `"guardrail"` and the learning's `file` path includes `"docs/"`; otherwise returns a generic review-and-exception instruction.
 *
 * @param item - The learning item whose `classification` and `file` determine the instruction
 * @returns A manual fix message to display with the finding
 */
function buildManualFix(item: LearningItem): string {
	if (item.classification === "guardrail" && item.file?.includes("docs/")) {
		return "Apply the learned docs guardrail before review; keep machine-readable metadata in frontmatter or source data instead of duplicating it in prose.";
	}
	return "Review the matched learning and update the changed file or record an explicit exception before review.";
}

/**
 * Builds evidence reference strings from findings that reference learning items in the artifact.
 *
 * @param artifact - The imported learning artifact containing learning items and their source metadata
 * @param findings - Gate findings to scan for learning-item references
 * @returns An array of unique evidence reference strings for matched learning items (e.g. `csv:<uri>#row=NN` and optional `github_pr:<url>`). If no learning-derived references are found, returns `["gate:learnings-gate"]`.
 */
function buildEvidenceRefs(
	artifact: LearningImportArtifact,
	findings: GateFinding[],
): string[] {
	const refs: string[] = [];
	const learningIdPrefix = "learnings-gate.learning.";
	for (const finding of findings) {
		if (!finding.id.startsWith(learningIdPrefix)) continue;
		const learningId = finding.id.slice(learningIdPrefix.length);
		const item = artifact.items.find(
			(candidate) => candidate.id === learningId,
		);
		if (!item) continue;
		refs.push(`${item.source.kind}:${item.source.uri}#row=${item.source.row}`);
		if (item.githubUrl) refs.push(`github_pr:${item.githubUrl}`);
	}
	return refs.length > 0 ? [...new Set(refs)] : ["gate:learnings-gate"];
}

/**
 * Normalize, deduplicate, and sort a list of file paths.
 *
 * @param files - Array of file path strings that may contain duplicates, relative markers, or empty values
 * @returns An array of normalized file paths with falsy/empty entries removed, duplicates removed, and sorted lexicographically
 */
function normalizeFiles(files: string[]): string[] {
	return [...new Set(files.map(normalizeFile).filter(Boolean))].sort();
}

/**
 * Normalize a file path string for internal matching.
 *
 * Trims surrounding whitespace, converts Windows backslashes to forward slashes, and removes a leading "./".
 *
 * @param file - The raw file path to normalize
 * @returns The normalized path string
 */
function normalizeFile(file: string): string {
	return file.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Orders two gate findings for deterministic sorting by path, severity, then id.
 *
 * @param a - The first finding to compare
 * @param b - The second finding to compare
 * @returns A negative number if `a` should come before `b`, a positive number if `a` should come after `b`, or `0` if they are considered equal
 */
function sortFindings(a: GateFinding, b: GateFinding): number {
	return (
		(a.path ?? "").localeCompare(b.path ?? "") ||
		severityRank(a.severity) - severityRank(b.severity) ||
		a.id.localeCompare(b.id)
	);
}

/**
 * Map a finding severity to a numeric rank used for ordering findings.
 *
 * @param severity - The finding severity to rank
 * @returns `0` for `"error"`, `1` for `"warning"`, `2` for any other severity
 */
function severityRank(severity: GateFinding["severity"]): number {
	return severity === "error" ? 0 : severity === "warning" ? 1 : 2;
}
