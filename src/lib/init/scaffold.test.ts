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

	it("includes .greptile by default", () => {
		const templates = getTemplatesForProvider("circleci");
		const greptileTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		expect(greptileTemplates.length).toBeGreaterThan(0);
	});

	it("omits .greptile when greptile option is explicitly false", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			greptile: false,
		});
		const greptileTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		expect(greptileTemplates.length).toBe(0);
	});

	it("omits .greptile and non-essential templates when minimal mode is enabled", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			minimal: true,
		});
		const greptileTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		const codeownersTemplates = templates.filter((t) =>
			t.path.includes("CODEOWNERS"),
		);

		expect(greptileTemplates.length).toBe(0);
		expect(codeownersTemplates.length).toBe(0);

		// .github/workflows/pr-pipeline.yml is omitted in minimal mode
		// Let's just check `.github` related stuff except issue templates which are removed
		// We expect strict reduction in templates
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
			JSON.stringify({ name: "demo" }),
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
			JSON.stringify({ name: "demo" }),
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
			JSON.stringify({ name: "demo" }),
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
});
