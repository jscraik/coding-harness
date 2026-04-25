import { describe, expect, it } from "vitest";
import {
	renderChangelogTemplate,
	renderCodeRabbitTemplate,
	renderCodeownersTemplate,
	renderIssueTemplateConfig,
} from "./scaffold-governance-templates.js";

describe("governance scaffold templates", () => {
	it("renders Linear-backed issue intake with docs and security links", () => {
		const config = renderIssueTemplateConfig({
			targetDir: "/tmp/example",
			packageScripts: [],
			issueTracker: "linear",
			issueTrackingUrl: "https://linear.app/example",
			repoUrl: "https://github.com/example/repo.git",
			securityEmail: "security@example.test",
		});

		expect(config).toContain("blank_issues_enabled: false");
		expect(config).toContain("name: Linear work intake");
		expect(config).toContain("url: https://linear.app/example");
		expect(config).toContain("url: https://github.com/example/repo#readme");
		expect(config).toContain("url: mailto:security@example.test");
	});

	it("omits Linear intake when GitHub issues own tracking", () => {
		const config = renderIssueTemplateConfig({
			targetDir: "/tmp/example",
			packageScripts: [],
			issueTracker: "github",
			securityEmail: "security@example.test",
		});

		expect(config).not.toContain("Linear work intake");
		expect(config).toContain("Private security disclosure");
	});

	it("loads CodeRabbit review configuration", () => {
		const config = renderCodeRabbitTemplate();

		expect(config).toContain("reviews:");
		expect(config).toContain("path_filters:");
	});

	it("renders release and ownership starter templates", () => {
		const changelog = renderChangelogTemplate();
		const codeowners = renderCodeownersTemplate();

		expect(changelog).toContain("# Changelog");
		expect(changelog).toContain("Keep a Changelog");
		expect(codeowners).toContain("# Governance-sensitive surfaces");
		expect(codeowners).toContain("/.github/workflows/** @jscraik");
		expect(codeowners).toContain("/codestyle/** @jscraik");
	});
});
