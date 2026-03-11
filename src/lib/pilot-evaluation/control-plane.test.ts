import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
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

function writeDocsGateReport(path: string): void {
	writeFileSync(
		path,
		JSON.stringify({
			status: "success",
			contradictions: [],
			missingRequiredSurfaces: [],
			staleSurfaceRefs: [],
			normalizationWarnings: [],
		}),
		"utf-8",
	);
}

function writeDownstreamRepoFixture(
	repoDir: string,
	requiredChecks: string[],
	options?: { contributingMode?: "inline" | "multiline" },
): { contractPath: string; docsGateReportPath: string } {
	mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
	const contractPath = join(repoDir, "harness.contract.json");
	const contract = JSON.parse(
		readFileSync(resolve("harness.contract.json"), "utf-8"),
	) as Record<string, unknown>;
	contract.reviewPolicy = {
		timeoutSeconds: 600,
		timeoutAction: "fail",
		requiredChecks,
		enforceReviewerIndependence: true,
	};
	contract.branchProtection = {
		requiredChecks,
	};
	writeFileSync(contractPath, JSON.stringify(contract, null, 2), "utf-8");
	writeFileSync(join(repoDir, "AGENTS.md"), "# AGENTS\n", "utf-8");
	writeFileSync(join(repoDir, "CLAUDE.md"), "# CLAUDE\n", "utf-8");
	const contributingContent =
		options?.contributingMode === "inline"
			? [
					"# Contributing",
					"",
					`- Require status checks: ${requiredChecks.map((check) => `\`${check}\``).join(", ")}`,
					"",
				].join("\n")
			: [
					"# Contributing",
					"",
					"Require status checks:",
					"",
					...requiredChecks.map((check) => `- \`${check}\``),
					"",
				].join("\n");
	writeFileSync(join(repoDir, "CONTRIBUTING.md"), contributingContent, "utf-8");
	writeFileSync(
		join(repoDir, ".github", "PULL_REQUEST_TEMPLATE.md"),
		"## Summary\n",
		"utf-8",
	);
	writeFileSync(
		join(repoDir, ".github", "workflows", "pr.yml"),
		[
			"on:",
			"  pull_request:",
			"",
			"jobs:",
			...requiredChecks.flatMap((check) => [
				`  ${check.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:`,
				`    name: ${check}`,
				"    runs-on: ubuntu-latest",
				"    steps:",
				"      - run: echo ok",
			]),
			"",
		].join("\n"),
		"utf-8",
	);
	const docsGateReportPath = join(repoDir, "docs-gate-report.json");
	writeDocsGateReport(docsGateReportPath);
	return { contractPath, docsGateReportPath };
}

describe("control-plane artifacts", () => {
	let testDir: string;
	let docsGateReportPath: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		const baseDir = resolve("artifacts");
		if (!existsSync(baseDir)) {
			mkdirSync(baseDir, { recursive: true });
		}
		testDir = join(baseDir, `control-plane-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		docsGateReportPath = join(testDir, "docs-gate-report.json");
		writeDocsGateReport(docsGateReportPath);
	});

	afterEach(() => {
		process.chdir(originalCwd);
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
		expect(warnings).toContain(
			"Automatic demotion trigger emitted: threshold_breach_repeated",
		);

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.scorecard.evaluationDecision).toBe("promote");
		expect(loaded.artifacts?.controlPlaneRun.compatibilityMajor).toBe(1);
		expect(loaded.artifacts?.scorecard.producerVersion).toMatch(
			/^\d+\.\d+\.\d+/,
		);
		expect(loaded.artifacts?.controlPlaneRun.agentIdentity.clientFamily).toBe(
			"codex",
		);
		expect(loaded.artifacts?.governanceSnapshot.requiredChecks.status).toBe(
			"pass",
		);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.initChecks,
		).toEqual(
			loaded.artifacts?.governanceSnapshot.requiredChecks.policyChecks ?? [],
		);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.missingFromInit,
		).toEqual([]);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.surfaceAlignments.find(
				(surface) => surface.surfaceId === "init-branch-protect-guidance",
			)?.status,
		).toBe("pass");
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks
				.missingFromGovernedDocs,
		).toEqual([]);
		expect(
			loaded.artifacts?.phaseReports.map((report) => report.phase).sort(),
		).toEqual(["pilot-evaluate"]);
		expect(
			loaded.artifacts?.phaseReports[0]?.artifactRefs.some((ref) =>
				ref.endsWith("control-plane-scorecard.json"),
			),
		).toBe(true);
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

	it("blocks degraded identity as evidence in merge-authoritative mode", () => {
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
			},
		});

		expect(summary.identityStatus).toBe("identity_degraded");
		expect(summary.evaluationDecision).toBe("block_for_evidence");
	});

	it("fails enforced rollout windows when trusted identity evidence is degraded", () => {
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: { ...createMetrics(), sampleSize: 60 },
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
			},
		});

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(summary.evaluationDecision).toBe("block_for_evidence");
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.rolloutWindow?.passesStageExitCriteria).toBe(
			false,
		);
		expect(loaded.artifacts?.rolloutWindow?.transitionBlockers).toContain(
			"identityCompleteness 0.00 below minimum 1.00",
		);
		expect(loaded.artifacts?.latestDemotionTrigger?.reason).toBe(
			"missing_trusted_evidence",
		);
	});

	it("applies a temporary promote override when contract policy authorizes it", () => {
		const contractPath = join(testDir, "contract-with-override-policy.json");
		const contract = JSON.parse(
			readFileSync(resolve("harness.contract.json"), "utf-8"),
		) as Record<string, unknown>;
		contract.controlPlanePolicy = {
			overridePolicy: {
				authorizedPrincipals: ["jamie", "alex"],
				dualApprovalScopes: ["temporary_unblock", "temporary_promote"],
				maxTtlHours: 24,
				nonOverridableControls: [
					"canonical_runtime_invalid",
					"governance_trust_mismatch",
					"missing_required_instruction_surface",
					"missing_snapshot_integrity_verification",
				],
			},
		};
		writeFileSync(contractPath, JSON.stringify(contract, null, 2), "utf-8");

		const { summary, warnings } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				contractPath,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "enforced",
				clientFamily: "codex",
				providerId: "openai",
				overrideAuthorizedPrincipal: "jamie",
				overrideScope: "temporary_promote",
				overrideReason: "Manual release sign-off completed",
				overrideTicketRef: "JSC-123",
				overrideApprovedBy: ["jamie", "alex"],
				overrideCreatedAt: "2099-03-10T10:00:00Z",
				overrideExpiresAt: "2099-03-10T18:00:00Z",
			},
		});

		expect(summary.evaluationDecision).toBe("promote");
		expect(summary.enforcementDecision).toBe("allow");
		expect(warnings).toContain(
			"Control-plane override applied with scope temporary_promote",
		);

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.scorecard.blockerCodes).toContain(
			"identity_degraded",
		);
		expect(loaded.artifacts?.overridePolicyRecord?.status).toBe("applied");
		expect(
			loaded.artifacts?.auditLog.some(
				(entry) => entry.phase === "override-policy",
			),
		).toBe(true);
		expect(
			loaded.artifacts?.phaseReports.map((report) => report.phase).sort(),
		).toEqual(["override-policy", "pilot-evaluate"]);
	});

	it("derives override expiry from policy TTL when timestamps are omitted", () => {
		const contractPath = join(testDir, "contract-with-override-policy.json");
		const contract = JSON.parse(
			readFileSync(resolve("harness.contract.json"), "utf-8"),
		) as Record<string, unknown>;
		contract.controlPlanePolicy = {
			overridePolicy: {
				authorizedPrincipals: ["jamie", "alex"],
				dualApprovalScopes: ["temporary_unblock", "temporary_promote"],
				maxTtlHours: 24,
				nonOverridableControls: [
					"canonical_runtime_invalid",
					"governance_trust_mismatch",
					"missing_required_instruction_surface",
					"missing_snapshot_integrity_verification",
				],
			},
		};
		writeFileSync(contractPath, JSON.stringify(contract, null, 2), "utf-8");

		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				contractPath,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "enforced",
				clientFamily: "codex",
				providerId: "openai",
				overrideAuthorizedPrincipal: "jamie",
				overrideScope: "temporary_promote",
				overrideReason: "Manual release sign-off completed",
				overrideTicketRef: "JSC-127",
				overrideApprovedBy: ["jamie", "alex"],
			},
		});

		expect(summary.evaluationDecision).toBe("promote");
		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.artifacts?.overridePolicyRecord?.status).toBe("applied");
		expect(loaded.artifacts?.overridePolicyRecord?.createdAt).toBeDefined();
		expect(loaded.artifacts?.overridePolicyRecord?.expiresAt).toBeDefined();
	});

	it("rejects overrides for non-overridable missing required instruction surfaces", () => {
		writeFileSync(
			docsGateReportPath,
			JSON.stringify({
				status: "blocked",
				contradictions: [],
				missingRequiredSurfaces: ["CLAUDE.md"],
				staleSurfaceRefs: [],
				normalizationWarnings: [],
			}),
			"utf-8",
		);

		const contractPath = join(testDir, "contract-with-override-policy.json");
		const contract = JSON.parse(
			readFileSync(resolve("harness.contract.json"), "utf-8"),
		) as Record<string, unknown>;
		contract.controlPlanePolicy = {
			overridePolicy: {
				authorizedPrincipals: ["jamie", "alex"],
				dualApprovalScopes: ["temporary_unblock", "temporary_promote"],
				maxTtlHours: 24,
				nonOverridableControls: [
					"canonical_runtime_invalid",
					"governance_trust_mismatch",
					"missing_required_instruction_surface",
					"missing_snapshot_integrity_verification",
				],
			},
		};
		writeFileSync(contractPath, JSON.stringify(contract, null, 2), "utf-8");

		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				contractPath,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
				overrideAuthorizedPrincipal: "jamie",
				overrideScope: "temporary_promote",
				overrideReason: "Attempted emergency promote",
				overrideTicketRef: "JSC-124",
				overrideApprovedBy: ["jamie", "alex"],
				overrideCreatedAt: "2099-03-10T10:00:00Z",
				overrideExpiresAt: "2099-03-10T18:00:00Z",
			},
		});

		expect(summary.evaluationDecision).toBe("block_for_parity");
		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.artifacts?.overridePolicyRecord?.status).toBe("rejected");
		expect(loaded.artifacts?.overridePolicyRecord?.rejectionReason).toContain(
			"non-overridable",
		);
	});

	it("ignores expired overrides and preserves the underlying decision", () => {
		const contractPath = join(testDir, "contract-with-override-policy.json");
		const contract = JSON.parse(
			readFileSync(resolve("harness.contract.json"), "utf-8"),
		) as Record<string, unknown>;
		contract.controlPlanePolicy = {
			overridePolicy: {
				authorizedPrincipals: ["jamie", "alex"],
				dualApprovalScopes: ["temporary_unblock", "temporary_promote"],
				maxTtlHours: 24,
				nonOverridableControls: [
					"canonical_runtime_invalid",
					"governance_trust_mismatch",
					"missing_required_instruction_surface",
					"missing_snapshot_integrity_verification",
				],
			},
		};
		writeFileSync(contractPath, JSON.stringify(contract, null, 2), "utf-8");

		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				contractPath,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				clientFamily: "codex",
				providerId: "openai",
				overrideAuthorizedPrincipal: "jamie",
				overrideScope: "temporary_promote",
				overrideReason: "Old approval should no longer apply",
				overrideTicketRef: "JSC-125",
				overrideApprovedBy: ["jamie", "alex"],
				overrideCreatedAt: "2026-03-09T10:00:00Z",
				overrideExpiresAt: "2026-03-09T18:00:00Z",
			},
		});

		expect(summary.evaluationDecision).toBe("block_for_evidence");
		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.artifacts?.overridePolicyRecord?.status).toBe("expired");
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

	it("blocks when contract required-check identity drifts from trusted policy sources", () => {
		const contractPath = join(testDir, "contract-with-drift.json");
		writeFileSync(
			contractPath,
			JSON.stringify(
				{
					version: "1.3.0",
					branchProtection: {
						requiredChecks: [
							"pr-template",
							"linear-gate",
							"risk-policy-gate",
							"dependency-review",
							"actions-pinning",
							"consistency-drift-health",
							"docs-gate",
							"lint",
							"typecheck",
							"test",
							"audit",
							"check",
							"memory",
							"security-scan",
						],
					},
				},
				null,
				2,
			),
			"utf-8",
		);

		const { summary, warnings } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				contractPath,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		expect(summary.evaluationDecision).toBe("block_for_evidence");
		expect(warnings).toContain(
			"Required-check identity drift detected across trusted policy sources",
		);
	});

	it("evaluates downstream repos against their own required-check surfaces", () => {
		const repoDir = join(testDir, "downstream-repo");
		const repoArtifactsDir = join(repoDir, "artifacts");
		const requiredChecks = [
			"lint",
			"test",
			"security-scan",
			"dependency-review",
		];
		const { contractPath, docsGateReportPath: repoDocsGateReportPath } =
			writeDownstreamRepoFixture(repoDir, requiredChecks);

		process.chdir(repoDir);
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: repoArtifactsDir,
			metrics: { ...createMetrics(), sampleSize: 60 },
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: repoArtifactsDir,
				contractPath,
				docsGateReportPath: repoDocsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(summary.governanceTrustLevel).toBe("trusted");
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.governanceSnapshot.requiredChecks.status).toBe(
			"pass",
		);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.policyChecks,
		).toEqual(requiredChecks);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.initChecks,
		).toEqual(requiredChecks);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.missingFromInit,
		).toEqual([]);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks
				.missingFromGovernedDocs,
		).toEqual([]);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.surfaceAlignments.find(
				(surface) => surface.surfaceId === "init-branch-protect-guidance",
			)?.status,
		).toBe("pass");
	});

	it("parses inline contributing required-check guidance from init-generated docs", () => {
		const repoDir = join(testDir, "downstream-inline-repo");
		const repoArtifactsDir = join(repoDir, "artifacts");
		const requiredChecks = [
			"lint",
			"test",
			"security-scan",
			"dependency-review",
		];
		const { contractPath, docsGateReportPath: repoDocsGateReportPath } =
			writeDownstreamRepoFixture(repoDir, requiredChecks, {
				contributingMode: "inline",
			});

		process.chdir(repoDir);
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: repoArtifactsDir,
			metrics: { ...createMetrics(), sampleSize: 60 },
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: repoArtifactsDir,
				contractPath,
				docsGateReportPath: repoDocsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(summary.governanceTrustLevel).toBe("trusted");
		expect(loaded.errors).toEqual([]);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.governedDocChecks,
		).toEqual(requiredChecks);
		expect(
			loaded.artifacts?.governanceSnapshot.requiredChecks.surfaceAlignments.find(
				(surface) =>
					surface.surfaceId === "contributing-branch-protect-guidance",
			)?.status,
		).toBe("pass");
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

	it("rejects companion artifacts whose compatibility major exceeds the supported version", () => {
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

		const runPath = join(summary.artifactRoot, "control-plane-run.json");
		const runRecord = JSON.parse(readFileSync(runPath, "utf-8")) as {
			compatibilityMajor: number;
		};
		runRecord.compatibilityMajor = 2;
		writeFileSync(runPath, JSON.stringify(runRecord, null, 2), "utf-8");

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toContain(
			"Unsupported compatibilityMajor on control-plane-run.json: 2",
		);
		expect(loaded.artifacts).toBeNull();
	});

	it("emits a promotion packet when shadow stage exit criteria pass", () => {
		const metrics = { ...createMetrics(), sampleSize: 60 };
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics,
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "shadow",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.rolloutWindow?.stage).toBe("shadow");
		expect(loaded.artifacts?.rolloutWindow?.readyForTransition).toBe(true);
		expect(loaded.artifacts?.latestPromotionPacket?.fromStage).toBe("shadow");
		expect(loaded.artifacts?.latestPromotionPacket?.toStage).toBe("advisory");
		expect(
			loaded.artifacts?.latestPromotionPacket?.thresholdResults.some(
				(result) => result.threshold === "falseBlockRate" && result.passed,
			),
		).toBe(true);
	});

	it("records demotion trigger evidence when enforced stage exit criteria fail", () => {
		const metrics = {
			...createMetrics(),
			sampleSize: 60,
			sensitiveFieldLeakCount: 1,
		};
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics,
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
			},
		});

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.latestDemotionTrigger?.reason).toBe(
			"critical_drift_detected",
		);
		expect(loaded.artifacts?.rolloutWindowHistory?.currentStage).toBe(
			"advisory",
		);
		expect(
			loaded.artifacts?.auditLog.some(
				(entry) =>
					entry.phase === "rollout-demotion" &&
					entry.blocker === "critical_drift_detected",
			),
		).toBe(true);
	});

	it("resets advisory passing-window history after a non-passing window", () => {
		const lowSampleMetrics = {
			...createMetrics(),
			sampleSize: 10,
			repoSampleSizes: { "test/repo": 10 },
		};
		buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: lowSampleMetrics,
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "advisory",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
				overrideApprovedBy: ["jamie"],
			},
		});

		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: {
				...createMetrics(),
				sampleSize: 60,
				repoSampleSizes: { "test/repo": 60 },
			},
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "advisory",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
				overrideApprovedBy: ["jamie"],
			},
		});

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.rolloutWindow?.consecutivePassingWindows).toBe(1);
		expect(loaded.artifacts?.rolloutWindow?.readyForTransition).toBe(false);
		expect(loaded.artifacts?.latestPromotionPacket).toBeNull();
	});

	it("resets consecutive passing windows when the rollout stage changes", () => {
		buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: { ...createMetrics(), sampleSize: 60 },
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "shadow",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: { ...createMetrics(), sampleSize: 60 },
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "advisory",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
				overrideApprovedBy: ["jamie"],
			},
		});

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toEqual([]);
		expect(loaded.artifacts?.rolloutWindow?.stage).toBe("advisory");
		expect(loaded.artifacts?.rolloutWindow?.consecutivePassingWindows).toBe(1);
		expect(loaded.artifacts?.rolloutWindow?.readyForTransition).toBe(false);
	});

	it("fails additive compatibility checks for partial CP6 artifact sets", () => {
		const metrics = { ...createMetrics(), sampleSize: 60 };
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics,
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "shadow",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		unlinkSync(join(summary.artifactRoot, "rollout-window.json"));
		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toContain(
			"Additive compatibility failed: partial CP6 artifact set detected",
		);
		expect(loaded.artifacts).toBeNull();
	});

	it("fails closed when the pilot-evaluate phase report is missing", () => {
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

		unlinkSync(join(summary.artifactRoot, "pilot-evaluate-report.json"));
		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toContain(
			"Missing required phase report: pilot-evaluate-report.json",
		);
		expect(loaded.artifacts).toBeNull();
	});

	it("fails closed when the override-policy phase report is missing", () => {
		const contractPath = join(testDir, "contract-with-override-policy.json");
		const contract = JSON.parse(
			readFileSync(resolve("harness.contract.json"), "utf-8"),
		) as Record<string, unknown>;
		contract.controlPlanePolicy = {
			overridePolicy: {
				authorizedPrincipals: ["jamie", "alex"],
				dualApprovalScopes: ["temporary_unblock", "temporary_promote"],
				maxTtlHours: 24,
				nonOverridableControls: [
					"canonical_runtime_invalid",
					"governance_trust_mismatch",
					"missing_required_instruction_surface",
					"missing_snapshot_integrity_verification",
				],
			},
		};
		writeFileSync(contractPath, JSON.stringify(contract, null, 2), "utf-8");

		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: createMetrics(),
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				contractPath,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "enforced",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
				overrideAuthorizedPrincipal: "jamie",
				overrideScope: "temporary_promote",
				overrideReason: "Manual release sign-off completed",
				overrideTicketRef: "JSC-127",
				overrideApprovedBy: ["jamie", "alex"],
				overrideCreatedAt: "2099-03-10T10:00:00Z",
				overrideExpiresAt: "2099-03-10T18:00:00Z",
			},
		});

		unlinkSync(join(summary.artifactRoot, "override-policy-report.json"));
		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toContain(
			"Missing required phase report: override-policy-report.json",
		);
		expect(loaded.artifacts).toBeNull();
	});

	it("keeps historical promotion packets tied to the original artifact root", () => {
		const firstMetrics = { ...createMetrics(), sampleSize: 60 };
		const { summary: firstSummary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: firstMetrics,
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "shadow",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});
		const firstLoad = loadControlPlaneArtifactSet(firstSummary.artifactRoot);
		expect(firstLoad.errors).toEqual([]);
		const firstPromotionPacketId =
			firstLoad.artifacts?.latestPromotionPacket?.packetId ?? null;
		expect(firstPromotionPacketId).not.toBeNull();

		buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics: { ...createMetrics(), sampleSize: 61 },
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "shadow",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		const reloadedFirstRun = loadControlPlaneArtifactSet(
			firstSummary.artifactRoot,
		);
		expect(reloadedFirstRun.errors).toEqual([]);
		expect(reloadedFirstRun.artifacts?.latestPromotionPacket?.packetId).toBe(
			firstPromotionPacketId,
		);
		expect(reloadedFirstRun.artifacts?.latestDemotionTrigger).toBeNull();
	});

	it("fails closed when rollout history references a missing promotion packet", () => {
		const metrics = { ...createMetrics(), sampleSize: 60 };
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics,
			metricsErrors: [],
			legacyOutcome: "promote",
			legacyHoldReasons: [],
			options: {
				artifactsDir: testDir,
				docsGateReportPath,
				prTemplateStatus: "passed",
				evaluationMode: "pr",
				rolloutStage: "shadow",
				clientFamily: "codex",
				providerId: "openai",
				modelDescriptor: "gpt-5.4",
			},
		});

		const initialLoad = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(initialLoad.errors).toEqual([]);
		const promotionPacketId =
			initialLoad.artifacts?.latestPromotionPacket?.packetId ?? null;
		expect(promotionPacketId).not.toBeNull();
		unlinkSync(
			join(
				testDir,
				"control-plane",
				"promotion-packets",
				`${promotionPacketId}.json`,
			),
		);

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toContain(
			"Join integrity failed: audit log references a missing promotion packet",
		);
		expect(loaded.artifacts).toBeNull();
	});

	it("fails closed when rollout history references missing demotion trigger evidence", () => {
		const metrics = {
			...createMetrics(),
			sampleSize: 60,
			sensitiveFieldLeakCount: 1,
		};
		const { summary } = buildControlPlaneArtifacts({
			artifactsDir: testDir,
			metrics,
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
			},
		});

		const initialLoad = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(initialLoad.errors).toEqual([]);
		expect(initialLoad.artifacts?.latestDemotionTrigger).not.toBeNull();
		unlinkSync(join(testDir, "control-plane", "demotion-triggers.jsonl"));

		const loaded = loadControlPlaneArtifactSet(summary.artifactRoot);
		expect(loaded.errors).toContain(
			"Join integrity failed: audit log references missing demotion trigger evidence",
		);
		expect(loaded.artifacts).toBeNull();
	});
});
