import { describe, expect, it } from "vitest";
import {
	CODEX_AND_WORKFLOW_SCRIPT_TEMPLATES,
	QUALITY_AND_HOOK_SCRIPT_TEMPLATES,
} from "./scaffold-script-template-registry.js";
import type { TemplateRenderContext } from "./types.js";

const renderContext: TemplateRenderContext = {
	targetDir: "/tmp/scaffold-script-template-registry-test",
	packageScripts: ["check", "test:ci"],
};

function paths() {
	return [
		...QUALITY_AND_HOOK_SCRIPT_TEMPLATES,
		...CODEX_AND_WORKFLOW_SCRIPT_TEMPLATES,
	].map((template) => template.path);
}

describe("scaffold script template registry", () => {
	it("groups the script template inventory without changing generated paths", () => {
		expect(paths()).toEqual([
			"scripts/validate-commit-msg.js",
			"scripts/setup-git-hooks.js",
			"scripts/run-prek.sh",
			"scripts/hook-pre-commit.sh",
			"scripts/hook-pre-push.sh",
			"scripts/check-staged-secrets.sh",
			"scripts/check-hook-critical-config-sync.sh",
			"scripts/check-doc-style.sh",
			"scripts/check-related-tests.sh",
			"scripts/check-public-api-docs.mjs",
			"scripts/check-code-size.mjs",
			"scripts/lib/changed-files.mjs",
			"scripts/check-semgrep-changed.sh",
			"scripts/check-semgrep-full.sh",
			"scripts/semgrep-bootstrap.sh",
			"scripts/semgrep-pre-push.yml",
			"scripts/codex-preflight.sh",
			"scripts/codex-preflight-local-memory-legacy.sh",
			"scripts/codex-learn",
			"scripts/codex-enforced",
			"scripts/verify-work.sh",
			"scripts/validate-codestyle.sh",
			"scripts/check-codestyle-parity.sh",
			"scripts/check-git-common-config.sh",
			"scripts/prepare-worktree.sh",
			"scripts/new-task.sh",
			"scripts/harness-cli.sh",
			"scripts/run-harness-gate.sh",
			"scripts/check-environment.sh",
		]);
	});

	it("renders package-manager-sensitive workflow scripts", () => {
		const verifyWork = CODEX_AND_WORKFLOW_SCRIPT_TEMPLATES.find(
			(template) => template.path === "scripts/verify-work.sh",
		);
		const harnessCli = CODEX_AND_WORKFLOW_SCRIPT_TEMPLATES.find(
			(template) => template.path === "scripts/harness-cli.sh",
		);

		expect(verifyWork?.render("pnpm", renderContext)).toContain(
			"scripts/verify-work.sh",
		);
		expect(harnessCli?.render("pnpm", renderContext)).toContain(
			"pnpm exec harness",
		);
	});

	it("renders packaged quality scripts from the canonical root templates", () => {
		const codeSize = QUALITY_AND_HOOK_SCRIPT_TEMPLATES.find(
			(template) => template.path === "scripts/check-code-size.mjs",
		);
		const semgrepChanged = QUALITY_AND_HOOK_SCRIPT_TEMPLATES.find(
			(template) => template.path === "scripts/check-semgrep-changed.sh",
		);

		expect(codeSize?.render("pnpm", renderContext)).toContain(
			"check-code-size",
		);
		expect(semgrepChanged?.render("pnpm", renderContext)).toContain("semgrep");
	});

	it("renders hook adapters from deterministic templates", () => {
		const preCommit = QUALITY_AND_HOOK_SCRIPT_TEMPLATES.find(
			(template) => template.path === "scripts/hook-pre-commit.sh",
		);
		const prePush = QUALITY_AND_HOOK_SCRIPT_TEMPLATES.find(
			(template) => template.path === "scripts/hook-pre-push.sh",
		);

		expect(preCommit?.render("pnpm", renderContext)).toContain(
			"check-hook-critical-config-sync.sh",
		);
		expect(preCommit?.render("npm", renderContext)).toContain("npm run lint");
		expect(prePush?.render("pnpm", renderContext)).toContain(
			"check-validation-locks.sh",
		);
		expect(prePush?.render("npm", renderContext)).toContain("npm run build");
	});
});
