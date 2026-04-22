import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_CONTEXT_INTEGRITY_POLICY,
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
} from "../lib/contract/types.js";
import {
	EXIT_CODES,
	runContextHealth,
	runContextHealthCLI,
} from "./context-health.js";

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

function minimalValidContract(overrides: Record<string, unknown> = {}) {
	return {
		version: "1.5.0",
		northStar: {
			mission:
				"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
			primaryMetric: NORTH_STAR_PRIMARY_METRIC,
			primaryBottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
			autonomyBoundary:
				"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
			safetyFloor: [
				"deterministic evidence",
				"strict current-head SHA discipline",
			],
			nonGoals: ["policy surface area as proxy progress"],
			decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map((question) => ({
				id: question.id,
				prompt: question.prompt,
			})),
		},
		productSurface: {
			surfaces: [
				{
					surfaceId: "context-health",
					surfaceType: "command",
					class: "core",
					owner: "workflow",
					northStarContribution:
						"Keeps context integrity measurable along the PR lead-time path.",
					manualGlueReductionClaim:
						"Automates integrity checks that were previously manual.",
					reliabilityContribution:
						"Produces deterministic context-health reports for governance checks.",
					evidenceReference: "src/commands/context-health.ts",
					ownedPaths: ["src/commands/context-health.ts"],
					lastReviewedAt: "2026-04-21",
				},
			],
		},
		overrideReviewerRegistry: {
			trustedReviewers: [
				{
					reviewerId: "jamie-craik",
					reviewerType: "user",
					signatureRef: "refs/reviewers/jamie-craik",
					displayName: "Jamie Craik",
					status: "active",
				},
			],
		},
		...overrides,
	};
}

describe("context-health command", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) {
			rmSync(root, { recursive: true, force: true });
		}
		roots.length = 0;
	});

	it("writes a current-checkout report with non-null coverage metrics", () => {
		const root = join(process.cwd(), "artifacts", "context-health-test-1");
		roots.push(root);

		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				minimalValidContract({
					contextIntegrityPolicy: DEFAULT_CONTEXT_INTEGRITY_POLICY,
				}),
				null,
				2,
			),
		);
		write(join(root, "README.md"), "# README\n");
		write(join(root, "AGENTS.md"), "# AGENTS\n");
		write(join(root, "CONTRIBUTING.md"), "# CONTRIBUTING\n");
		write(join(root, "CLAUDE.md"), "# CLAUDE\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "docs/agents/00-architecture-bootstrap.md"),
			"# Bootstrap\n",
		);
		write(
			join(root, ".memory-metrics.json"),
			JSON.stringify({ current: { unresolved_questions: 2 } }, null, 2),
		);

		const result = runContextHealth({
			baseDir: root,
			triggerType: "current_checkout",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.report.status).toBe("ok");
		expect(result.report.metrics.authoritative_coverage_rate.value).toBe(0.75);
		expect(
			result.report.metrics.authoritative_coverage_rate.insufficient_evidence,
		).toBe(false);
		expect(result.report.metrics.memory_unresolved_question_count).toBe(2);
		expect(
			result.report.artifactRefs.map((artifactRef) => artifactRef.type),
		).toEqual(
			expect.arrayContaining([
				"context_index_inventory",
				"memory_metrics_snapshot",
			]),
		);
	});

	it("reads persisted artifacts in recent-artifacts mode", () => {
		const root = join(process.cwd(), "artifacts", "context-health-test-2");
		roots.push(root);

		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				minimalValidContract({
					contextIntegrityPolicy: DEFAULT_CONTEXT_INTEGRITY_POLICY,
				}),
				null,
				2,
			),
		);
		write(
			join(root, "artifacts/context-integrity/index-source-inventory.json"),
			JSON.stringify(
				{
					schemaVersion: "context-source-inventory/v1",
					generatedAt: new Date().toISOString(),
					summary: {
						sourceCount: 1,
						authoritativeSourceCount: 1,
						supportingSourceCount: 0,
						documentCount: 1,
						indexedDocumentCount: 1,
					},
					sources: [
						{
							id: "readme",
							path: "README.md",
							kind: "file",
							authority: "canonical",
							exists: true,
							documentCount: 1,
							indexedDocumentCount: 1,
							stalenessState: "unknown",
							documentPaths: ["README.md"],
						},
					],
				},
				null,
				2,
			),
		);
		write(
			join(root, "artifacts/context-integrity/memory-metrics-snapshot.json"),
			JSON.stringify(
				{
					schemaVersion: "memory-metrics-snapshot/v1",
					generatedAt: new Date().toISOString(),
					sourcePath: ".memory-metrics.json",
					unresolvedQuestionCount: 4,
					raw: { current: { unresolved_questions: 4 } },
				},
				null,
				2,
			),
		);
		write(
			join(root, "artifacts/context-integrity/contradiction-history.jsonl"),
			[
				JSON.stringify({
					findingId: "open-1",
					category: "command_contract_conflict",
					status: "open",
					message: "README uses npm",
					sourcePaths: ["README.md"],
					detectedAt: new Date().toISOString(),
				}),
				JSON.stringify({
					findingId: "resolved-1",
					category: "required_check_conflict",
					status: "resolved",
					message: "Workflow check restored",
					sourcePaths: [".github/workflows/pr-pipeline.yml"],
					detectedAt: new Date().toISOString(),
					resolvedAt: new Date().toISOString(),
				}),
			].join("\n"),
		);

		const result = runContextHealth({
			baseDir: root,
			triggerType: "recent_artifacts",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.report.metrics.authoritative_coverage_rate.value).toBe(1);
		expect(result.report.metrics.contradiction_open_count).toBe(1);
		expect(result.report.metrics.memory_unresolved_question_count).toBe(4);
		expect(result.report.metrics.decision_consistency_proxy.value).toBeNull();
		expect(
			result.report.metrics.decision_consistency_proxy.insufficient_evidence,
		).toBe(true);
	});

	it("returns bootstrap-gap exit code when contextIntegrityPolicy is missing", () => {
		const root = join(process.cwd(), "artifacts", "context-health-test-3");
		roots.push(root);

		write(
			join(root, "harness.contract.json"),
			JSON.stringify({ version: "1.5.0" }, null, 2),
		);

		const result = runContextHealth({ baseDir: root });

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.exitCode).toBe(EXIT_CODES.BOOTSTRAP_GAP);
	});

	it("supports CLI JSON output", () => {
		const root = join(process.cwd(), "artifacts", "context-health-test-4");
		roots.push(root);

		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				minimalValidContract({
					contextIntegrityPolicy: DEFAULT_CONTEXT_INTEGRITY_POLICY,
				}),
				null,
				2,
			),
		);
		write(join(root, "README.md"), "# README\n");
		write(join(root, "AGENTS.md"), "# AGENTS\n");
		write(join(root, "CONTRIBUTING.md"), "# CONTRIBUTING\n");
		write(join(root, "CLAUDE.md"), "# CLAUDE\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "docs/agents/00-architecture-bootstrap.md"),
			"# Bootstrap\n",
		);

		const cwd = process.cwd();
		process.chdir(root);
		try {
			const exitCode = runContextHealthCLI(["--json"]);
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
			const report = JSON.parse(
				readFileSync(
					join(root, "artifacts/context-integrity/context-health-report.json"),
					"utf-8",
				),
			) as { command: string };
			expect(report.command).toBe("context-health");
		} finally {
			process.chdir(cwd);
		}
	});
});
