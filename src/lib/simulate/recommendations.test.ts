import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readArtifactManifests, readTraceFiles } from "./analysis.js";
import { determineFlags, generateRecommendations } from "./recommendations.js";
import type { ConfidenceAssessment, SimulationMetrics } from "./types.js";

const metrics = (
	overrides: Partial<SimulationMetrics> = {},
): SimulationMetrics => ({
	preventedRisk: {
		baseline: 0.2,
		candidate: 0.3,
		delta: 0.1,
		percentChange: 50,
	},
	falseBlockRate: {
		baseline: 0.05,
		candidate: 0.18,
		delta: 0.13,
		percentChange: 260,
	},
	leadTimeDelta: {
		baseline: 2,
		candidate: 5,
		delta: 3,
		percentChange: 150,
	},
	rollbackPressureDelta: {
		baseline: 0.01,
		candidate: 0.15,
		delta: 0.14,
		percentChange: 1400,
	},
	...overrides,
});

const confidence = (
	overrides: Partial<ConfidenceAssessment> = {},
): ConfidenceAssessment => ({
	level: "insufficient-data",
	score: 0,
	rationale: ["Insufficient sample size"],
	dataQuality: {
		sampleSize: "insufficient",
		traceCoverage: 25,
		artifactCompleteness: 40,
		effectiveSampleSize: 3,
	},
	...overrides,
});

describe("simulate recommendation signals", () => {
	it("generates recommendations for the major threshold branches", () => {
		const recommendations = generateRecommendations(
			metrics(),
			{
				summary: {
					total: 10,
					blockedToAllowed: 2,
					allowedToBlocked: 2,
					confidenceChanges: 0,
					unchanged: 6,
				},
				topDeltas: [],
			},
			confidence(),
		);

		expect(recommendations.map(({ id }) => id)).toEqual([
			"rec-insufficient-data",
			"rec-high-false-block-rate",
			"rec-lead-time-regression",
			"rec-rollback-pressure",
			"rec-high-delta-churn",
			"rec-prevented-risk-improvement",
		]);
	});

	it("marks machine-readable flags for low-quality or risky simulations", () => {
		expect(determineFlags(confidence().dataQuality, metrics()).sort()).toEqual([
			"high_false_block_risk",
			"insufficient_data",
			"partial_coverage",
			"significant_lead_time_impact",
		]);
	});
});

describe("simulate filesystem readers", () => {
	const testRoot = join(tmpdir(), "harness-simulate-readers-test");

	afterEach(() => {
		rmSync(testRoot, { recursive: true, force: true });
	});

	it("reads bounded artifact manifests and skips malformed files", () => {
		const artifactsDir = join(testRoot, "artifacts");
		const validRun = join(artifactsDir, "valid-run");
		const malformedRun = join(artifactsDir, "malformed-run");
		const wrongSchemaRun = join(artifactsDir, "wrong-schema-run");
		mkdirSync(validRun, { recursive: true });
		mkdirSync(malformedRun, { recursive: true });
		mkdirSync(wrongSchemaRun, { recursive: true });
		writeFileSync(
			join(validRun, "manifest.json"),
			JSON.stringify({
				schemaVersion: "agent-run-manifest/v1",
				runId: "run-1",
				command: "harness check",
				startedAt: "2026-05-22T00:00:00Z",
				outcome: "passed",
			}),
			"utf-8",
		);
		writeFileSync(join(malformedRun, "manifest.json"), "{", "utf-8");
		writeFileSync(
			join(wrongSchemaRun, "manifest.json"),
			JSON.stringify({ schemaVersion: "other/v1" }),
			"utf-8",
		);

		expect(readArtifactManifests(artifactsDir)).toEqual({
			fileCount: 2,
			manifests: [
				expect.objectContaining({
					runId: "run-1",
					schemaVersion: "agent-run-manifest/v1",
				}),
			],
		});
	});

	it("counts trace files without treating unrelated files as traces", () => {
		const tracesDir = join(testRoot, "traces");
		mkdirSync(tracesDir, { recursive: true });
		writeFileSync(join(tracesDir, "current.json"), "{}", "utf-8");
		writeFileSync(join(tracesDir, "events.jsonl"), "{}", "utf-8");
		writeFileSync(join(tracesDir, "run-legacy-events.json"), "{}", "utf-8");
		writeFileSync(join(tracesDir, "notes.txt"), "not a trace", "utf-8");

		expect(readTraceFiles(tracesDir)).toEqual({
			legacyCount: 1,
			traceCount: 3,
		});
	});
});
