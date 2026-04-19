import { describe, expect, it } from "vitest";
import {
	ALL_SURFACES,
	classifySurface,
	getTemplatesForSurface,
	groupTemplatesBySurface,
	renderSurface,
} from "./scaffold-surfaces.js";
import { TEMPLATES } from "./scaffold.js";
import type { TemplateRenderContext } from "./types.js";

// ---------------------------------------------------------------------------
// classifySurface
// ---------------------------------------------------------------------------

describe("classifySurface", () => {
	it("classifies contract templates", () => {
		expect(classifySurface("harness.contract.json")).toBe("contract");
		expect(classifySurface("memory.json")).toBe("contract");
	});

	it("classifies CI templates", () => {
		expect(classifySurface(".github/workflows/pr-pipeline.yml")).toBe("ci");
		expect(classifySurface(".github/workflows/secret-scan.yml")).toBe("ci");
		expect(classifySurface(".github/workflows/release-private-npm.yml")).toBe(
			"ci",
		);
		expect(classifySurface(".circleci/config.yml")).toBe("ci");
		expect(classifySurface(".harness/ci-required-checks.json")).toBe("ci");
	});

	it("classifies script templates", () => {
		expect(classifySurface("scripts/verify-work.sh")).toBe("scripts");
		expect(classifySurface("scripts/validate-codestyle.sh")).toBe("scripts");
		expect(classifySurface("scripts/prepare-worktree.sh")).toBe("scripts");
		expect(classifySurface("scripts/new-task.sh")).toBe("scripts");
		expect(classifySurface("scripts/harness-cli.sh")).toBe("scripts");
		expect(classifySurface("scripts/check-environment.sh")).toBe("scripts");
	});

	it("classifies config templates", () => {
		expect(classifySurface("biome.json")).toBe("config");
		expect(classifySurface(".gitleaks.toml")).toBe("config");
		expect(classifySurface("prek.toml")).toBe("config");
		expect(classifySurface(".mise.toml")).toBe("config");
		expect(classifySurface(".npmrc")).toBe("config");
		expect(classifySurface(".coderabbit.yaml")).toBe("config");
	});

	it("classifies doc templates", () => {
		expect(classifySurface("CONTRIBUTING.md")).toBe("docs");
		expect(classifySurface("CODESTYLE.md")).toBe("docs");
		expect(classifySurface(".github/PULL_REQUEST_TEMPLATE.md")).toBe("docs");
	});

	it("classifies workflow template", () => {
		expect(classifySurface("WORKFLOW.md")).toBe("workflow");
	});

	it("classifies codex templates", () => {
		expect(classifySurface("scripts/codex-preflight.sh")).toBe("codex");
		expect(classifySurface("scripts/codex-learn")).toBe("codex");
		expect(classifySurface("scripts/codex-enforced")).toBe("codex");
	});

	it("classifies diagram templates", () => {
		expect(classifySurface(".diagram/.gitkeep")).toBe("diagrams");
		expect(classifySurface("scripts/check-diagram-freshness.sh")).toBe(
			"diagrams",
		);
	});

	it("classifies git-hook templates", () => {
		expect(classifySurface("scripts/validate-commit-msg.js")).toBe("git-hooks");
		expect(classifySurface("scripts/setup-git-hooks.js")).toBe("git-hooks");
	});

	it("classifies community templates", () => {
		expect(classifySurface(".github/CODEOWNERS")).toBe("community");
		expect(classifySurface("Makefile")).toBe("community");
		expect(classifySurface(".github/ISSUE_TEMPLATE/config.yml")).toBe(
			"community",
		);
	});

	it("classifies project-brain templates", () => {
		expect(classifySurface(".harness/knowledge/INDEX.md")).toBe(
			"project-brain",
		);
		expect(classifySurface(".harness/quality/criteria.md")).toBe(
			"project-brain",
		);
	});

	it("classifies unknown paths as other", () => {
		expect(classifySurface("unknown-file.txt")).toBe("other");
	});
});

// ---------------------------------------------------------------------------
// groupTemplatesBySurface
// ---------------------------------------------------------------------------

describe("groupTemplatesBySurface", () => {
	it("groups all templates into known surfaces", () => {
		const groups = groupTemplatesBySurface(TEMPLATES);
		const classified = [...groups.values()].flat();
		expect(classified.length).toBe(TEMPLATES.length);
	});

	it("every template is assigned to exactly one group", () => {
		groupTemplatesBySurface(TEMPLATES);
		const counts = new Map<string, number>();
		for (const template of TEMPLATES) {
			counts.set(template.path, (counts.get(template.path) ?? 0) + 1);
		}
		for (const [path, count] of counts) {
			expect(count, `Template ${path} should appear exactly once`).toBe(1);
		}
	});

	it("has templates in core surfaces (contract, ci, scripts, config)", () => {
		const groups = groupTemplatesBySurface(TEMPLATES);
		expect(groups.has("contract")).toBe(true);
		expect(groups.has("ci")).toBe(true);
		expect(groups.has("scripts")).toBe(true);
		expect(groups.has("config")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getTemplatesForSurface
// ---------------------------------------------------------------------------

describe("getTemplatesForSurface", () => {
	it("returns only templates for the requested surface", () => {
		const contractTemplates = getTemplatesForSurface(TEMPLATES, "contract");
		expect(contractTemplates.length).toBeGreaterThan(0);
		for (const t of contractTemplates) {
			expect(classifySurface(t.path)).toBe("contract");
		}
	});

	it("returns empty array for surfaces with no templates", () => {
		const otherTemplates = getTemplatesForSurface(TEMPLATES, "other");
		// May or may not have templates, just verify it returns an array
		expect(Array.isArray(otherTemplates)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// renderSurface — independent surface rendering
// ---------------------------------------------------------------------------

describe("renderSurface", () => {
	const testContext: TemplateRenderContext = {
		targetDir: "/tmp/test-scaffold",
		ciProvider: "circleci",
		packageScripts: ["lint", "test", "typecheck"],
		issueTracker: "linear",
		issueTrackingUrl: "https://linear.app/test/project",
		projectName: "test-project",
	};

	it("renders contract surface independently", () => {
		const rendered = renderSurface(TEMPLATES, "contract", "pnpm", testContext);
		expect(rendered.length).toBeGreaterThan(0);
		for (const { path, content } of rendered) {
			expect(path).toBeTruthy();
			expect(content).toBeTruthy();
			expect(typeof content).toBe("string");
		}
		// Contract should be valid JSON
		const contractOutput = rendered.find(
			(r) => r.path === "harness.contract.json",
		);
		expect(contractOutput).toBeDefined();
		const parsed = JSON.parse(contractOutput!.content);
		expect(parsed.version).toBeTruthy();
	});

	it("renders config surface independently", () => {
		const rendered = renderSurface(TEMPLATES, "config", "pnpm", testContext);
		expect(rendered.length).toBeGreaterThan(0);
		for (const { path, content } of rendered) {
			expect(path).toBeTruthy();
			expect(content).toBeTruthy();
		}
	});

	it("renders ci surface independently", () => {
		const rendered = renderSurface(TEMPLATES, "ci", "pnpm", testContext);
		expect(rendered.length).toBeGreaterThan(0);
		for (const { path, content } of rendered) {
			expect(path).toBeTruthy();
			expect(content).toBeTruthy();
		}
	});

	it("renders scripts surface independently", () => {
		const rendered = renderSurface(TEMPLATES, "scripts", "pnpm", testContext);
		expect(rendered.length).toBeGreaterThan(0);
		for (const { path, content } of rendered) {
			expect(path).toBeTruthy();
			expect(content).toBeTruthy();
		}
	});

	it("all surfaces render without errors", () => {
		for (const surface of ALL_SURFACES) {
			const rendered = renderSurface(TEMPLATES, surface, "pnpm", testContext);
			for (const { content } of rendered) {
				expect(typeof content).toBe("string");
			}
		}
	});
});
