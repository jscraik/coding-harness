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

/** Build north-star feedback metrics from learning evidence and optional run artifacts. */
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

function countPromotionCandidates(
	items: LearningItem[],
	minUsage: number,
): number {
	return items.filter(
		(item) => item.usage >= minUsage && item.promotionStatus !== "enforced",
	).length;
}

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
	const parsed = JSON.parse(readFileSync(resolvedPath, "utf-8")) as GateResult;
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

function isLearningGateFinding(finding: GateFinding): boolean {
	return finding.id.startsWith("learnings-gate.learning.");
}

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

function insufficientEvidenceFields(
	evidence: NorthStarFeedbackResult["evidence"],
): string[] {
	return Object.entries(evidence)
		.filter(([, state]) => state === "insufficient_evidence")
		.map(([field]) => field)
		.sort();
}

function generatedAt(options: NorthStarFeedbackOptions): string {
	return options.generatedAt ?? new Date().toISOString();
}

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

/** Build a stable fingerprint for serialized feedback payloads. */
export function fingerprintNorthStarFeedback(payload: string): string {
	return createHash("sha256").update(payload).digest("hex");
}
