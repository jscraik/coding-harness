import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	type ContextSourceInventory,
	computeArtifactChecksum,
	discoverContextSourceDocuments,
	readContextSourceInventory,
	writeContextSourceInventory,
} from "../lib/context-compound/sources.js";
import type {
	ContextIntegrityPolicy,
	HarnessContract,
} from "../lib/contract/types.js";
import { validateContract } from "../lib/contract/validator.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";

const CONTRACT_PATH = "harness.contract.json";
const MEMORY_METRICS_PATH = ".memory-metrics.json";
const MEMORY_METRICS_SNAPSHOT_PATH =
	"artifacts/context-integrity/memory-metrics-snapshot.json";
const CONTRADICTION_HISTORY_PATH =
	"artifacts/context-integrity/contradiction-history.jsonl";
const DEFAULT_OUTPUT_PATH =
	"artifacts/context-integrity/context-health-report.json";

export const EXIT_CODES = {
	SUCCESS: 0,
	BOOTSTRAP_GAP: 2,
	ERROR: 3,
} as const;

/**
 * Selects whether context-health analyzes current checkout sources or recent artifacts.
 */
export type ContextHealthTriggerType = "current_checkout" | "recent_artifacts";

/**
 * Options for running the context-health report generator.
 */
export interface ContextHealthOptions {
	baseDir?: string;
	json?: boolean;
	outPath?: string;
	triggerType?: ContextHealthTriggerType;
}

interface ArtifactRef {
	type:
		| "context_index_inventory"
		| "memory_metrics_snapshot"
		| "contradiction_history";
	path: string;
	checksum: string;
}

interface RateMetric {
	value: number | null;
	numerator: number;
	denominator: number;
	insufficient_evidence: boolean;
}

interface MemoryMetricsSnapshot {
	schemaVersion: "memory-metrics-snapshot/v1";
	generatedAt: string;
	sourcePath: string;
	unresolvedQuestionCount: number;
	raw: unknown;
}

interface ContradictionHistoryEntry {
	findingId: string;
	category: string;
	status: "open" | "resolved";
	message: string;
	sourcePaths: string[];
	detectedAt: string;
	resolvedAt?: string;
}

/**
 * Canonical context-health report payload written to artifact output.
 */
export interface ContextHealthReport {
	schemaVersion: "context-health-report/v1";
	command: "context-health";
	generatedAt: string;
	repoRoot: string;
	triggerType: ContextHealthTriggerType;
	mode: ContextIntegrityPolicy["mode"];
	status: "ok" | "partial";
	warnings: string[];
	artifactRefs: ArtifactRef[];
	metrics: {
		authoritative_coverage_rate: RateMetric;
		contradiction_open_count: number;
		stale_authoritative_source_count: number;
		unknown_authoritative_source_count: number;
		degraded_retrieval_rate: RateMetric;
		memory_unresolved_question_count: number;
		decision_consistency_proxy: RateMetric;
	};
}

function loadValidatedContract(repoRoot: string): {
	contract?: HarnessContract;
	error?: string;
} {
	const contractPath = join(repoRoot, CONTRACT_PATH);
	if (!existsSync(contractPath)) {
		return { error: "Contract file not found: harness.contract.json" };
	}

	try {
		const parsed = JSON.parse(readFileSync(contractPath, "utf-8")) as unknown;
		const validation = validateContract(parsed);
		if (!validation.success || !validation.data) {
			return {
				error:
					validation.errors
						.map((entry) => `${entry.path}: ${entry.message}`)
						.join("; ") || "Contract validation failed",
			};
		}
		return { contract: validation.data };
	} catch (error) {
		return { error: sanitizeError(error) };
	}
}

function createRateMetric(
	numerator: number,
	denominator: number,
	minimum = 1,
): RateMetric {
	if (denominator < minimum) {
		return {
			value: null,
			numerator,
			denominator,
			insufficient_evidence: true,
		};
	}

	return {
		value: denominator === 0 ? null : numerator / denominator,
		numerator,
		denominator,
		insufficient_evidence: false,
	};
}

function writeMemoryMetricsSnapshot(
	repoRoot: string,
): MemoryMetricsSnapshot | null {
	const sourcePath = join(repoRoot, MEMORY_METRICS_PATH);
	if (!existsSync(sourcePath)) {
		return null;
	}

	const raw = JSON.parse(readFileSync(sourcePath, "utf-8")) as {
		current?: { unresolved_questions?: number };
		unresolved_questions?: number;
	};
	const unresolvedQuestionCount =
		raw.current?.unresolved_questions ?? raw.unresolved_questions ?? 0;

	const snapshot: MemoryMetricsSnapshot = {
		schemaVersion: "memory-metrics-snapshot/v1",
		generatedAt: new Date().toISOString(),
		sourcePath: MEMORY_METRICS_PATH,
		unresolvedQuestionCount,
		raw,
	};
	const outputPath = join(repoRoot, MEMORY_METRICS_SNAPSHOT_PATH);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
	return snapshot;
}

function readMemoryMetricsSnapshot(
	repoRoot: string,
): MemoryMetricsSnapshot | null {
	const snapshotPath = join(repoRoot, MEMORY_METRICS_SNAPSHOT_PATH);
	if (!existsSync(snapshotPath)) {
		return null;
	}
	try {
		return JSON.parse(
			readFileSync(snapshotPath, "utf-8"),
		) as MemoryMetricsSnapshot;
	} catch {
		return null;
	}
}

function latestContradictions(
	repoRoot: string,
): Map<string, ContradictionHistoryEntry> {
	const historyPath = join(repoRoot, CONTRADICTION_HISTORY_PATH);
	const entries = new Map<string, ContradictionHistoryEntry>();
	if (!existsSync(historyPath)) {
		return entries;
	}

	const content = readFileSync(historyPath, "utf-8");
	for (const line of content.split(/\r?\n/)) {
		if (!line.trim()) {
			continue;
		}
		try {
			const parsed = JSON.parse(line) as ContradictionHistoryEntry;
			entries.set(parsed.findingId, parsed);
		} catch {
			// Ignore malformed historical rows and keep the latest valid state.
		}
	}
	return entries;
}

function maybeAddArtifactRef(
	refs: ArtifactRef[],
	repoRoot: string,
	type: ArtifactRef["type"],
	relativePath: string,
): void {
	const absolutePath = join(repoRoot, relativePath);
	if (!existsSync(absolutePath)) {
		return;
	}
	refs.push({
		type,
		path: relativePath,
		checksum: `sha256:${computeArtifactChecksum(absolutePath)}`,
	});
}

/**
 * Builds a canonical context health report summarizing coverage, contradictions, memory metrics, and artifacts.
 *
 * @param inventory - The context source inventory (may be `null`); used to compute authoritative source counts and coverage metrics.
 * @param memorySnapshot - The memory metrics snapshot (may be `null`); used to populate unresolved question counts.
 * @returns The assembled ContextHealthReport containing schema metadata, command info, repo and trigger metadata, status and warnings, referenced artifacts, and computed metrics (authoritative coverage, open contradictions, stale/unknown authoritative counts, degraded retrieval proxy, memory unresolved question count, and a decision consistency proxy).
 */
function buildContextHealthReport(
	repoRoot: string,
	triggerType: ContextHealthTriggerType,
	policy: ContextIntegrityPolicy,
	warnings: string[],
	artifactRefs: readonly ArtifactRef[],
	inventory: ContextSourceInventory | null,
	memorySnapshot: MemoryMetricsSnapshot | null,
): ContextHealthReport {
	const reportArtifactRefs = [...artifactRefs];
	const contradictionEntries = latestContradictions(repoRoot);
	maybeAddArtifactRef(
		reportArtifactRefs,
		repoRoot,
		"contradiction_history",
		CONTRADICTION_HISTORY_PATH,
	);
	const latestContradictionValues = Array.from(contradictionEntries.values());
	const openContradictions = latestContradictionValues.filter(
		(entry) => entry.status === "open",
	);

	const authoritativeSources =
		inventory?.sources.filter((source) => source.authority !== "supporting") ??
		[];
	const authoritativeCovered = authoritativeSources.filter(
		(source) => source.exists && source.indexedDocumentCount > 0,
	).length;
	const authoritativeCoverageRate = createRateMetric(
		authoritativeCovered,
		authoritativeSources.length,
		1,
	);
	const staleAuthoritativeSourceCount = authoritativeSources.filter(
		(source) => source.stalenessState === "stale",
	).length;
	const unknownAuthoritativeSourceCount = authoritativeSources.filter(
		(source) => source.stalenessState === "unknown",
	).length;

	const decisionConsistencyProxy = createRateMetric(
		latestContradictionValues.filter((entry) => entry.status === "resolved")
			.length,
		latestContradictionValues.length,
		10,
	);
	const degradedRetrievalRate = createRateMetric(0, 0, 10);
	const memoryUnresolvedQuestionCount =
		memorySnapshot?.unresolvedQuestionCount ?? 0;

	return {
		schemaVersion: "context-health-report/v1",
		command: "context-health",
		generatedAt: new Date().toISOString(),
		repoRoot,
		triggerType,
		mode: policy.mode,
		status: warnings.length > 0 ? "partial" : "ok",
		warnings,
		artifactRefs: reportArtifactRefs,
		metrics: {
			authoritative_coverage_rate: authoritativeCoverageRate,
			contradiction_open_count: openContradictions.length,
			stale_authoritative_source_count: staleAuthoritativeSourceCount,
			unknown_authoritative_source_count: unknownAuthoritativeSourceCount,
			degraded_retrieval_rate: degradedRetrievalRate,
			memory_unresolved_question_count: memoryUnresolvedQuestionCount,
			decision_consistency_proxy: decisionConsistencyProxy,
		},
	};
}

/**
 * Executes context-health validation and writes a report artifact.
 *
 * @param options - Command options controlling path, output, and trigger mode
 * @returns Success payload with report or structured failure with exit code
 */
export function runContextHealth(
	options: ContextHealthOptions = {},
):
	| { ok: true; report: ContextHealthReport }
	| { ok: false; error: string; exitCode: number } {
	const repoRoot = resolve(options.baseDir ?? process.cwd());
	const triggerType = options.triggerType ?? "current_checkout";
	const loadedContract = loadValidatedContract(repoRoot);

	if (
		loadedContract.error ||
		!loadedContract.contract?.contextIntegrityPolicy
	) {
		return {
			ok: false,
			error:
				loadedContract.error ??
				"contextIntegrityPolicy is missing from harness.contract.json",
			exitCode: EXIT_CODES.BOOTSTRAP_GAP,
		};
	}

	const warnings: string[] = [];
	const policy = loadedContract.contract.contextIntegrityPolicy;
	const artifactRefs: ArtifactRef[] = [];
	const currentCheckoutIndexedPaths =
		triggerType === "current_checkout"
			? discoverContextSourceDocuments(repoRoot).map(
					(document) => document.relativePath,
				)
			: undefined;
	const inventory =
		triggerType === "current_checkout"
			? writeContextSourceInventory(repoRoot, currentCheckoutIndexedPaths)
					.report
			: readContextSourceInventory(repoRoot);
	if (!inventory) {
		warnings.push(
			"Context source inventory artifact is missing; authoritative coverage metrics are unavailable.",
		);
	}
	maybeAddArtifactRef(
		artifactRefs,
		repoRoot,
		"context_index_inventory",
		"artifacts/context-integrity/index-source-inventory.json",
	);

	const memorySnapshot =
		triggerType === "current_checkout"
			? writeMemoryMetricsSnapshot(repoRoot)
			: readMemoryMetricsSnapshot(repoRoot);
	if (memorySnapshot) {
		maybeAddArtifactRef(
			artifactRefs,
			repoRoot,
			"memory_metrics_snapshot",
			MEMORY_METRICS_SNAPSHOT_PATH,
		);
	}

	const report = buildContextHealthReport(
		repoRoot,
		triggerType,
		policy,
		warnings,
		artifactRefs,
		inventory,
		memorySnapshot,
	);

	try {
		const outPath = validatePath(
			repoRoot,
			options.outPath ?? DEFAULT_OUTPUT_PATH,
		);
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
	} catch (error) {
		return {
			ok: false,
			error: `Failed to write context-health report: ${sanitizeError(error)}`,
			exitCode: EXIT_CODES.ERROR,
		};
	}

	return { ok: true, report };
}

/**
 * CLI entrypoint for `harness context-health`.
 *
 * @param args - Raw CLI arguments
 * @returns Process exit code
 */
export function runContextHealthCLI(args: string[]): number {
	let json = false;
	let outPath: string | undefined;
	let triggerType: ContextHealthTriggerType = "current_checkout";

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--json" || arg === "-j") {
			json = true;
		} else if (arg === "--out") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error("Error: --out requires a value");
				return EXIT_CODES.ERROR;
			}
			outPath = value;
			i++;
		} else if (arg === "--trigger-type") {
			const value = args[i + 1];
			if (value !== "current_checkout" && value !== "recent_artifacts") {
				console.error(
					"Error: --trigger-type expects current_checkout or recent_artifacts",
				);
				return EXIT_CODES.ERROR;
			}
			triggerType = value;
			i++;
		} else if (arg === "--help" || arg === "-h") {
			console.info("Usage: harness context-health [options]");
			console.info("");
			console.info("Options:");
			console.info("  --json, -j                  Output as JSON");
			console.info(
				"  --out <path>                Write report to a custom path",
			);
			console.info(
				"  --trigger-type <type>       current_checkout | recent_artifacts",
			);
			return EXIT_CODES.SUCCESS;
		}
	}

	const result = runContextHealth({
		json,
		triggerType,
		...(outPath ? { outPath } : {}),
	});
	if (!result.ok) {
		console.error(`✗ ${result.error}`);
		return result.exitCode;
	}

	if (json) {
		console.info(JSON.stringify(result.report, null, 2));
	} else {
		console.info(
			`✓ context-health ${result.report.status} (${result.report.triggerType})`,
		);
		console.info(
			`Authoritative coverage: ${result.report.metrics.authoritative_coverage_rate.value === null ? "insufficient_evidence" : `${(result.report.metrics.authoritative_coverage_rate.value * 100).toFixed(1)}%`}`,
		);
		console.info(
			`Open contradictions: ${result.report.metrics.contradiction_open_count}`,
		);
	}

	return EXIT_CODES.SUCCESS;
}
