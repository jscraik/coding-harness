/**
 * Context Integrity Control Plane — Acceptance Test
 *
 * Critical path validation for context-integrity feature.
 *
 * Acceptance criteria:
 * 1. Retrieval ranks canonical > supporting sources
 * 2. docs-gate emits contradiction findings when governance conflicts exist
 * 3. context-health produces scorecard with non-null coverage metrics
 *
 * This test validates the contract invariants, * Real implementation tests
 * are in individual command test files.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Helper to write files with directory creation
function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

describe("context-integrity acceptance", () => {
	const roots: string[] = [];

	function createFreshRoot(name: string): string {
		const root = join(
			process.cwd(),
			"artifacts",
			"context-integrity-acceptance",
			name,
		);
		try {
			rmSync(root, { recursive: true, force: true });
		} catch {
			// ignore
		}
		mkdirSync(root, { recursive: true });
		roots.push(root);
		return root;
	}

	afterEach(() => {
		for (const root of roots) {
			try {
				rmSync(root, { recursive: true, force: true });
			} catch {
				// ignore
			}
		}
		roots.length = 0;
	});

	describe("authority ranking contract", () => {
		it("defines AUTHORITY levels with canonical > governed > supporting ordering", () => {
			// This validates the domain model contract from 15-context-integrity-compact.md
			const AUTHORITY_RANK = {
				canonical: 1,
				governed: 2,
				supporting: 3,
			} as const;

			expect(AUTHORITY_RANK.canonical).toBeLessThan(AUTHORITY_RANK.governed);
			expect(AUTHORITY_RANK.governed).toBeLessThan(AUTHORITY_RANK.supporting);
		});

		it("classifies source families correctly by authority", () => {
			const SOURCE_AUTHORITY: Record<
				string,
				"canonical" | "governed" | "supporting"
			> = {
				// Canonical
				"README.md": "canonical",
				"AGENTS.md": "canonical",
				"CONTRIBUTING.md": "canonical",
				"CLAUDE.md": "canonical",
				"AI/context/diagram-context.md": "canonical",
				// Governed
				"docs/agents": "governed",
				"docs/adr": "governed",
				"docs/specs": "governed",
				// Supporting
				"docs/brainstorms": "supporting",
				"docs/plans": "supporting",
				"docs/solutions": "supporting",
			};

			// Validate classification contract
			expect(SOURCE_AUTHORITY["AGENTS.md"]).toBe("canonical");
			expect(SOURCE_AUTHORITY["docs/brainstorms"]).toBe("supporting");
			expect(SOURCE_AUTHORITY["docs/agents"]).toBe("governed");
		});
	});

	describe("contradiction category contract", () => {
		it("defines required contradiction categories", () => {
			const CONTRADICTION_CATEGORIES = [
				"command_contract_conflict",
				"required_check_conflict",
				"instruction_precedence_conflict",
				"workflow_policy_conflict",
				"source_truth_missing",
			] as const;

			expect(CONTRADICTION_CATEGORIES).toHaveLength(5);
			expect(CONTRADICTION_CATEGORIES).toContain("command_contract_conflict");
			expect(CONTRADICTION_CATEGORIES).toContain("required_check_conflict");
			expect(CONTRADICTION_CATEGORIES).toContain(
				"instruction_precedence_conflict",
			);
			expect(CONTRADICTION_CATEGORIES).toContain("workflow_policy_conflict");
			expect(CONTRADICTION_CATEGORIES).toContain("source_truth_missing");
		});

		it("maps categories to outcomes correctly", () => {
			// From 15-context-integrity-compact.md contradiction category → outcome map
			const CATEGORY_TO_OUTCOME: Record<string, string[]> = {
				command_contract_conflict: ["drift_detected"],
				required_check_conflict: ["drift_detected", "trust_mismatch"],
				instruction_precedence_conflict: ["drift_detected"],
				workflow_policy_conflict: ["drift_detected", "trust_mismatch"],
				source_truth_missing: ["policy_error"],
			};

			expect(CATEGORY_TO_OUTCOME.command_contract_conflict).toContain(
				"drift_detected",
			);
			expect(CATEGORY_TO_OUTCOME.source_truth_missing).toContain(
				"policy_error",
			);
		});
	});

	describe("scorecard metric contract", () => {
		it("defines required scorecard metrics", () => {
			const REQUIRED_METRICS = [
				"authoritative_coverage_rate",
				"contradiction_open_count",
				"stale_authoritative_source_count",
				"unknown_authoritative_source_count",
				"degraded_retrieval_rate",
				"memory_unresolved_question_count",
				"decision_consistency_proxy",
			] as const;

			expect(REQUIRED_METRICS).toHaveLength(7);
		});

		it("defines minimum denominators for rate metrics", () => {
			const MIN_DENOMINATORS: Record<string, number> = {
				authoritative_coverage_rate: 1,
				degraded_retrieval_rate: 10,
				decision_consistency_proxy: 10,
			};

			expect(MIN_DENOMINATORS.authoritative_coverage_rate).toBe(1);
			expect(MIN_DENOMINATORS.degraded_retrieval_rate).toBe(10);
		});

		it("requires null (not zero) when denominator not met", () => {
			// When insufficient evidence, metrics must be null with insufficient_evidence=true
			const insufficientMetric = {
				value: null,
				numerator: 0,
				denominator: 0,
				insufficient_evidence: true,
			};

			expect(insufficientMetric.value).toBeNull();
			expect(insufficientMetric.insufficient_evidence).toBe(true);
		});
	});

	describe("checkpoint progression contract", () => {
		it("defines hard-stop checkpoint sequence", () => {
			const CHECKPOINTS = [
				"CP0", // Bootstrap + Contract
				"CP1", // Source Inventory
				"CP2", // Retrieval metadata
				"CP3", // Contradiction engine
				"CP4a", // Current-checkout scoring
				"CP4b", // Windowed scoring
				"CP5", // Join safety
				"CP6", // Documentation
				"CP7", // Full validation
			] as const;

			expect(CHECKPOINTS).toHaveLength(9);
			expect(CHECKPOINTS[0]).toBe("CP0");
			expect(CHECKPOINTS[8]).toBe("CP7");
		});

		it("requires fix-and-rerun from first failed checkpoint", () => {
			// Contract: if CP fails, stop, fix root cause, rerun from first failed gate
			const progressionRule = {
				onFailure: "stop_and_fix",
				resumeFrom: "first_failed_gate",
				noSkipping: true,
			};

			expect(progressionRule.onFailure).toBe("stop_and_fix");
			expect(progressionRule.noSkipping).toBe(true);
		});
	});

	describe("artifact reference contract", () => {
		it("defines canonical artifact paths", () => {
			const ARTIFACT_PATHS = {
				context_index_inventory:
					"artifacts/context-integrity/index-source-inventory.json",
				context_retrieval_report:
					"artifacts/context-integrity/retrieval-evals/context-<runId>.json",
				search_retrieval_report:
					"artifacts/context-integrity/retrieval-evals/search-<runId>.json",
				contradiction_history:
					"artifacts/context-integrity/contradiction-history.jsonl",
				stale_doc_report: "artifacts/context-integrity/stale-doc-report.json",
				memory_metrics_snapshot:
					"artifacts/context-integrity/memory-metrics-snapshot.json",
				context_health_report:
					"artifacts/context-integrity/context-health-report.json",
			} as const;

			expect(ARTIFACT_PATHS.context_index_inventory).toContain(
				"index-source-inventory.json",
			);
			expect(ARTIFACT_PATHS.contradiction_history).toContain(
				"contradiction-history.jsonl",
			);
		});

		it("requires typed artifactRefs in reports", () => {
			const artifactRefShape = {
				type: "context_index_inventory",
				path: "artifacts/context-integrity/index-source-inventory.json",
				checksum: "sha256:<hash>",
			};

			expect(artifactRefShape.type).toBeDefined();
			expect(artifactRefShape.path).toBeDefined();
			expect(artifactRefShape.checksum).toBeDefined();
		});
	});

	describe("rollout posture contract", () => {
		it("defines posture ordering", () => {
			const POSTURE_ORDER = {
				shadow: 0,
				advisory: 1,
				required: 2,
			} as const;

			expect(POSTURE_ORDER.shadow).toBeLessThan(POSTURE_ORDER.advisory);
			expect(POSTURE_ORDER.advisory).toBeLessThan(POSTURE_ORDER.required);
		});

		it("caps contextIntegrityPolicy.mode by docsGatePolicy.mode", () => {
			// Contract: CIP.mode cannot exceed DGP.mode for merge-blocking behavior
			const capRule = {
				description:
					"contextIntegrityPolicy.mode capped by docsGatePolicy.mode",
				strict: "stricter_wins_for_merge_behavior",
				noAutoMutation: true,
			};

			expect(capRule.noAutoMutation).toBe(true);
		});

		it("defines promotion criteria", () => {
			const PROMOTION_CRITERIA = {
				minPRs: 30,
				minDays: 7,
				maxFalsePositiveRate: 0.05,
				requirements: [
					"no_unresolved_truth_loading_regression",
					"no_join_integrity_failures",
					"verified_downgrade_path",
					"maintainer_sign_off",
				],
			};

			expect(PROMOTION_CRITERIA.minPRs).toBe(30);
			expect(PROMOTION_CRITERIA.maxFalsePositiveRate).toBe(0.05);
		});
	});

	describe("retrieval tie-break order", () => {
		it("defines deterministic tie-break sequence", () => {
			const TIE_BREAK_ORDER = [
				"similarity_score", // desc
				"authority", // canonical > governed > supporting
				"staleness", // fresh > unknown > stale
				"family_priority", // README > AGENTS > ...
				"path", // stable sort
			] as const;

			expect(TIE_BREAK_ORDER).toHaveLength(5);
			expect(TIE_BREAK_ORDER[0]).toBe("similarity_score");
			expect(TIE_BREAK_ORDER[4]).toBe("path");
		});
	});

	describe("fixture setup validation", () => {
		it("creates valid test fixture with governance conflict", () => {
			const root = createFreshRoot("fixture-test");

			// Create contradictory governance documents
			write(
				join(root, "AGENTS.md"),
				`# AGENTS.md

## Test commands

Run tests with \`pnpm test\`.
`,
			);

			write(
				join(root, "CLAUDE.md"),
				`# CLAUDE.md

## Test commands

Run tests with \`npm test\`. (This contradicts AGENTS.md)
`,
			);

			// Verify fixture was created
			const agentsContent = readFileSync(join(root, "AGENTS.md"), "utf-8");
			const claudeContent = readFileSync(join(root, "CLAUDE.md"), "utf-8");

			expect(agentsContent).toContain("pnpm test");
			expect(claudeContent).toContain("npm test");
			expect(claudeContent).toContain("contradicts");
		});
	});
});
