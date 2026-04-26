import { describe, expect, it } from "vitest";
import {
	TEMPLATES,
	getTemplatesForProvider,
} from "./scaffold-template-registry.js";
import type { InitOptions } from "./types.js";

const defaultOptions: InitOptions = {
	dryRun: false,
	force: false,
};

function templatePaths(ciProvider: "circleci" | "github-actions") {
	return getTemplatesForProvider(ciProvider).map((template) => template.path);
}

describe("scaffold template registry", () => {
	it("owns the root scaffold inventory", () => {
		const paths = TEMPLATES.map((template) => template.path);

		expect(paths).toContain("harness.contract.json");
		expect(paths).toContain("CODESTYLE.md");
		expect(paths).toContain("codestyle/README.md");
		expect(paths).toContain("scripts/codex-preflight.sh");
		expect(paths).toContain("WORKFLOW.md");
	});

	it("selects provider-specific CI templates", () => {
		const circleciPaths = templatePaths("circleci");
		const githubActionsPaths = templatePaths("github-actions");

		expect(circleciPaths).toContain(".circleci/config.yml");
		expect(circleciPaths).not.toContain(".github/workflows/pr-pipeline.yml");
		expect(githubActionsPaths).toContain(".github/workflows/pr-pipeline.yml");
		expect(githubActionsPaths).not.toContain(".circleci/config.yml");
	});

	it("keeps the release workflow provider-neutral", () => {
		expect(templatePaths("circleci")).toContain(
			".github/workflows/release-private-npm.yml",
		);
		expect(templatePaths("github-actions")).toContain(
			".github/workflows/release-private-npm.yml",
		);
	});

	it("omits governance templates in minimal mode", () => {
		const paths = getTemplatesForProvider("circleci", {
			...defaultOptions,
			minimal: true,
		}).map((template) => template.path);

		expect(paths).not.toContain(".github/CODEOWNERS");
		expect(paths).not.toContain(".harness/ci-required-checks.json");
	});

	it("omits issue templates when issue tracking is disabled", () => {
		const paths = getTemplatesForProvider("circleci", {
			...defaultOptions,
			issueTracker: "none",
		}).map((template) => template.path);

		expect(paths).not.toContain(".github/ISSUE_TEMPLATE/config.yml");
	});
});
