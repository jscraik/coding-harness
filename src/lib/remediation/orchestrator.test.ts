/**
 * Tests for RemediationOrchestrator
 *
 * Covers:
 * - TOCTOU race detection at all 3 checkpoints
 * - Ancestry batching with SHA deduplication
 * - Tier-based action decisions
 * - Fail-closed validation for unknown severities
 */

import { describe, expect, it, vi } from "vitest";
import type { RemediationPolicy } from "../contract/types.js";
import {
	type GitHubClient,
	RemediationOrchestrator,
	tierAllowsAuto,
} from "./orchestrator.js";
import type { CanonicalFinding, RemediationSeverity } from "./types.js";
import type { RemediationAutoTier } from "./types.js";

const mockPolicy: RemediationPolicy = {
	providerDefaults: {
		codeql: { autoApplyMaxTier: "medium", dryRunOnlyByDefault: false },
		codex: { autoApplyMaxTier: "low", dryRunOnlyByDefault: true },
	},
	marker: "<!-- harness-remediation -->",
	timeoutMinutes: 5,
	retryLimit: 3,
	requireEvidence: false,
};

function makeFinding(
	overrides: Partial<CanonicalFinding> = {},
): CanonicalFinding {
	return {
		id: "test-1",
		provider: "codeql",
		severity: "low",
		title: "Test",
		description: "Test finding",
		filePath: "src/test.ts",
		lineStart: 1,
		commitSha: "a".repeat(40),
		discoveredAt: "2026-02-25T00:00:00Z",
		...overrides,
	};
}

describe("tierAllowsAuto", () => {
	it("allows low tier when max is low", () => {
		expect(tierAllowsAuto("low", "low")).toBe(true);
	});

	it("allows low tier when max is medium", () => {
		expect(tierAllowsAuto("low", "medium")).toBe(true);
	});

	it("allows low tier when max is high", () => {
		expect(tierAllowsAuto("low", "high")).toBe(true);
	});

	it("allows medium tier when max is medium", () => {
		expect(tierAllowsAuto("medium", "medium")).toBe(true);
	});

	it("allows medium tier when max is high", () => {
		expect(tierAllowsAuto("medium", "high")).toBe(true);
	});

	it("allows high tier when max is high", () => {
		expect(tierAllowsAuto("high", "high")).toBe(true);
	});

	it("rejects medium tier when max is low", () => {
		expect(tierAllowsAuto("medium", "low")).toBe(false);
	});

	it("rejects high tier when max is low", () => {
		expect(tierAllowsAuto("high", "low")).toBe(false);
	});

	it("rejects high tier when max is medium", () => {
		expect(tierAllowsAuto("high", "medium")).toBe(false);
	});

	// P1 FIX: Fail closed for unknown severities
	it("rejects unknown severity tier (fail closed)", () => {
		expect(tierAllowsAuto("unknown" as RemediationSeverity, "medium")).toBe(
			false,
		);
	});

	it("rejects when max tier is unknown (fail closed)", () => {
		expect(tierAllowsAuto("low", "unknown" as RemediationAutoTier)).toBe(false);
	});

	it("rejects when both tiers are unknown (fail closed)", () => {
		expect(
			tierAllowsAuto(
				"unknown" as RemediationSeverity,
				"unknown" as RemediationAutoTier,
			),
		).toBe(false);
	});
});

describe("RemediationOrchestrator", () => {
	describe("ancestry handling", () => {
		it("skips stale findings (SHA not in ancestry)", async () => {
			const headSha = "b".repeat(40);
			const staleSha = "a".repeat(40);

			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(false),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ commitSha: staleSha })],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(0);
				expect(result.output.skipped).toHaveLength(1);
				expect(result.output.skipped[0]?.reason).toBe(
					"Finding commit aaaaaaa does not match HEAD bbbbbbb (strict SHA-only policy)",
				);
			}
		});

		it("processes findings on HEAD (no ancestry check needed)", async () => {
			const headSha = "b".repeat(40);

			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ commitSha: headSha })],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(1);
				expect(result.output.skipped).toHaveLength(0);
				// Should not call isAncestor for HEAD SHA
				expect(mockGithub.isAncestor).not.toHaveBeenCalled();
			}
		});

		it("skips findings when commit is not HEAD SHA (strict SHA-only)", async () => {
			const headSha = "b".repeat(40);
			const ancestorSha = "a".repeat(40);

			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ commitSha: ancestorSha })],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Strict SHA-only: ancestor SHA !== HEAD SHA means skip
				expect(result.output.actions).toHaveLength(0);
				expect(result.output.skipped).toHaveLength(1);
				expect(result.output.skipped[0]?.reason).toContain(
					"does not match HEAD",
				);
			}
		});
	});

	describe("tier-based actions", () => {
		it("commits low severity findings (codeql allows medium)", async () => {
			const headSha = "a".repeat(40);
			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ severity: "low", commitSha: headSha })],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(1);
				expect(result.output.actions[0]?.type).toBe("commit");
				expect(result.output.actions[0]?.dryRun).toBe(false);
			}
		});

		it("commits medium severity findings (codeql allows medium)", async () => {
			const headSha = "a".repeat(40);
			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({
							severity: "medium",
							commitSha: headSha,
						}),
					],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(1);
				expect(result.output.actions[0]?.type).toBe("commit");
			}
		});

		it("produces requires_human action for high severity findings (codeql max is medium)", async () => {
			const headSha = "a".repeat(40);
			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({
							severity: "high",
							commitSha: headSha,
						}),
					],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Phase 2: high-severity produces requires_human action, not skip
				expect(result.output.actions).toHaveLength(1);
				expect(result.output.actions[0]?.type).toBe("requires_human");
				expect(result.output.actions[0]?.reason).toContain(
					"requires human review",
				);
				expect(result.output.skipped).toHaveLength(0);
			}
		});

		it("applies dry run mode from provider defaults (codex)", async () => {
			const headSha = "a".repeat(40);
			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({
							provider: "codex",
							severity: "low",
							commitSha: headSha,
						}),
					],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(1);
				expect(result.output.actions[0]?.dryRun).toBe(true);
				expect(result.output.actions[0]?.type).toBe("skip");
			}
		});

		it("respects explicit dryRun option", async () => {
			const headSha = "a".repeat(40);
			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({
							provider: "codeql",
							severity: "low",
							commitSha: headSha,
						}),
					],
					dryRun: true,
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(1);
				expect(result.output.actions[0]?.dryRun).toBe(true);
			}
		});

		it("skips findings for unconfigured providers", async () => {
			const headSha = "a".repeat(40);
			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({
							provider: "unknown" as "codeql",
							commitSha: headSha,
						}),
					],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(0);
				expect(result.output.skipped).toHaveLength(1);
				expect(result.output.skipped[0]?.reason).toContain(
					"No policy configured",
				);
			}
		});
	});

	describe("TOCTOU race detection", () => {
		// P1 FIX: Test verifies multiple TOCTOU checkpoints
		it("uses fresh HEAD from checkpoint 1 (not input)", async () => {
			const staleInputSha = "a".repeat(40);
			const actualHeadSha = "b".repeat(40);
			const findingSha = "c".repeat(40);

			// Mock returns different SHA at checkpoint 1 (actual current HEAD)
			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(actualHeadSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			// Finding's SHA is different from both input and actual HEAD
			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ commitSha: findingSha })],
					headSha: staleInputSha, // This stale input is ignored
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			// Should succeed - uses fresh HEAD from checkpoint 1, not stale input
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Strict SHA-only: finding SHA !== actualHeadSha means skipped
				expect(result.output.actions).toHaveLength(0);
				expect(result.output.skipped).toHaveLength(1);
				expect(result.output.skipped[0]?.reason).toContain(
					"does not match HEAD",
				);
				// No longer calls isAncestor with strict SHA-only filtering
				expect(mockGithub.isAncestor).not.toHaveBeenCalled();
			}
		});

		it("detects TOCTOU race condition at checkpoint 2 (mid-processing)", async () => {
			const headSha = "a".repeat(40);
			const newSha = "b".repeat(40);

			// Mock returns same SHA for first call, different on second (checkpoint 2)
			const mockGithub: GitHubClient = {
				getHeadSha: vi
					.fn()
					.mockResolvedValueOnce(headSha) // Checkpoint 1: same
					.mockResolvedValueOnce(newSha), // Checkpoint 2: different!
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ commitSha: headSha })],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_RACE_DETECTED");
				expect(result.error.message).toContain("mid-processing");
				expect(result.error.context?.initialHead).toBe(headSha);
				expect(result.error.context?.currentHead).toBe(newSha);
			}
		});

		it("detects TOCTOU race condition at checkpoint 3 (final)", async () => {
			const headSha = "a".repeat(40);
			const newSha = "b".repeat(40);

			// Mock returns same SHA for first two calls, different on third (checkpoint 3)
			const mockGithub: GitHubClient = {
				getHeadSha: vi
					.fn()
					.mockResolvedValueOnce(headSha) // Checkpoint 1: same
					.mockResolvedValueOnce(headSha) // Checkpoint 2: same
					.mockResolvedValueOnce(newSha), // Checkpoint 3: different!
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ commitSha: headSha })],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_RACE_DETECTED");
				expect(result.error.message).toContain("during remediation");
				expect(result.error.context?.initialHead).toBe(headSha);
				expect(result.error.context?.currentHead).toBe(newSha);
			}
		});

		it("succeeds when HEAD is stable throughout all checkpoints", async () => {
			const headSha = "a".repeat(40);

			// All 3 calls return the same SHA
			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ commitSha: headSha })],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(1);
			}
		});
	});

	describe("batching and performance", () => {
		// Phase 2: Ancestry batching removed - strict SHA-only filtering
		it("does not call isAncestor with strict SHA-only filtering", async () => {
			const headSha = "h".repeat(40);
			const sha1 = "a".repeat(40);
			const sha2 = "b".repeat(40);

			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			// Findings with non-HEAD SHAs should be skipped
			const findings: CanonicalFinding[] = [
				makeFinding({ id: "f1", commitSha: sha1 }),
				makeFinding({ id: "f2", commitSha: sha2 }),
				makeFinding({ id: "f3", commitSha: headSha }),
			];

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings,
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			// isAncestor should never be called with strict SHA-only
			expect(mockGithub.isAncestor).not.toHaveBeenCalled();
			if (result.ok) {
				expect(result.output.findingsProcessed).toBe(3);
				expect(result.output.actions).toHaveLength(1); // Only f3 matches HEAD
				expect(result.output.skipped).toHaveLength(2); // f1, f2 don't match HEAD
			}
		});

		it("reports cache hits for HEAD SHA findings", async () => {
			const headSha = "h".repeat(40);

			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({ commitSha: headSha }),
						makeFinding({ id: "f2", commitSha: headSha }),
					],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.telemetry?.cacheHits).toBe(2);
				expect(result.output.telemetry?.apiCalls).toBe(3); // 3 getHeadSha calls
			}
		});
	});

	describe("without GitHub client", () => {
		it("processes all findings without ancestry checks", async () => {
			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding({ id: "f1" }), makeFinding({ id: "f2" })],
					headSha: "a".repeat(40),
				},
				null,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(2);
				expect(result.output.skipped).toHaveLength(0);
				expect(result.output.telemetry?.apiCalls).toBe(0);
			}
		});

		it("uses input headSha when no GitHub client", async () => {
			const headSha = "a".repeat(40);
			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [makeFinding()],
					headSha,
				},
				null,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			// No GitHub client means no TOCTOU checks, just proceeds
			if (result.ok) {
				expect(result.output.telemetry?.apiCalls).toBe(0);
			}
		});
	});

	describe("telemetry", () => {
		it("reports correct telemetry data", async () => {
			const headSha = "h".repeat(40);
			const otherSha = "o".repeat(40);

			const mockGithub: GitHubClient = {
				getHeadSha: vi.fn().mockResolvedValue(headSha),
				isAncestor: vi.fn().mockResolvedValue(true),
			};

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({ commitSha: headSha }),
						makeFinding({ id: "f2", commitSha: otherSha }),
					],
					headSha,
				},
				mockGithub,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.telemetry).toBeDefined();
				expect(result.output.telemetry?.apiCalls).toBe(3); // 3 getHeadSha (strict SHA-only)
				expect(result.output.telemetry?.cacheHits).toBe(1); // One finding matched HEAD SHA
			}
		});
	});

	// === Phase 2: Strict SHA-only filtering ===
	describe("strict SHA-only filtering (Phase 2)", () => {
		it("only processes findings bound to exact HEAD SHA", async () => {
			const headSha = "h".repeat(40);
			const otherSha = "o".repeat(40);

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({ id: "f1", commitSha: headSha }),
						makeFinding({ id: "f2", commitSha: otherSha }),
					],
					headSha,
				},
				null,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(1);
				expect(result.output.actions[0]?.findingId).toBe("f1");
				expect(result.output.skipped).toHaveLength(1);
				expect(result.output.skipped[0]?.findingId).toBe("f2");
				expect(result.output.skipped[0]?.reason).toContain(
					"does not match HEAD",
				);
			}
		});
	});

	// === Phase 2: High-risk human mediation ===
	describe("high-risk human mediation (Phase 2)", () => {
		it("produces requires_human action for high-severity findings", async () => {
			const headSha = "a".repeat(40);

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({ id: "f1", severity: "high", commitSha: headSha }),
					],
					headSha,
				},
				null,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(1);
				expect(result.output.actions[0]?.type).toBe("requires_human");
				expect(result.output.actions[0]?.reason).toContain(
					"requires human review",
				);
			}
		});

		it("does not add high-severity to skipped list", async () => {
			const headSha = "a".repeat(40);

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({ id: "f1", severity: "high", commitSha: headSha }),
					],
					headSha,
				},
				null,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.skipped).toHaveLength(0);
				expect(result.output.actions).toHaveLength(1);
			}
		});

		it("auto-applies low and medium severity findings", async () => {
			const headSha = "a".repeat(40);

			const orchestrator = new RemediationOrchestrator(
				{
					policy: mockPolicy,
					findings: [
						makeFinding({ id: "f1", severity: "low", commitSha: headSha }),
						makeFinding({ id: "f2", severity: "medium", commitSha: headSha }),
					],
					headSha,
				},
				null,
			);

			const result = await orchestrator.remediate();

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.actions).toHaveLength(2);
				expect(result.output.actions.every((a) => a.type === "commit")).toBe(
					true,
				);
			}
		});
	});
});
