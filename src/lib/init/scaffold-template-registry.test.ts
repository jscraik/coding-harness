import { describe, expect, it } from "vitest";
import {
	TEMPLATES,
	getTemplatesForProvider,
} from "./scaffold-template-registry.js";

describe("scaffold template registry", () => {
	it("owns the root scaffold inventory", () => {
		const paths = TEMPLATES.map((template) => template.path);

		expect(paths).toContain("harness.contract.json");
		expect(paths).toContain("CODESTYLE.md");
		expect(paths).toContain("codestyle/README.md");
		expect(paths).toContain("scripts/codex-preflight.sh");
		expect(paths).toContain("WORKFLOW.md");
	});

	it("applies template selection rules to the root scaffold inventory", () => {
		const circleciPaths = getTemplatesForProvider("circleci").map(
			(template) => template.path,
		);
		const githubActionsPaths = getTemplatesForProvider("github-actions").map(
			(template) => template.path,
		);
		const minimalPaths = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			minimal: true,
		}).map((template) => template.path);
		const noIssueTrackerPaths = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			issueTracker: "none",
		}).map((template) => template.path);

		expect(circleciPaths).toContain(".circleci/config.yml");
		expect(circleciPaths).not.toContain(".github/workflows/pr-pipeline.yml");
		expect(githubActionsPaths).toContain(".github/workflows/pr-pipeline.yml");
		expect(githubActionsPaths).not.toContain(".circleci/config.yml");
		expect(minimalPaths).not.toContain(".harness/ci-required-checks.json");
		expect(noIssueTrackerPaths).not.toContain(
			".github/ISSUE_TEMPLATE/config.yml",
		);
		expect(noIssueTrackerPaths).toContain("harness.contract.json");
	});
});
