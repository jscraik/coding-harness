import { describe, expect, it } from "vitest";
import {
	classifyEvidenceReference,
	validateDurableEvidenceMap,
} from "./evidence-reference.js";

describe("evidence reference durability", () => {
	it("classifies ignored local artifact paths separately from tracked receipts", () => {
		expect(classifyEvidenceReference("artifacts/reviews/agent.md")).toBe(
			"ignored_local_path",
		);
		expect(
			classifyEvidenceReference(
				"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
			),
		).toBe("evidence_receipt_ref");
	});

	it("classifies only specific GitHub PR comment anchors as PR-comment evidence", () => {
		expect(
			classifyEvidenceReference(
				"https://github.com/jscraik/coding-harness/pull/309",
			),
		).toBe("unknown");
		expect(
			classifyEvidenceReference(
				"https://github.com/jscraik/coding-harness/pull/309#issuecomment-123",
			),
		).toBe("github_pr_comment");
		expect(
			classifyEvidenceReference(
				"https://github.com/jscraik/coding-harness/pull/309#discussion_r123",
			),
		).toBe("github_pr_comment");
	});

	it("rejects local-only review artifacts without a durable mirror", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap: "artifacts/reviews/agent.md",
			reviewArtifacts: "Codex: artifacts/reviews/agent.md",
		});

		expect(result.localOnlyReferences).toEqual(["artifacts/reviews/agent.md"]);
		expect(result.errors).toContain(
			"Durable evidence map must pair ignored local artifact paths with a tracked receipt, runtime card, PR comment, GitHub check, or CI artifact URL.",
		);
	});

	it("accepts local-only review artifacts when a tracked receipt mirrors them", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap:
				"ignored-local artifacts/reviews/agent.md -> tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113; schema/version: workflow-closeout/v1; producer command: pnpm-review-agent; digest: sha256:1234567890abcdef; replay command: pnpm-review-agent-replay; authority: retained context",
			reviewArtifacts: "Codex: artifacts/reviews/agent.md",
		});

		expect(result.errors).toEqual([]);
		expect(result.durableReferences).toContain(
			"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
		);
	});

	it("accepts table-form durable evidence map entries with compact evidence columns", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap:
				"| artifacts/reviews/agent.md | docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113 | review-artifact/v1 | pnpm-review-agent | sha256:1234567890abcdef | pnpm-review-agent-replay | retained context |",
			reviewArtifacts: "Codex: artifacts/reviews/agent.md",
		});

		expect(result.errors).toEqual([]);
		expect(result.durableReferences).toContain(
			"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
		);
	});

	it("rejects n.a. digests for local artifact evidence-map entries", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap:
				"ignored-local artifacts/reviews/agent.md -> tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113; schema/version: workflow-closeout/v1; producer command: pnpm-review-agent; digest: n.a.; replay command: n.a.; authority: retained context",
			reviewArtifacts: "Codex: artifacts/reviews/agent.md",
		});

		expect(result.errors).toContain(
			"Durable evidence map entry for artifacts/reviews/agent.md must include schema/version, producer command, digest, replay command, and authority (`source-of-truth` or `retained context`); missing: digest.",
		);
	});

	it("rejects tracked source paths as durable mirrors for local artifacts", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap:
				"ignored-local artifacts/run.json -> src/lib/foo.ts; schema/version: run/v1; producer command: pnpm x; digest: sha256:1234567890abcdef; replay command: pnpm x; authority: retained context",
			reviewArtifacts: "Codex: artifacts/run.json",
		});

		expect(result.durableReferences).toEqual([]);
		expect(result.errors).toContain(
			"Durable evidence map must pair local-only artifact reference artifacts/run.json with durable evidence on the same map entry.",
		);
		expect(result.errors).toContain(
			"Durable evidence map must pair ignored local artifact paths with a tracked receipt, runtime card, PR comment, GitHub check, or CI artifact URL.",
		);
	});

	it("rejects map-only local artifacts without durable evidence", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap:
				"artifacts/run.json; schema/version: run/v1; producer command: pnpm x; digest: sha256:1234567890abcdef; replay command: pnpm x; authority: retained context",
			reviewArtifacts:
				"CodeRabbit: https://github.com/jscraik/coding-harness/pull/309#issuecomment-1",
		});

		expect(result.errors).toContain(
			"Durable evidence map must pair local-only artifact reference artifacts/run.json with durable evidence on the same map entry.",
		);
		expect(result.errors).toContain(
			"Durable evidence map must pair ignored local artifact paths with a tracked receipt, runtime card, PR comment, GitHub check, or CI artifact URL.",
		);
	});

	it("rejects substring aliases instead of exact local artifact mappings", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap:
				"ignored-local artifacts/reviews/agent.md.old -> tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113",
			reviewArtifacts: "Codex: artifacts/reviews/agent.md",
		});

		expect(result.errors).toContain(
			"Durable evidence map must pair local-only artifact reference artifacts/reviews/agent.md with durable evidence on the same map entry.",
		);
	});

	it("requires each local artifact to be paired with durable evidence on its own entry", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap:
				"ignored-local artifacts/reviews/agent.md -> tracked receipt docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R113; schema/version: workflow-closeout/v1; producer command: pnpm-review-agent; digest: sha256:1234567890abcdef; replay command: pnpm-review-agent-replay; authority: retained context\nignored-local artifacts/reviews/adversarial.md -> local note only",
			reviewArtifacts:
				"Codex: artifacts/reviews/agent.md\nAdversarial: artifacts/reviews/adversarial.md",
		});

		expect(result.errors).toContain(
			"Durable evidence map must pair local-only artifact reference artifacts/reviews/adversarial.md with durable evidence on the same map entry.",
		);
	});

	it("accepts n.a. only when review artifacts do not cite ignored local paths", () => {
		const result = validateDurableEvidenceMap({
			durableEvidenceMap:
				"n.a. because this PR has no external review artifacts",
			reviewArtifacts:
				"CodeRabbit: https://github.com/jscraik/coding-harness/pull/309#issuecomment-1",
		});

		expect(result.errors).toEqual([]);
	});
});
