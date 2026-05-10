import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { TEMPLATES, createTemplateRenderContext } from "./scaffold.js";

function renderTemplate(path: string, targetDir: string): string {
	const template = TEMPLATES.find((candidate) => candidate.path === path);
	if (!template) {
		throw new Error(`Missing scaffold template: ${path}`);
	}
	return template.render(
		"pnpm",
		createTemplateRenderContext(targetDir, "circleci"),
	);
}

describe("scaffold default promotions", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("promotes CodeRabbit learning evidence into generated repo defaults", () => {
		const targetDir = mkdtempSync(join(tmpdir(), "scaffold-defaults-"));
		tempDirs.push(targetDir);

		const npmrc = renderTemplate(".npmrc", targetDir);
		expect(npmrc).toContain("@brainwav:registry=https://registry.npmjs.org/");
		expect(npmrc).toContain("ignore-scripts=true");
		expect(npmrc).not.toMatch(/^\/\/registry\.npmjs\.org\/:_authToken=/m);

		const harnessCli = renderTemplate("scripts/harness-cli.sh", targetDir);
		expect(harnessCli).toContain('CLI_PATH="$REPO_ROOT/node_modules/');
		expect(harnessCli).toContain("pnpm install");
		expect(harnessCli).toContain("pnpm add -D @brainwav/coding-harness");
		expect(harnessCli).toContain("pnpm exec harness <command>");
		expect(harnessCli).toContain("HARNESS_CLI_ALLOW_NPM_EXEC=1");
		expect(harnessCli).toContain("npm auth is missing in this process");
		expect(harnessCli).not.toContain("MODULE_NOT_FOUND");

		const checkEnvironment = renderTemplate(
			"scripts/check-environment.sh",
			targetDir,
		);
		const wrapperIndex = checkEnvironment.indexOf("repo wrapper");
		const miseIndex = checkEnvironment.indexOf("mise harness");
		const globalIndex = checkEnvironment.indexOf("global npm harness");
		expect(wrapperIndex).toBeGreaterThan(-1);
		expect(miseIndex).toBeGreaterThan(wrapperIndex);
		expect(globalIndex).toBeGreaterThan(miseIndex);

		const contract = JSON.parse(
			renderTemplate("harness.contract.json", targetDir),
		);
		expect(contract.toolingPolicy.readinessScriptPath).toBe(
			"scripts/check-environment.sh",
		);
		expect(contract.toolingPolicy.codexEnvironment.path).toBe(
			".codex/environments/environment.toml",
		);
		expect(contract.toolingPolicy.packagePolicy.packageJsonPath).toBe(
			"package.json",
		);

		const codexEnvironment = renderTemplate(
			".codex/environments/environment.toml",
			targetDir,
		);
		expect(codexEnvironment).toContain('name = "Tools"');
		expect(codexEnvironment).toContain(
			"if [[ -f scripts/prepare-worktree.sh ]]; then",
		);
		expect(codexEnvironment).toContain("bash scripts/prepare-worktree.sh");

		const codestyleTemplate = fileURLToPath(
			new URL("../../templates/CODESTYLE.md", import.meta.url),
		);
		const codestyle = renderTemplate("CODESTYLE.md", targetDir);
		expect(codestyle).toContain("# CODESTYLE.md");
		expect(codestyle).toBe(readFileSync(codestyleTemplate, "utf-8"));
	});
});
