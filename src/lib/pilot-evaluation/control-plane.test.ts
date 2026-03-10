import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildControlPlaneArtifacts,
	loadControlPlaneArtifactSet,
} from "./control-plane.js";
import type { PilotMetrics } from "./types.js";

function createMetrics(): PilotMetrics {
	return {
		windowStart: "2026-03-01T00:00:00Z",
		windowEnd: "2026-03-10T00:00:00Z",
		sampleSize: 24,
		leadTimeP50Improvement: -0.45,
		leadTimeP75Improvement: -0.3,
		leadTimeP50CiHalfWidth: 0.1,
		leadTimeP75CiHalfWidth: 0.12,
		rollbackReliability: 1,
		rollbackTriggerCount: 2,
		interventionRate: 0.05,
		highRiskAutomationIncidents: 0,
		unresolvedCriticalIncidents: 0,
		incidentClassificationP95Hours: 2,
		evidenceCompletenessRatio: 1,
		thrashRate: 0,
		sensitiveFieldLeakCount: 0,
		runIdCollisionCount: 0,
		repoSampleSizes: {
			"test/repo": 24,
		},
	};
}

describe("control-plane artifacts", () => {
	let testDir: string;
	let docsGateReportPath: string;

	beforeEach(() => {
		const baseDir = resolve("artifacts");
		if (!existsSync(baseDir)) {
			mkdirSync(baseDir, { recursive: true });
		}
		testDir = join(baseDir, `control-plane-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		docsGateReportPath = join(testDir, "docs-gate-report.json");
		writeFileSync(
			docsGateReportPath,
			JSON.stringify({
				status: "success",
				contradictions: [],
				missingRequiredSurfaces: [],
				staleSurfaceRefs: [],
				normalizationWarnings: [],
			}),
			"utf-8",
		);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("writes companion artifacts with loadable join integrity", () => {
		const { summary, warnings } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "enforced",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
				executionMode: "automation",
				operatorType: "automation",
			},
		});

		expect(summary.evaluationDecision).toBe("promote");
		expect(summary.enforcementDecision).toBe("allow");
		expect(warnings).toEqual([]);

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.scorecard.evaluationDecision).toBe("promote");
		expect(loaded.artifacts?.controlPlaneRun.agentIdentity.clientFamily).toBe(
			"codex",
		);
	});

	it("holds degraded identity in local shadow mode", () => {
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
			},
		});

		expect(summary.identityStatus).toBe("identity_degraded");
		expect(summary.evaluationDecision).toBe("hold");
		expect(summary.enforcementDecision).toBe("non_blocking");
	});

	it("blocks missing trusted pr-template evidence in pr mode", () => {
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "missing",
				evaluationMode: "pr",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		expect(summary.evaluationDecision).toBe("block_for_evidence");
	});

	it("maps docs-gate blocked status to parity failure in pr mode", () => {
		writeFileSync(
			docsGateReportPath,
			JSON.stringify({
				status: "blocked",
				contradictions: ["AGENTS.md drift detected"],
				missingRequiredSurfaces: [],
				staleSurfaceRefs: [],
				normalizationWarnings: [],
			}),
			"utf-8",
		);

		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		expect(summary.instructionParityStatus).toBe("fail");
		expect(summary.evaluationDecision).toBe("block_for_parity");
	});

	it("reports join-integrity failures when artifacts drift apart", () => {
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		const scorecardPath = join(
			summary.artifactRoot,
			"control-plane-scorecard.json",
		);
		const scorecard = JSON.parse(readFileSync(scorecardPath, "utf-8")) as {
			headSha: string | null;
		};
		scorecard.headSha = "deadbeef";
		writeFileSync(scorecardPath, JSON.stringify(scorecard, null, 2), "utf-8");

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toContain(
			"Join integrity failed: headSha mismatch between run and scorecard",
		);
		expect(loaded.artifacts).toBeNull();
	});
});
