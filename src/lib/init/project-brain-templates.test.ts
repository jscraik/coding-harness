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
			".harness/README.md",
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
		expect(indexTemplate).toContain("**Last updated:**");
		expect(cliKnowledge).toContain("# CLI Knowledge");
		expect(cliKnowledge).toContain("**Last verified:**");
		expect(cliKnowledge).toContain("**Confidence:** medium");
		expect(governanceHypotheses).toContain("# Governance Hypotheses");
		expect(governanceHypotheses).toContain(
			"Unconfirmed patterns under observation",
		);
		expect(toolingRules).toContain("# Tooling Rules");
		expect(toolingRules).toContain("**Rule count:** 0");
		expect(toolingRules).toContain("Promotion guide");
	});

	it("renders templates without forbidden placeholder patterns", () => {
		const forbiddenPatterns = [
			/\{describe\s+focus\}/i,
			/\{specify\}/i,
			/\{describe\s+\w+\}/i,
		];
		const allowedPlaceholders = [
			"(not yet)",
			"(none currently)",
			"(no reviews yet)",
			"No active hypotheses",
			"No rules promoted yet",
			"No activity recorded yet",
		];

		for (const template of PROJECT_BRAIN_TEMPLATES) {
			const rendered = template.render("pnpm", BASE_CONTEXT);
			for (const pattern of forbiddenPatterns) {
				expect(
					pattern.test(rendered),
					`Template ${template.path} contains forbidden placeholder: ${pattern.source}`,
				).toBe(false);
			}
			// Verify (none yet) is not used — replaced with descriptive text
			const noneYetCount = (rendered.match(/\(none yet\)/g) || []).length;
			expect(
				noneYetCount,
				`Template ${template.path} still uses (none yet) — use descriptive text instead`,
			).toBe(0);
		}

		// Verify at least some templates contain allowed placeholder text
		const allRendered = PROJECT_BRAIN_TEMPLATES.map((t) =>
			t.render("pnpm", BASE_CONTEXT),
		).join("\n");
		const hasAllowedPlaceholder = allowedPlaceholders.some((p) =>
			allRendered.includes(p),
		);
		expect(hasAllowedPlaceholder).toBe(true);
	});

	it("renders project brain support artifacts", () => {
		const harnessReadme = renderTemplate(".harness/README.md");
		const learnings = renderTemplate(".harness/memory/LEARNINGS.md");
		const codexLearnSummary = renderTemplate(
			".harness/knowledge/tooling/codex-learn-summary.md",
		);
		const qualityCriteria = renderTemplate(".harness/quality/criteria.md");
		const reviewLog = renderTemplate(".harness/review-log.md");

		expect(harnessReadme).toContain("Track curated Markdown and JSON");
		expect(harnessReadme).toContain("secondary-context");
		expect(harnessReadme).toContain("Admission Rule");
		expect(learnings).toContain("schema_version: 1");
		expect(learnings).toContain(
			"Repo-specific agent knowledge base. Append-only.",
		);
		expect(codexLearnSummary).toContain(
			"This file is maintained by `./scripts/codex-learn analyze`.",
		);
		expect(qualityCriteria).toContain("### API Design");
		expect(qualityCriteria).toContain("### Testing");
		expect(qualityCriteria).toContain("Q-001");
		expect(qualityCriteria).toContain("**Project domain:** CLI tool");
		expect(reviewLog).toContain("Suggested cadence: every 2 weeks");
		expect(reviewLog).toContain(
			"| Date | Reviewer | Scope | Findings | Actions |",
		);
	});
});
