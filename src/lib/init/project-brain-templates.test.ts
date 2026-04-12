import { describe, expect, it } from "vitest";
import { PROJECT_BRAIN_TEMPLATES } from "./project-brain-templates.js";
import type { TemplateRenderContext } from "./types.js";

const BASE_CONTEXT: TemplateRenderContext = {
	targetDir: "/tmp/repo",
	packageScripts: [],
};

function renderTemplate(path: string): string {
	const template = PROJECT_BRAIN_TEMPLATES.find(
		(candidate) => candidate.path === path,
	);
	if (!template) {
		throw new Error(`Missing template for path: ${path}`);
	}
	return template.render("pnpm", BASE_CONTEXT);
}

describe("project brain templates", () => {
	it("exposes the expected project brain scaffold paths", () => {
		expect(PROJECT_BRAIN_TEMPLATES.map((template) => template.path)).toEqual([
			".harness/memory/LEARNINGS.md",
			".harness/knowledge/INDEX.md",
			".harness/knowledge/cli/knowledge.md",
			".harness/knowledge/cli/hypotheses.md",
			".harness/knowledge/cli/rules.md",
			".harness/knowledge/ci/knowledge.md",
			".harness/knowledge/ci/hypotheses.md",
			".harness/knowledge/ci/rules.md",
			".harness/knowledge/governance/knowledge.md",
			".harness/knowledge/governance/hypotheses.md",
			".harness/knowledge/governance/rules.md",
			".harness/knowledge/tooling/knowledge.md",
			".harness/knowledge/tooling/hypotheses.md",
			".harness/knowledge/tooling/rules.md",
			".harness/knowledge/tooling/codex-learn-summary.md",
			".harness/decisions/.gitkeep",
			".harness/quality/criteria.md",
			".harness/review-log.md",
		]);
	});

	it("renders domain index and domain-specific templates", () => {
		const indexTemplate = renderTemplate(".harness/knowledge/INDEX.md");
		const cliKnowledge = renderTemplate(".harness/knowledge/cli/knowledge.md");
		const governanceHypotheses = renderTemplate(
			".harness/knowledge/governance/hypotheses.md",
		);
		const toolingRules = renderTemplate(".harness/knowledge/tooling/rules.md");

		expect(indexTemplate).toContain(
			"| [cli](./cli/) | Command surfaces, flags, and operator workflows.",
		);
		expect(indexTemplate).toContain(
			"| [tooling](./tooling/) | Bootstrap scripts, preflight rules, and local runtime contracts.",
		);
		expect(cliKnowledge).toContain("# CLI Knowledge");
		expect(governanceHypotheses).toContain("# Governance Hypotheses");
		expect(toolingRules).toContain("# Tooling Rules");
		expect(toolingRules).toContain("**Rule count:** 0");
	});

	it("renders project brain support artifacts", () => {
		const learnings = renderTemplate(".harness/memory/LEARNINGS.md");
		const codexLearnSummary = renderTemplate(
			".harness/knowledge/tooling/codex-learn-summary.md",
		);
		const qualityCriteria = renderTemplate(".harness/quality/criteria.md");
		const reviewLog = renderTemplate(".harness/review-log.md");

		expect(learnings).toContain("schema_version: 1");
		expect(learnings).toContain(
			"Repo-specific agent knowledge base. Append-only.",
		);
		expect(codexLearnSummary).toContain(
			"This file is maintained by `./scripts/codex-learn analyze`.",
		);
		expect(qualityCriteria).toContain("### Reliability");
		expect(qualityCriteria).toContain("### Security");
		expect(qualityCriteria).toContain("### Testing");
		expect(reviewLog).toContain("Suggested cadence: every 2 weeks");
	});
});
