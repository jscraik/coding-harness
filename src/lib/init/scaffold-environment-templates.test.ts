// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated scripts.
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderCheckEnvironmentScript } from "./scaffold-environment-templates.js";

function expectBashSyntax(name: string, script: string): void {
	const tempDir = mkdtempSync(join(tmpdir(), "scaffold-environment-template-"));
	const scriptPath = join(tempDir, name);
	writeFileSync(scriptPath, script);
	try {
		const result = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
		expect(result.status, result.stderr || result.stdout).toBe(0);
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

describe("scaffold environment templates", () => {
	it("renders the strict local environment preflight script", () => {
		const script = renderCheckEnvironmentScript();

		expect(script).toMatch(/^#!\/usr\/bin\/env bash/);
		expect(script).toContain("set -euo pipefail");
		expect(script).toContain(
			'CONTRACT_PATH="$REPO_ROOT/harness.contract.json"',
		);
		expect(script).toContain('MISE_PATH="$REPO_ROOT/.mise.toml"');
		expect(script).toContain(
			'CODEX_ENVIRONMENT_PATH="$REPO_ROOT/.codex/environments/environment.toml"',
		);
		expect(script).toContain("required_project_brain_paths=(");
		expect(script).toContain("prepend_standard_tool_paths()");
		expect(script).toContain("CHECK_ENVIRONMENT_REEXECED");
		expect(script).toContain('"/opt/homebrew/bin"');
		expect(script).toContain('"/usr/sbin"');
		expect(script).toContain("required_mise_tools=(");
		expect(script).toContain("required_prek_hooks=(");
		expect(script).toContain("required_package_scripts=(");
		expect(script).toContain(
			"coding-policy:route|node scripts/validate-coding-policy.cjs --json --changed-files",
		);
		expect(script).toContain(
			"coding-policy:validate|node scripts/validate-coding-policy.cjs",
		);
		expect(script).toContain("run_check_environment_with_runner()");
		expect(script).toContain('if [[ -f "$PACKAGE_JSON_PATH" ]]; then');
		expect(script).toContain("Fix: run harness init --update");
		expect(script).toContain("Fix: pnpm add -D $pkg");
		expect(script).toContain(
			"repo source CLI (mise exec -- node --import tsx src/cli.ts)",
		);
		expect(script).toContain(
			'mise --cd "$REPO_ROOT" exec -- node --import tsx "$REPO_ROOT/src/cli.ts"',
		);
		expect(script).toContain(
			'installed_hooks_dir="$(git -C "$REPO_ROOT" rev-parse --git-path hooks 2>/dev/null || true)"',
		);
		expect(script).toContain('MISE_TRUST_REPO_PATH="$REPO_ROOT"');
		expect(script).toContain(
			'rg --fixed-strings --line-regexp --quiet "$MISE_TRUST_REPO_PATH: trusted"',
		);
		expect(script).not.toContain("MISE_TRUST_LINE_COUNT");
		expect(script).toContain(
			"for hook_name in pre-commit pre-push commit-msg; do",
		);
		expect(script).toContain("/^\\[\\[repos\\.hooks\\]\\]/");
		expect(script).toContain("missing worktree-local PREK_HOME patch");
		expect(script).toContain(
			'WORKTREE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
		);
		expect(script).toContain('PREK_HOME="$WORKTREE_ROOT/.cache/prek"');
		expect(script).toContain(
			"printf 'Fix: ensure the session activates mise first",
		);
		expect(script).toContain("public npm package (npm exec)");
		expect(script).toContain(
			"npm exec --yes --registry=https://registry.npmjs.org/ --package @brainwav/coding-harness@latest -- harness",
		);
		expect(script).toContain(
			'if [[ "${HARNESS_CLI_ALLOW_NPM_EXEC:-0}" == "1" ]]',
		);
		expect(script.indexOf("public npm package (npm exec)")).toBeLessThan(
			script.indexOf("npm auth is missing in this process"),
		);
	});

	it("preserves runner fallback order from repo wrapper to public npm", () => {
		const script = renderCheckEnvironmentScript();

		const wrapperIndex = script.indexOf("repo wrapper");
		const sourceIndex = script.indexOf(
			"repo source CLI (mise exec -- node --import tsx src/cli.ts)",
		);
		const distIndex = script.indexOf("repo dist CLI");
		const miseIndex = script.indexOf("mise harness");
		const globalIndex = script.indexOf("global npm harness");
		const publicIndex = script.indexOf("public npm package (npm exec)");

		expect(wrapperIndex).toBeGreaterThan(-1);
		expect(sourceIndex).toBeGreaterThan(-1);
		expect(sourceIndex).toBeGreaterThan(wrapperIndex);
		expect(distIndex).toBeGreaterThan(sourceIndex);
		expect(miseIndex).toBeGreaterThan(distIndex);
		expect(globalIndex).toBeGreaterThan(miseIndex);
		expect(publicIndex).toBeGreaterThan(globalIndex);
	});

	it("fails closed when the opt-in public npm fallback command fails", () => {
		const tempDir = mkdtempSync(
			join(tmpdir(), "harness-public-fallback-failure-"),
		);
		try {
			const fakeBin = join(tempDir, ".fake-bin");
			const argsPath = join(tempDir, "npm-args.log");
			const rendered = renderCheckEnvironmentScript();
			const runnerStart = rendered.indexOf(
				"run_check_environment_with_runner() {",
			);
			const selectionStart = rendered.indexOf(
				'if [[ -r "$REPO_ROOT/scripts/harness-cli.sh" ]]',
			);
			const selectionEnd = rendered.indexOf(
				"\njq -e '.passed == true' \"$ATTESTATION_PATH\"",
				selectionStart,
			);
			expect(runnerStart).toBeGreaterThan(-1);
			expect(selectionStart).toBeGreaterThan(runnerStart);
			expect(selectionEnd).toBeGreaterThan(selectionStart);

			mkdirSync(fakeBin, { recursive: true });
			const fakeNpmPath = join(fakeBin, "npm");
			writeFileSync(
				fakeNpmPath,
				`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "prefix" ]]; then
  exit 0
fi
if [[ "\${1:-}" == "exec" ]]; then
  printf '%s\\n' "$*" > "\${HARNESS_NPM_ARGS_FILE:?}"
  echo "simulated public npm failure" >&2
  exit 42
fi
exit 43
`,
				"utf8",
			);
			chmodSync(fakeNpmPath, 0o755);
			const fakeMisePath = join(fakeBin, "mise");
			writeFileSync(fakeMisePath, "#!/usr/bin/env bash\nexit 1\n", "utf8");
			chmodSync(fakeMisePath, 0o755);

			const scriptPath = join(tempDir, "check-environment.sh");
			writeFileSync(
				scriptPath,
				`#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT=${JSON.stringify(tempDir)}
CONTRACT_PATH="$REPO_ROOT/harness.contract.json"
ATTESTATION_PATH="$REPO_ROOT/artifacts/policy/attestation.json"
${rendered.slice(runnerStart, selectionEnd)}
`,
				"utf8",
			);
			chmodSync(scriptPath, 0o755);
			const result = spawnSync("/bin/bash", [scriptPath], {
				cwd: tempDir,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${fakeBin}:/usr/bin:/bin`,
					HARNESS_CLI_ALLOW_NPM_EXEC: "1",
					HARNESS_NPM_ARGS_FILE: argsPath,
				},
			});

			expect(result.status, `${result.stdout}${result.stderr}`).toBe(1);
			const output = `${result.stdout}${result.stderr}`;
			expect(output).toContain("public npm package (npm exec)");
			expect(output).toContain("public npm fallback failed");
			expect(readFileSync(argsPath, "utf8")).toContain(
				"exec --yes --registry=https://registry.npmjs.org/ --package @brainwav/coding-harness@latest -- harness",
			);
		} finally {
			rmSync(tempDir, { force: true, recursive: true });
		}
	});

	it("renders a check-environment script with valid Bash syntax", () => {
		expectBashSyntax("check-environment.sh", renderCheckEnvironmentScript());
	});

	it("rejects an installed prek hook missing the exact local-cache patch", () => {
		const root = mkdtempSync(join(tmpdir(), "scaffold-environment-hook-"));
		const hooksDir = join(root, "hooks");
		const binDir = join(root, "bin");
		mkdirSync(hooksDir, { recursive: true });
		mkdirSync(binDir, { recursive: true });
		writeFileSync(
			join(binDir, "git"),
			'#!/usr/bin/env bash\nprintf "%s\\n" "$HOOKS_DIR"\n',
		);
		chmodSync(join(binDir, "git"), 0o755);

		const rendered = renderCheckEnvironmentScript();
		const start = rendered.indexOf("\tinstalled_hooks_dir=");
		const end = rendered.indexOf(
			'\n\n\tif [[ -f "$PACKAGE_JSON_PATH" ]]',
			start,
		);
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		const checkPath = join(root, "check-installed-hooks.sh");
		writeFileSync(
			checkPath,
			`#!/usr/bin/env bash\nset -euo pipefail\nREPO_ROOT=${JSON.stringify(root)}\n${rendered.slice(start, end)}\n`,
		);
		chmodSync(checkPath, 0o755);

		const runCheck = () =>
			spawnSync("bash", [checkPath], {
				cwd: root,
				encoding: "utf8",
				env: {
					...process.env,
					HOOKS_DIR: hooksDir,
					PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
				},
			});

		try {
			writeFileSync(
				join(hooksDir, "pre-commit"),
				[
					"# File generated by prek: https://github.com/j178/prek",
					'WORKTREE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
					'PREK_HOME="$WORKTREE_ROOT/.cache/prek"',
				].join("\n"),
			);
			expect(runCheck().status).toBe(0);

			writeFileSync(
				join(hooksDir, "pre-commit"),
				"# File generated by prek: https://github.com/j178/prek\n",
			);
			const failed = runCheck();
			expect(failed.status).toBe(1);
			expect(failed.stdout).toContain("missing worktree-local PREK_HOME patch");
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
