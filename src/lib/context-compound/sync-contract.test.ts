/**
 * Tests for the sync contract module (JSC-189).
 */
import { describe, expect, it } from "vitest";
import {
	type BackendProbeResult,
	buildSyncReport,
	classifyIndexingStrategy,
} from "./sync-contract.js";

// ─── classifyIndexingStrategy ────────────────────────────────────────────────

describe("classifyIndexingStrategy", () => {
	const availableOllama: BackendProbeResult = {
		backend: "ollama",
		availability: "available",
		diagnostic: "Ollama available",
		retryable: true,
		remediation: "",
		latencyMs: 50,
	};

	const unavailableOllama: BackendProbeResult = {
		backend: "ollama",
		availability: "unavailable",
		diagnostic: "Ollama not reachable",
		retryable: true,
		remediation: "Install Ollama",
		latencyMs: -1,
	};

	it("returns incremental mode when not forced and Ollama available", () => {
		const result = classifyIndexingStrategy([availableOllama]);
		expect(result.mode).toBe("incremental");
		expect(result.useSemanticBackend).toBe(true);
		expect(result.sourceOfTruth).toBe("git-tracked");
	});

	it("returns incremental mode when not forced and Ollama unavailable", () => {
		const result = classifyIndexingStrategy([unavailableOllama]);
		expect(result.mode).toBe("incremental");
		expect(result.useSemanticBackend).toBe(false);
		expect(result.sourceOfTruth).toBe("git-tracked");
	});

	it("returns full mode when forced with Ollama available", () => {
		const result = classifyIndexingStrategy([availableOllama], true);
		expect(result.mode).toBe("full");
		expect(result.useSemanticBackend).toBe(true);
	});

	it("returns full mode when forced but Ollama unavailable (lexical fallback)", () => {
		const result = classifyIndexingStrategy([unavailableOllama], true);
		expect(result.mode).toBe("full");
		expect(result.useSemanticBackend).toBe(false);
	});

	it("defaults to git-tracked source of truth regardless of backend", () => {
		const result = classifyIndexingStrategy([]);
		expect(result.sourceOfTruth).toBe("git-tracked");
	});
});

// ─── buildSyncReport ─────────────────────────────────────────────────────────

describe("buildSyncReport", () => {
	it("builds a healthy report when no errors", () => {
		const report = buildSyncReport(
			"incremental",
			[
				{
					backend: "ollama",
					availability: "available",
					diagnostic: "ok",
					retryable: true,
					remediation: "",
					latencyMs: 50,
				},
			],
			{ total: 10, indexed: 3, skipped: 7, errors: 0 },
			[],
		);

		expect(report.healthy).toBe(true);
		expect(report.fileStats.total).toBe(10);
		expect(report.fileStats.orphans).toBe(0);
		expect(report.conflicts).toEqual([]);
		expect(report.mode).toBe("incremental");
	});

	it("builds an unhealthy report when errors present", () => {
		const report = buildSyncReport(
			"full",
			[],
			{ total: 5, indexed: 3, skipped: 0, errors: 2 },
			[],
		);

		expect(report.healthy).toBe(false);
		expect(report.fileStats.errors).toBe(2);
	});

	it("includes conflicts in the report", () => {
		const conflicts = [
			{
				path: ".harness/knowledge/ci/knowledge.md",
				type: "hash_mismatch" as const,
				resolution: "reindexed" as const,
			},
		];

		const report = buildSyncReport(
			"incremental",
			[],
			{ total: 1, indexed: 1, skipped: 0, errors: 0 },
			conflicts,
		);

		expect(report.conflicts).toHaveLength(1);
		expect(report.conflicts[0]?.type).toBe("hash_mismatch");
	});

	it("includes orphan count", () => {
		const report = buildSyncReport(
			"incremental",
			[],
			{ total: 5, indexed: 0, skipped: 5, errors: 0 },
			[],
			2,
		);

		expect(report.fileStats.orphans).toBe(2);
	});

	it("includes timestamp in ISO format", () => {
		const report = buildSyncReport(
			"incremental",
			[],
			{
				total: 0,
				indexed: 0,
				skipped: 0,
				errors: 0,
			},
			[],
		);

		expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});
});
