import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
	CODESTYLE_PACK_TEMPLATE_FILES,
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
		const codestyleTemplatePaths = templates
			.filter((template) => template.path.startsWith("codestyle/"))
			.map((template) => template.path)
			.sort();
		const checksumTemplatePath = fileURLToPath(
			new URL("../../templates/codestyle/CHECKSUMS.sha256", import.meta.url),
		);
		const checksumManifest = readFileSync(checksumTemplatePath, "utf-8");
		const checksumPathSet = new Set(
			checksumManifest
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0 && !line.startsWith("#"))
				.map((line) => line.match(/^[a-f0-9]{64}\s+(.+)$/))
				.filter((match): match is RegExpMatchArray => match !== null)
				.map((match) => match[1])
				.filter((path) => path !== "codestyle/CHECKSUMS.sha256"),
		);
		const expectedChecksumPathSet = new Set([
			"CODESTYLE.md",
			...CODESTYLE_PACK_TEMPLATE_FILES.filter(
				(path) => path !== "codestyle/CHECKSUMS.sha256",
			),
		]);

		expect(templates.some((template) => template.path === "CODESTYLE.md")).toBe(
			true,
		);
		expect(codestyleTemplatePaths).toEqual(
			[...CODESTYLE_PACK_TEMPLATE_FILES].sort(),
		);

		// Assert that every entry in CODESTYLE_PACK_TEMPLATE_FILES exists in the template list
		for (const expectedFile of CODESTYLE_PACK_TEMPLATE_FILES) {
			expect(templates.some((template) => template.path === expectedFile)).toBe(
				true,
			);
		}
		expect([...checksumPathSet].sort()).toEqual(
			[...expectedChecksumPathSet].sort(),
		);

		expect(
			templates.some(
				(template) => template.path === "scripts/validate-codestyle.sh",
			),
		).toBe(true);
		expect(
			templates.some(
				(template) => template.path === "scripts/check-codestyle-parity.sh",
			),
		).toBe(true);
	});

	it("ships a checked-in CODESTYLE template for source checkouts", () => {
		const packagedTemplatePath = fileURLToPath(
			new URL("../../templates/CODESTYLE.md", import.meta.url),
		);

		expect(existsSync(packagedTemplatePath)).toBe(true);
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

	it("harness-cli.sh wrapper includes fail-fast guidance for local package installs", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				packageManager: "yarn@4.0.0",
			}),
		);

		const context = createTemplateRenderContext(tempDir, "circleci");
		const harnessCliTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/harness-cli.sh",
		);

		expect(harnessCliTemplate).toBeDefined();
		const rendered = harnessCliTemplate!.render("yarn", context);

		// The wrapper should resolve the local node_modules CLI path first.
		expect(rendered).toContain('CLI_PATH="$REPO_ROOT/node_modules/');
		expect(rendered).toContain('if [[ ! -f "$CLI_PATH" ]]; then');
		expect(rendered).toContain('exec node "$CLI_PATH" "$@"');

		// If missing, the wrapper should provide package-manager-specific recovery commands.
		expect(rendered).toContain(
			"local @brainwav/coding-harness could not be resolved",
		);
		expect(rendered).toContain("yarn install");
		expect(rendered).toContain("yarn add --dev @brainwav/coding-harness");
		expect(rendered).toContain("yarn harness");
	});
});
