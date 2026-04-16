/**
 * Sync contract for Project Brain indexing (JSC-189).
 *
 * Defines the source-of-truth hierarchy, availability classification,
 * and conflict resolution strategy for the indexing pipeline.
 *
 * ## Source-of-truth hierarchy
 *
 *   1. Git-tracked `.harness/` artifacts (canonical, versioned)
 *   2. Local-memory daemon runtime index (ephemeral, session-scoped)
 *   3. Context Compound vector store (derived, rebuildable)
 *
 * The vector store is always derivable from (1). Local-memory is optional
 * and supplementary. Conflict resolution always favors git-tracked artifacts.
 *
 * ## Sync modes
 *
 * - `full`: Rebuild vector store from git-tracked artifacts only
 * - `incremental`: Hash-based skip for unchanged files
 * - `hybrid`: Merge git-tracked artifacts with local-memory observations
 *
 * @module lib/context-compound/sync-contract
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Classification of the indexing backend availability */
export type BackendAvailability =
	| "available"
	| "unavailable"
	| "misconfigured"
	| "unknown";

/** Detailed probe result for a backend */
export interface BackendProbeResult {
	/** Backend type */
	backend: "ollama" | "local-memory";
	/** Availability classification */
	availability: BackendAvailability;
	/** Human-readable diagnostic */
	diagnostic: string;
	/** Whether the issue is retryable without user action */
	retryable: boolean;
	/** Suggested remediation */
	remediation: string;
	/** Latency of the probe in ms, or -1 if unreachable */
	latencyMs: number;
}

/** Sync contract summary produced after each index run */
export interface SyncContractReport {
	/** Timestamp of the sync run */
	timestamp: string;
	/** Sync mode used */
	mode: "full" | "incremental" | "hybrid";
	/** Backend probes */
	probes: BackendProbeResult[];
	/** Source-of-truth used for this run */
	sourceOfTruth: "git-tracked" | "local-memory" | "hybrid";
	/** Files processed */
	fileStats: {
		total: number;
		indexed: number;
		skipped: number;
		errors: number;
		orphans: number;
	};
	/** Conflict resolution actions taken */
	conflicts: SyncConflict[];
	/** Overall health */
	healthy: boolean;
}

/** A conflict detected during sync */
export interface SyncConflict {
	/** Artifact path */
	path: string;
	/** Conflict type */
	type: "hash_mismatch" | "orphaned_entry" | "duplicate_path";
	/** Resolution applied */
	resolution: "reindexed" | "removed_orphan" | "deduplicated" | "skipped";
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum acceptable latency for a backend probe (ms) */
const PROBE_TIMEOUT_MS = 5000;

// ─── Probe helpers ───────────────────────────────────────────────────────────

/**
 * Probe Ollama availability and classify the result.
 *
 * Distinguishes between:
 * - `available`: Ollama is running and the model is accessible
 * - `unavailable`: Ollama is not reachable (not installed or not running)
 * - `misconfigured`: Ollama is running but model is not pulled
 */
export async function probeOllama(
	ollamaUrl = "http://localhost:11434",
	model = "bge-m3",
): Promise<BackendProbeResult> {
	const start = Date.now();

	try {
		const response = await fetch(`${ollamaUrl}/api/tags`, {
			method: "GET",
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		const latencyMs = Date.now() - start;

		if (!response.ok) {
			return {
				backend: "ollama",
				availability: "misconfigured",
				diagnostic: `Ollama returned HTTP ${response.status}`,
				retryable: false,
				remediation: "Check Ollama configuration and restart the service",
				latencyMs,
			};
		}

		const data = (await response.json()) as {
			models?: Array<{ name: string }>;
		};

		const modelAvailable = data.models?.some((m) => m.name.startsWith(model));

		if (!modelAvailable) {
			return {
				backend: "ollama",
				availability: "misconfigured",
				diagnostic: `Ollama running but model '${model}' not found`,
				retryable: false,
				remediation: `Run: ollama pull ${model}`,
				latencyMs,
			};
		}

		return {
			backend: "ollama",
			availability: "available",
			diagnostic: `Ollama available with model '${model}'`,
			retryable: true,
			remediation: "",
			latencyMs,
		};
	} catch (error) {
		const latencyMs = Date.now() - start;
		const isTimeout = error instanceof Error && error.name === "AbortError";

		if (isTimeout) {
			return {
				backend: "ollama",
				availability: "unavailable",
				diagnostic: "Ollama probe timed out (service may be overloaded)",
				retryable: true,
				remediation:
					"Check Ollama status with 'ollama list'. Restart with 'ollama serve' if needed.",
				latencyMs,
			};
		}

		return {
			backend: "ollama",
			availability: "unavailable",
			diagnostic: "Ollama not reachable (connection refused or not installed)",
			retryable: true,
			remediation:
				"Install Ollama from https://ollama.com and run 'ollama serve'",
			latencyMs,
		};
	}
}

/**
 * Classify the indexing strategy based on backend availability.
 *
 * Determines the sync mode and source-of-truth from probe results.
 */
export function classifyIndexingStrategy(
	probes: BackendProbeResult[],
	force = false,
): {
	mode: "full" | "incremental" | "hybrid";
	sourceOfTruth: "git-tracked" | "local-memory" | "hybrid";
	useSemanticBackend: boolean;
} {
	const ollamaProbe = probes.find((p) => p.backend === "ollama");
	const ollamaAvailable = ollamaProbe?.availability === "available";

	if (force) {
		return {
			mode: "full",
			sourceOfTruth: "git-tracked",
			useSemanticBackend: ollamaAvailable,
		};
	}

	return {
		mode: "incremental",
		sourceOfTruth: "git-tracked",
		useSemanticBackend: ollamaAvailable,
	};
}

/**
 * Build a sync contract report from an index run.
 */
export function buildSyncReport(
	mode: "full" | "incremental" | "hybrid",
	probes: BackendProbeResult[],
	fileStats: {
		total: number;
		indexed: number;
		skipped: number;
		errors: number;
	},
	conflicts: SyncConflict[],
	orphanCount = 0,
): SyncContractReport {
	const strategy = classifyIndexingStrategy(probes, mode === "full");

	return {
		timestamp: new Date().toISOString(),
		mode,
		probes,
		sourceOfTruth: strategy.sourceOfTruth,
		fileStats: {
			...fileStats,
			orphans: orphanCount,
		},
		conflicts,
		healthy: fileStats.errors === 0,
	};
}
