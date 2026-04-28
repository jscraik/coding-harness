import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sanitizeError } from "../lib/input/sanitize.js";
import type {
	DriftSummary,
	NorthStarDriftArtifactRef,
} from "./drift-gate-artifacts.js";

/** Drift-gate execution mode. */
export type DriftGateMode = "advisory" | "health";
/** Aggregate drift-gate report status. */
export type DriftStatus = "success" | "partial" | "blocked";
/** Top-level drift-gate runtime outcome. */
export type DriftOutcome = "ok" | "error";
/** Machine-readable drift-gate failure class. */
export type DriftErrorClass =
	| "none"
	| "evaluator"
	| "io"
	| "schema"
	| "runtime"
	| "integrity";
/** Result of one drift rule evaluation. */
export type DriftRuleResult = "pass" | "fail" | "not_applicable" | "error";
/** Drift surface family used for grouping findings. */
export type DriftSurface = "command" | "status" | "todo" | "quality-score";
/** Finding severity emitted by drift-gate. */
export type DriftSeverity = "info" | "warning" | "error";
/** Whether a finding already exists in the drift baseline. */
export type DriftBaselineState = "preexisting" | "new";

/** Runtime options for invoking drift-gate directly or through the CLI adapter. */
export interface DriftGateOptions {
	mode?: DriftGateMode;
	json?: boolean;
	outPath?: string;
	baselinePath?: string;
	repoRoot?: string;
	seedBaseline?: boolean;
	suppressions?: string[];
}

/** Remediation guidance attached to a drift finding. */
export interface DriftFixGuidance {
	command?: string;
	manual?: string;
	suppressible?: boolean;
}

/** One drift-gate finding before conversion to canonical structured output. */
export interface DriftFinding {
	rule_id: string;
	surface: DriftSurface;
	rule_result: DriftRuleResult;
	severity: DriftSeverity;
	baseline_state: DriftBaselineState;
	message: string;
	path?: string;
	details?: string;
	fix?: DriftFixGuidance;
	/** Spec-aligned failure class for blocked-state resume routing */
	failureClass?: string;
}

/** Baseline metadata for drift-gate report output. */
export interface DriftBaselineInfo {
	path: string;
	loaded: boolean;
	reason?: string;
}

/** Full drift-gate report persisted to disk and returned by programmatic callers. */
export interface DriftReport {
	schemaVersion: "1.0.0";
	command: "drift-gate";
	mode: DriftGateMode;
	status: DriftStatus;
	outcome: DriftOutcome;
	error_class: DriftErrorClass;
	generated_at: string;
	repo_root: string;
	baseline: DriftBaselineInfo;
	summary: DriftSummary;
	findings: DriftFinding[];
	suppressed?: DriftFinding[];
	baseline_seeded?: boolean;
	artifact_refs?: NorthStarDriftArtifactRef[];
	/** Canonical paths of durable guardrail artifacts emitted during this run */
	guardrail_refs?: string[];
}

/** Programmatic result returned by a drift-gate run. */
export interface DriftGateResult {
	report: DriftReport;
	exitCode: number;
}

export const DEFAULT_BASELINE_PATH =
	"artifacts/consistency-gate/consistency-baseline-latest.json";
export const DEFAULT_OUT_PATH =
	"artifacts/consistency-gate/consistency-drift-advisory-latest.json";

/** Resolve a potentially relative path against the repo root. */
export function normalizePath(repoRoot: string, pathValue: string): string {
	return pathValue.startsWith("/") ? pathValue : resolve(repoRoot, pathValue);
}

/** Compute a stable fingerprint for a drift finding. */
export function findingFingerprint(finding: DriftFinding): string {
	return [finding.rule_id, finding.surface, finding.path ?? ""].join("|");
}

/**
 * Load baseline fingerprints from a prior drift-gate report.
 *
 * @param repoRoot - Repository root for path resolution
 * @param baselinePath - Relative path to the baseline file
 * @returns Object containing fingerprints set, baseline info, and optional loading error
 */
export function loadBaselineFingerprints(
	repoRoot: string,
	baselinePath: string,
): {
	fingerprints: Set<string>;
	info: DriftBaselineInfo;
	loadingError?: { errorClass: DriftErrorClass; message: string };
} {
	const resolved = normalizePath(repoRoot, baselinePath);
	if (!existsSync(resolved)) {
		return {
			fingerprints: new Set(),
			info: {
				path: baselinePath,
				loaded: false,
				reason: "missing_baseline_seed",
			},
		};
	}

	try {
		const raw = readFileSync(resolved, "utf-8");
		const parsed = JSON.parse(raw) as { findings?: unknown };
		if (!Array.isArray(parsed.findings)) {
			return {
				fingerprints: new Set(),
				info: {
					path: baselinePath,
					loaded: false,
					reason: "baseline_schema_invalid",
				},
				loadingError: {
					errorClass: "schema",
					message:
						"Baseline report is missing a valid findings array (baseline schema mismatch).",
				},
			};
		}

		const fingerprints = new Set<string>();
		for (const item of parsed.findings) {
			if (!item || typeof item !== "object") {
				continue;
			}
			const finding = item as Partial<DriftFinding>;
			if (
				typeof finding.rule_id === "string" &&
				typeof finding.surface === "string"
			) {
				fingerprints.add(
					[finding.rule_id, finding.surface, finding.path ?? ""].join("|"),
				);
			}
		}

		return {
			fingerprints,
			info: {
				path: baselinePath,
				loaded: true,
			},
		};
	} catch (error) {
		return {
			fingerprints: new Set(),
			info: {
				path: baselinePath,
				loaded: false,
				reason: "baseline_read_error",
			},
			loadingError: {
				errorClass: "io",
				message: `Failed to load baseline: ${sanitizeError(error)}`,
			},
		};
	}
}

/**
 * Read a text file if it exists.
 *
 * @param path - Absolute path to the file
 * @returns File contents as UTF-8 string, or undefined if the file does not exist
 */
export function readTextFile(path: string): string | undefined {
	if (!existsSync(path)) {
		return undefined;
	}
	return readFileSync(path, "utf-8");
}
