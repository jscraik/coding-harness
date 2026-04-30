import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { GateFinding, GateResult } from "../output/types.js";
import { DEFAULT_CODERABBIT_LOCAL_ARTIFACT } from "./artifact-io.js";
import {
	DEFAULT_LEARNING_ENFORCEMENT_STATUS_LEDGER,
	applyLearningEnforcementStatus,
	loadLearningEnforcementStatusLedger,
} from "./enforcement-status.js";
import { loadLearningArtifact } from "./gate.js";
import type { LearningItem } from "./types.js";

/** Schema version for north-star feedback metrics. */
export const NORTH_STAR_FEEDBACK_SCHEMA_VERSION = "north-star-feedback/v1";

/** Default output path for persisted north-star feedback metrics. */
export const DEFAULT_NORTH_STAR_FEEDBACK_OUTPUT =
	".harness/metrics/north-star-feedback.json";

/** Evidence state for optional metric inputs. */
export type NorthStarEvidenceState = "present" | "insufficient_evidence";

/** Options for building north-star feedback metrics. */
export interface NorthStarFeedbackOptions {
	/** Imported learning artifact path. */
	source?: string;
	/** Local enforcement-status ledger path. */
	enforcementStatusPath?: string;
	/** Optional serialized learnings-gate result path. */
	gateResultPath?: string;
	/** Optional observed review-thread count. */
	reviewThreadCount?: number;
	/** Optional observed validation rerun count. */
	validationReruns?: number;
	/** Minimum usage count treated as high-signal. */
	minUsage?: number;
	/** Optional output path for persisting the metrics artifact. */
	output?: string;
	/** Repository root used for relative paths. */
	repoRoot?: string;
	/** Clock override for deterministic tests. */
	generatedAt?: string;
}

/** North-star feedback command result. */
export interface NorthStarFeedbackResult {
	/** Result schema version. */
	schemaVersion: typeof NORTH_STAR_FEEDBACK_SCHEMA_VERSION;
	/** Command status. */
	status: "success" | "error";
	/** Learning source path. */
	source: string;
	/** Minimum usage count used for high-signal metrics. */
	minUsage: number;
	/** ISO timestamp for the generated metrics. */
	generatedAt: string;
	/** Optional persisted artifact path. */
	outputPath?: string;
	/** Evidence availability for nullable metrics. */
	evidence: {
		learningArtifact: NorthStarEvidenceState;
		enforcementStatus: NorthStarEvidenceState;
		gateResult: NorthStarEvidenceState;
		reviewThreadCount: NorthStarEvidenceState;
		validationReruns: NorthStarEvidenceState;
	};
	/** North-star feedback metrics. */
	metrics: {
		learningHits: number | null;
		learningGateBlocks: number | null;
		learningGateWarnings: number | null;
		promotionCandidates: number;
		promotedLearnings: number;
		highUsageLearningsUnenforced: number;
		reviewThreadCount: number | null;
		validationReruns: number | null;
	};
	/** Compact command summary. */
	summary: {
		insufficientEvidence: string[];
		sourceFingerprint?: string;
	};
	/** Stable error payload on failure. */
	error?: {
		code: string;
		message: string;
		fix?: string;
	};
}

const DEFAULT_MIN_USAGE = 25;

/**
 * Builds north-star feedback metrics from a learning artifact, enforcement ledger, and optional gate/run artifacts.
 *
 * @param options - Controls source paths, minimum usage threshold, observed counts (review threads, validation reruns), optional output persistence path, repository root resolution, and a deterministic generatedAt timestamp.
 * @returns A NorthStarFeedbackResult containing evidence states, computed metrics, a summary (including insufficient-evidence fields and source fingerprint), and optionally `outputPath` when persisted. If artifact/enforcement loading or result persistence fails, the returned result has `status: "error"` and an `error` object with `code` and `message`.
 */
export function buildNorthStarFeedback(
	options: NorthStarFeedbackOptions = {},
): NorthStarFeedbackResult {
	const source = options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT;
	const minUsage = options.minUsage ?? DEFAULT_MIN_USAGE;
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const loaded = loadLearningArtifact(source, repoRoot);
	if (!loaded.ok) {
		return errorResult({
			source,
			minUsage,
			generatedAt: generatedAt(options),
			code: loaded.code,
			message: loaded.message,
			...(loaded.fix ? { fix: loaded.fix } : {}),
		});
	}

	const enforcement = loadLearningEnforcementStatusLedger(
		options.enforcementStatusPath ?? DEFAULT_LEARNING_ENFORCEMENT_STATUS_LEDGER,
		repoRoot,
	);
	if (!enforcement.ok) {
		return errorResult({
			source,
			minUsage,
			generatedAt: generatedAt(options),
			code: enforcement.code,
			message: enforcement.message,
			...(enforcement.fix ? { fix: enforcement.fix } : {}),
		});
	}

	const items = applyLearningEnforcementStatus(
		loaded.artifact.items,
		enforcement.ledger,
	);
	const gateMetrics = loadGateMetrics(options.gateResultPath, repoRoot);
	const evidence = {
		learningArtifact: "present" as const,
		enforcementStatus:
			enforcement.fingerprint.length > 0
				? ("present" as const)
				: ("insufficient_evidence" as const),
		gateResult: gateMetrics.state,
		reviewThreadCount:
			options.reviewThreadCount === undefined
				? ("insufficient_evidence" as const)
				: ("present" as const),
		validationReruns:
			options.validationReruns === undefined
				? ("insufficient_evidence" as const)
				: ("present" as const),
	};
	const result: NorthStarFeedbackResult = {
		schemaVersion: NORTH_STAR_FEEDBACK_SCHEMA_VERSION,
		status: "success",
		source,
		minUsage,
		generatedAt: generatedAt(options),
		evidence,
		metrics: {
			learningHits: gateMetrics.learningHits,
			learningGateBlocks: gateMetrics.learningGateBlocks,
			learningGateWarnings: gateMetrics.learningGateWarnings,
			promotionCandidates: countPromotionCandidates(items, minUsage),
			promotedLearnings: items.filter(
				(item) => item.promotionStatus === "enforced",
			).length,
			highUsageLearningsUnenforced: items.filter(
				(item) => item.usage >= minUsage && item.promotionStatus !== "enforced",
			).length,
			reviewThreadCount: options.reviewThreadCount ?? null,
			validationReruns: options.validationReruns ?? null,
		},
		summary: {
			insufficientEvidence: insufficientEvidenceFields(evidence),
			sourceFingerprint: loaded.artifact.inputFingerprint,
		},
	};
	if (options.output) {
		const write = writeNorthStarFeedbackResult(result, {
			output: options.output,
			repoRoot,
		});
		if (!write.ok) {
			return errorResult({
				source,
				minUsage,
				generatedAt: result.generatedAt,
				code: write.code,
				message: write.message,
			});
		}
		return { ...result, outputPath: write.path };
	}
	return result;
}

/**
 * Counts learning items eligible for promotion based on usage and enforcement status.
 *
 * @param items - The set of learning items to evaluate
 * @param minUsage - The inclusive usage threshold an item must meet to be considered
 * @returns The number of items whose `usage` is greater than or equal to `minUsage` and whose `promotionStatus` is not `enforced`
 */
function countPromotionCandidates(
	items: LearningItem[],
	minUsage: number,
): number {
	return items.filter(
		(item) => item.usage >= minUsage && item.promotionStatus !== "enforced",
	).length;
}

/**
 * Reads an optional learnings-gate result file and derives evidence state and simple gate metrics.
 *
 * @param gateResultPath - Repository-relative path to a serialized gate result file; omit or `undefined` if not provided.
 * @param repoRoot - Filesystem path used to resolve `gateResultPath`.
 * @returns An object containing:
 *  - `state` — `"present"` when a readable gate result with findings was loaded, `"insufficient_evidence"` otherwise.
 *  - `learningHits` — the number of findings whose `id` identifies them as learning-gate findings, or `null` if the file is missing or unreadable.
 *  - `learningGateBlocks` — count of those learning findings with `severity === "error"`, or `null` if unavailable.
 *  - `learningGateWarnings` — count of those learning findings with `severity === "warning"`, or `null` if unavailable.
 */
function loadGateMetrics(
	gateResultPath: string | undefined,
	repoRoot: string,
): {
	state: NorthStarEvidenceState;
	learningHits: number | null;
	learningGateBlocks: number | null;
	learningGateWarnings: number | null;
} {
	if (!gateResultPath) {
		return {
			state: "insufficient_evidence",
			learningHits: null,
			learningGateBlocks: null,
			learningGateWarnings: null,
		};
	}
	const resolvedPath = resolve(repoRoot, gateResultPath);
	if (!existsSync(resolvedPath)) {
		return {
			state: "insufficient_evidence",
			learningHits: null,
			learningGateBlocks: null,
			learningGateWarnings: null,
		};
	}
	let parsed: GateResult;
	try {
		parsed = JSON.parse(readFileSync(resolvedPath, "utf-8")) as GateResult;
	} catch {
		return {
			state: "insufficient_evidence",
			learningHits: null,
			learningGateBlocks: null,
			learningGateWarnings: null,
		};
	}
	const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
	const learningFindings = findings.filter(isLearningGateFinding);
	return {
		state: "present",
		learningHits: learningFindings.length,
		learningGateBlocks: learningFindings.filter(
			(finding) => finding.severity === "error",
		).length,
		learningGateWarnings: learningFindings.filter(
			(finding) => finding.severity === "warning",
		).length,
	};
}

/**
 * Identifies whether a gate finding originates from the learnings gate.
 *
 * @param finding - The gate finding to evaluate.
 * @returns `true` if the finding's `id` begins with "learnings-gate.learning.", `false` otherwise.
 */
function isLearningGateFinding(finding: GateFinding): boolean {
	return finding.id.startsWith("learnings-gate.learning.");
}

/**
 * Atomically writes the given North Star feedback result as a JSON file at a repository-relative path.
 *
 * @param result - The feedback payload to serialize and persist.
 * @param options.output - Repository-relative path where the JSON file should be written.
 * @param options.repoRoot - Filesystem path of the repository root used to resolve `options.output`.
 * @returns An object with `{ ok: true, path }` on success where `path` is the resolved output file path, or `{ ok: false, code, message }` on failure where `code` is `"north_star_feedback.write_failed"` and `message` explains the error.
 */
function writeNorthStarFeedbackResult(
	result: NorthStarFeedbackResult,
	options: { output: string; repoRoot: string },
): { ok: true; path: string } | { ok: false; code: string; message: string } {
	const outputPath = resolve(options.repoRoot, options.output);
	const tempPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
	try {
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(tempPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
		renameSync(tempPath, outputPath);
		return {
			ok: true,
			path: outputPath,
		};
	} catch (error) {
		try {
			rmSync(tempPath, { force: true });
		} catch {
			// Best-effort cleanup only.
		}
		return {
			ok: false,
			code: "north_star_feedback.write_failed",
			message: `Failed to write north-star feedback artifact: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Collects the names of evidence fields that are marked as insufficient.
 *
 * @param evidence - Mapping of evidence field names to their `NorthStarEvidenceState`
 * @returns Field names whose state equals `"insufficient_evidence"`, returned as a sorted array (ascending alphabetical order)
 */
function insufficientEvidenceFields(
	evidence: NorthStarFeedbackResult["evidence"],
): string[] {
	return Object.entries(evidence)
		.filter(([, state]) => state === "insufficient_evidence")
		.map(([field]) => field)
		.sort();
}

/**
 * Determine the ISO 8601 timestamp to use for the feedback result.
 *
 * @param options - Options which may include a precomputed `generatedAt` timestamp
 * @returns An ISO 8601 timestamp string; uses `options.generatedAt` when provided, otherwise the current time
 */
function generatedAt(options: NorthStarFeedbackOptions): string {
	return options.generatedAt ?? new Date().toISOString();
}

/**
 * Constructs a standardized error-shaped NorthStarFeedbackResult used when feedback generation fails.
 *
 * @param options - Parameters for the error result
 * @param options.source - The source artifact identifier that was being processed
 * @param options.minUsage - The minimum usage threshold applied when building metrics
 * @param options.generatedAt - ISO timestamp for when the result was generated
 * @param options.code - Machine-readable error code to include in the result
 * @param options.message - Human-readable error message to include in the result
 * @param options.fix - Optional suggested fix description to include in the result
 * @returns A `NorthStarFeedbackResult` with `status` set to `"error"`, all evidence fields set to `"insufficient_evidence"`, gate metric fields set to `null`, count metrics zeroed as appropriate, `summary.insufficientEvidence` populated, and the `error` object containing the provided `code`, `message`, and optional `fix`
 */
function errorResult(options: {
	source: string;
	minUsage: number;
	generatedAt: string;
	code: string;
	message: string;
	fix?: string;
}): NorthStarFeedbackResult {
	return {
		schemaVersion: NORTH_STAR_FEEDBACK_SCHEMA_VERSION,
		status: "error",
		source: options.source,
		minUsage: options.minUsage,
		generatedAt: options.generatedAt,
		evidence: {
			learningArtifact: "insufficient_evidence",
			enforcementStatus: "insufficient_evidence",
			gateResult: "insufficient_evidence",
			reviewThreadCount: "insufficient_evidence",
			validationReruns: "insufficient_evidence",
		},
		metrics: {
			learningHits: null,
			learningGateBlocks: null,
			learningGateWarnings: null,
			promotionCandidates: 0,
			promotedLearnings: 0,
			highUsageLearningsUnenforced: 0,
			reviewThreadCount: null,
			validationReruns: null,
		},
		summary: {
			insufficientEvidence: [
				"enforcementStatus",
				"gateResult",
				"learningArtifact",
				"reviewThreadCount",
				"validationReruns",
			],
		},
		error: {
			code: options.code,
			message: options.message,
			...(options.fix ? { fix: options.fix } : {}),
		},
	};
}

/**
 * Compute a SHA-256 hex fingerprint of a serialized feedback payload.
 *
 * @param payload - The serialized feedback payload to hash
 * @returns The SHA-256 digest of `payload` encoded as a lowercase hex string
 */
export function fingerprintNorthStarFeedback(payload: string): string {
	return createHash("sha256").update(payload).digest("hex");
}
