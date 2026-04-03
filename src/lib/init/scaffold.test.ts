import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	TEMPLATES,
	createTemplateRenderContext,
	getTemplatesForProvider,
} from "./scaffold.js";

describe("scaffold templates resolution", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("includes .coderabbit.yaml by default", () => {
		const templates = getTemplatesForProvider("circleci");
		expect(
			templates.some((template) => template.path === ".coderabbit.yaml"),
		).toBe(true);
	});

	it("includes codestyle contract templates by default", () => {
		const templates = getTemplatesForProvider("circleci");

		expect(templates.some((template) => template.path === "CODESTYLE.md")).toBe(
			true,
		);
		expect(
			templates.some(
				(template) => template.path === "scripts/validate-codestyle.sh",
			),
		).toBe(true);
	});

	it("never includes legacy .greptile templates", () => {
		const templates = getTemplatesForProvider("circleci");
		const legacyTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		expect(legacyTemplates.length).toBe(0);
	});

	it("omits non-essential templates when minimal mode is enabled", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			minimal: true,
		});
		const legacyTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		const codeownersTemplates = templates.filter((t) =>
			t.path.includes("CODEOWNERS"),
		);

		expect(legacyTemplates.length).toBe(0);
		expect(codeownersTemplates.length).toBe(0);

		// Minimal mode keeps provider workflows but still reduces the managed set.
		expect(templates.length).toBeLessThan(
			getTemplatesForProvider("circleci").length,
		);
	});

	it("includes issue tracker templates when explicitly set to github", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			issueTracker: "github",
		});
		const issueTemplates = templates.filter((t) =>
			t.path.includes("ISSUE_TEMPLATE"),
		);
		expect(issueTemplates.length).toBeGreaterThan(0);
	});

	it("omits issue tracker templates when explicitly set to none", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			issueTracker: "none",
		});
		const issueTemplates = templates.filter((t) =>
			t.path.includes("ISSUE_TEMPLATE"),
		);
		expect(issueTemplates.length).toBe(0);
	});

	it("omits linear issue tracking policy when tracker is github", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "https://github.com/brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(
			tempDir,
			"circleci",
			undefined,
			{
				dryRun: false,
				force: false,
				issueTracker: "github",
			},
		);
		const contractTemplate = TEMPLATES.find(
			(template) => template.path === "harness.contract.json",
		);

		expect(contractTemplate).toBeDefined();
		const rendered = JSON.parse(contractTemplate!.render("pnpm", context));

		expect(rendered.issueTrackingPolicy).toBeUndefined();
	});

	it("keeps linear issue tracking policy by default", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "https://github.com/brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(tempDir, "circleci");
		const contractTemplate = TEMPLATES.find(
			(template) => template.path === "harness.contract.json",
		);

		expect(contractTemplate).toBeDefined();
		const rendered = JSON.parse(contractTemplate!.render("pnpm", context));

		expect(rendered.issueTrackingPolicy?.provider).toBe("linear");
	});

	it("omits the linear contact link when tracker mode is github", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "https://github.com/brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(
			tempDir,
			"circleci",
			undefined,
			{
				dryRun: false,
				force: false,
				issueTracker: "github",
			},
		);
		const configTemplate = TEMPLATES.find(
			(template) => template.path === ".github/ISSUE_TEMPLATE/config.yml",
		);

		expect(configTemplate).toBeDefined();
		const rendered = configTemplate!.render("pnpm", context);

		expect(rendered).not.toContain("Linear work intake");
		expect(rendered).toContain("Repository docs");
		expect(rendered).toContain("Private security disclosure");
	});

	it("normalizes ssh repository URLs for issue-template docs links", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "git@github.com:brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(
			tempDir,
			"circleci",
			undefined,
			{
				dryRun: false,
				force: false,
				issueTracker: "github",
			},
		);
		const configTemplate = TEMPLATES.find(
			(template) => template.path === ".github/ISSUE_TEMPLATE/config.yml",
		);

		expect(configTemplate).toBeDefined();
		const rendered = configTemplate!.render("pnpm", context);

		expect(rendered).toContain(
			"url: https://github.com/brainwav/coding-harness#readme",
		);
		expect(rendered).not.toContain("git@github.com:");
	});
});
