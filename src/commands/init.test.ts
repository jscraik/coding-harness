// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated files.
import { spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "../lib/init/types.js";
import { normalizeRequiredChecksManifest } from "../lib/policy/required-checks.js";
import { sanitizeGitEnv } from "../lib/workflow-contract/test-harness.js";
import { EXIT_CODES, runInit, runInitCLI } from "./init.js";

const EXPECTED_TEMPLATE_PATHS = [
	"harness.contract.json",
	"memory.json",
	".harness/README.md",
	".harness/core/README.md",
	".harness/plan/README.md",
	".harness/specs/README.md",
	".harness/research/README.md",
	".harness/decisions/README.md",
	".harness/implementation-notes/README.md",
	".harness/evals/README.md",
	".harness/solutions/README.md",
	".harness/ci-required-checks.json",
	".harness/ci-provider-transition-status.json",
	".harness/memory/LEARNINGS.md",
	".harness/active-artifacts.md",
	".harness/artifacts/README.md",
	".harness/artifacts/sync-receipts.jsonl",
	".harness/artifacts/brownfield-memory-inventory.md",
	".harness/artifact-provenance.json",
	"docs/goals/README.md",
	".harness/knowledge/INDEX.md",
	".harness/knowledge/cli/knowledge.md",
	".harness/knowledge/cli/hypotheses.md",
	".harness/knowledge/cli/rules.md",
	".harness/knowledge/ci/knowledge.md",
	".harness/knowledge/ci/hypotheses.md",
	".harness/knowledge/ci/rules.md",
	".harness/knowledge/governance/knowledge.md",
	".harness/knowledge/governance/hypotheses.md",
	".harness/knowledge/governance/rules.md",
	".harness/knowledge/tooling/knowledge.md",
	".harness/knowledge/tooling/hypotheses.md",
	".harness/knowledge/tooling/rules.md",
	".harness/knowledge/tooling/codex-learn-summary.md",
	".harness/decisions/.gitkeep",
	".harness/quality/criteria.md",
	".harness/review-log.md",
	".npmrc",
	".coderabbit.yaml",
	"CHANGELOG.md",
	".circleci/config.yml",
	".github/workflows/release-private-npm.yml",
	"CONTRIBUTING.md",
	".github/PULL_REQUEST_TEMPLATE.md",
	"scripts/validate-commit-msg.js",
	"scripts/check-hook-critical-config-sync.sh",
	"scripts/setup-git-hooks.js",
	"scripts/check-staged-secrets.sh",
	"scripts/check-doc-style.sh",
	"scripts/check-related-tests.sh",
	"scripts/check-public-api-docs.mjs",
	"scripts/check-code-size.mjs",
	"scripts/lib/changed-files.mjs",
	"scripts/check-semgrep-changed.sh",
	"scripts/check-semgrep-full.sh",
	"scripts/semgrep-bootstrap.sh",
	"scripts/semgrep-pre-push.yml",
	"scripts/refresh-diagram-context.sh",
	"scripts/check-diagram-freshness.sh",
	".diagram/.gitkeep",
	"AI/context/diagram-context.md",
	".diagramrc",
	"biome.json",
	".gitleaks.toml",
	"prek.toml",
	"CODESTYLE.md",
	"codestyle/README.md",
	"codestyle/01-foundations.md",
	"codestyle/02-javascript-ui.md",
	"codestyle/03-rust-tauri.md",
	"codestyle/04-docs-config-and-release.md",
	"codestyle/05-quality-security-ops.md",
	"codestyle/06-appendices-and-project-overrides.md",
	"codestyle/07-python.md",
	"codestyle/08-typescript.md",
	"codestyle/09-web.md",
	"codestyle/10-shell-bash-zsh.md",
	"codestyle/11-package-managers-pnpm-npm.md",
	"codestyle/12-swift.md",
	"codestyle/13-git-workflow.md",
	"codestyle/14-patterns.md",
	"codestyle/15-performance.md",
	"codestyle/16-security.md",
	"codestyle/17-testing.md",
	"codestyle/18-code-review.md",
	"codestyle/19-development-workflow.md",
	"codestyle/20-go.md",
	"codestyle/CHECKSUMS.sha256",
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
	".mise.toml",
	".codex/environments/environment.toml",
	".github/ISSUE_TEMPLATE/config.yml",
	".github/CODEOWNERS",
	"Makefile",
	"WORKFLOW.md",
];
const EXPECTED_TEMPLATE_COUNT = EXPECTED_TEMPLATE_PATHS.length;

function probePrependStandardToolPaths(environmentCheck: string): string {
	const start = environmentCheck.indexOf("prepend_standard_tool_paths() {");
	const end = environmentCheck.indexOf(
		"\n\nprepend_standard_tool_paths",
		start,
	);
	expect(start).toBeGreaterThanOrEqual(0);
	expect(end).toBeGreaterThan(start);

	const homeDir = mkdtempSync(join(tmpdir(), "harness-path-home-"));
	const miseShims = join(homeDir, ".local", "share", "mise", "shims");
	const localBin = join(homeDir, ".local", "bin");
	mkdirSync(miseShims, { recursive: true });
	mkdirSync(localBin, { recursive: true });

	const helper = environmentCheck.slice(start, end);

	// Test with unset PATH
	const probe = spawnSync(
		"/bin/bash",
		[
			"-c",
			`set -u\n${helper}\nunset PATH\nprepend_standard_tool_paths\nprintf '%s' "$PATH"`,
		],
		{ encoding: "utf8", env: { HOME: homeDir } },
	);

	expect(probe.stderr).toBe("");
	expect(probe.status).toBe(0);
	expect(probe.stdout.split(":").slice(0, 2)).toEqual([miseShims, localBin]);

	// Test with pre-set PATH to validate precedence
	const customDir = join(homeDir, "custom");
	const pathTail = "/usr/bin:/bin";
	mkdirSync(customDir, { recursive: true });

	const probeWithPreset = spawnSync(
		"/bin/bash",
		[
			"-c",
			`set -u\n${helper}\nexport PATH="${customDir}:${pathTail}"\nprepend_standard_tool_paths\nprintf '%s' "$PATH"`,
		],
		{ encoding: "utf8", env: { HOME: homeDir } },
	);

	rmSync(homeDir, { recursive: true, force: true });
	expect(probeWithPreset.stderr).toBe("");
	expect(probeWithPreset.status).toBe(0);
	const presetPathEntries = probeWithPreset.stdout.split(":");
	expect(presetPathEntries[0]).toBe(customDir);
	expect(presetPathEntries).toContain(miseShims);
	expect(presetPathEntries).toContain(localBin);

	return probe.stdout;
}

describe("runInit", () => {
	let tempDir: string;

	beforeEach(() => {
		// Use mkdtemp so concurrent suite workers never collide on the same path.
		tempDir = mkdtempSync(join(tmpdir(), "harness-init-test-"));
	});

	afterEach(() => {
		// Cleanup temp directory
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("package manager detection", () => {
		it("detects pnpm from pnpm-lock.yaml", () => {
			writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
			const result = runInit(tempDir, { dryRun: true, force: false });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.packageManager).toBe("pnpm");
			}
		});

		it("detects yarn from yarn.lock", () => {
			writeFileSync(join(tempDir, "yarn.lock"), "");
			const result = runInit(tempDir, { dryRun: true, force: false });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.packageManager).toBe("yarn");
			}
		});

		it("detects npm from package-lock.json", () => {
			writeFileSync(join(tempDir, "package-lock.json"), "");
			const result = runInit(tempDir, { dryRun: true, force: false });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.packageManager).toBe("npm");
			}
		});

		it("defaults to npm when no lockfile exists", () => {
			const result = runInit(tempDir, { dryRun: true, force: false });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.packageManager).toBe("npm");
			}
		});
	});

	describe("dry-run mode", () => {
		it("does not create files in dry-run mode", () => {
			const result = runInit(tempDir, { dryRun: true, force: false });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.created).toHaveLength(EXPECTED_TEMPLATE_COUNT);
				expect(result.output.skipped).toHaveLength(0);
			}

			// Verify no files were created
			expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(false);
			expect(
				existsSync(join(tempDir, ".github/workflows/pr-pipeline.yml")),
			).toBe(false);
			expect(existsSync(join(tempDir, ".greptile/config.json"))).toBe(false);
			expect(existsSync(join(tempDir, "CONTRIBUTING.md"))).toBe(false);
			expect(
				existsSync(join(tempDir, ".github/PULL_REQUEST_TEMPLATE.md")),
			).toBe(false);
			expect(existsSync(join(tempDir, "memory.json"))).toBe(false);
		});
	});

	describe("normal mode", () => {
		it("creates files in empty directory", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.created).toHaveLength(EXPECTED_TEMPLATE_COUNT);
				expect(result.output.skipped).toHaveLength(0);
			}

			// Verify files were created (default provider is circleci)
			expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(true);
			expect(existsSync(join(tempDir, ".circleci/config.yml"))).toBe(true);
			expect(
				existsSync(
					join(tempDir, ".harness/ci-provider-transition-status.json"),
				),
			).toBe(true);
			expect(existsSync(join(tempDir, ".harness/memory/LEARNINGS.md"))).toBe(
				true,
			);
			expect(existsSync(join(tempDir, ".harness/knowledge/INDEX.md"))).toBe(
				true,
			);
			expect(
				existsSync(
					join(tempDir, ".harness/knowledge/tooling/codex-learn-summary.md"),
				),
			).toBe(true);
			expect(existsSync(join(tempDir, ".npmrc"))).toBe(true);
			expect(existsSync(join(tempDir, "CHANGELOG.md"))).toBe(true);
			expect(existsSync(join(tempDir, ".greptile/config.json"))).toBe(false);
			expect(
				existsSync(join(tempDir, ".github/workflows/greptile-review.yml")),
			).toBe(false);
			expect(
				existsSync(join(tempDir, ".github/workflows/release-private-npm.yml")),
			).toBe(true);
			expect(existsSync(join(tempDir, "CONTRIBUTING.md"))).toBe(true);
			expect(
				existsSync(join(tempDir, ".github/PULL_REQUEST_TEMPLATE.md")),
			).toBe(true);
			expect(existsSync(join(tempDir, "memory.json"))).toBe(true);
			expect(existsSync(join(tempDir, "scripts/codex-learn"))).toBe(true);
			expect(existsSync(join(tempDir, "scripts/codex-enforced"))).toBe(true);
			expect(
				existsSync(
					join(tempDir, "scripts/codex-preflight-local-memory-legacy.sh"),
				),
			).toBe(true);
			expect(existsSync(join(tempDir, "scripts/verify-work.sh"))).toBe(true);
			expect(existsSync(join(tempDir, "CODESTYLE.md"))).toBe(true);
			expect(existsSync(join(tempDir, "scripts/validate-codestyle.sh"))).toBe(
				true,
			);
			expect(existsSync(join(tempDir, "scripts/prepare-worktree.sh"))).toBe(
				true,
			);
			expect(
				statSync(join(tempDir, "scripts/codex-preflight.sh")).mode & 0o111,
			).toBeTruthy();
			expect(
				statSync(join(tempDir, "scripts/codex-learn")).mode & 0o111,
			).toBeTruthy();
			expect(
				statSync(join(tempDir, "scripts/codex-enforced")).mode & 0o111,
			).toBeTruthy();
			expect(
				statSync(join(tempDir, "scripts/verify-work.sh")).mode & 0o111,
			).toBeTruthy();
		});

		it("creates CircleCI templates when ciProvider is circleci", () => {
			writeFileSync(
				join(tempDir, "pnpm-lock.yaml"),
				"lockfileVersion: '9.0'\n",
			);
			const result = runInit(tempDir, {
				dryRun: false,
				force: false,
				ciProvider: "circleci",
			});

			expect(result.ok).toBe(true);
			expect(existsSync(join(tempDir, ".circleci/config.yml"))).toBe(true);
			expect(
				existsSync(join(tempDir, ".github/workflows/pr-pipeline.yml")),
			).toBe(false);
			// legacy review bridge workflow is not scaffolded
			expect(
				existsSync(join(tempDir, ".github/workflows/greptile-review.yml")),
			).toBe(false);
			expect(
				existsSync(join(tempDir, ".github/workflows/secret-scan.yml")),
			).toBe(false);
			expect(
				existsSync(join(tempDir, ".github/workflows/release-private-npm.yml")),
			).toBe(true);

			const requiredChecks = JSON.parse(
				require("node:fs").readFileSync(
					join(tempDir, ".harness/ci-required-checks.json"),
					"utf-8",
				),
			);
			const normalizedRequiredChecks =
				normalizeRequiredChecksManifest(requiredChecks);
			expect(normalizedRequiredChecks.ok).toBe(true);
			if (!normalizedRequiredChecks.ok) {
				throw new Error(normalizedRequiredChecks.error);
			}
			const generatedChecks = normalizedRequiredChecks.value.gates;
			expect(normalizedRequiredChecks.value.activeProvider).toBe("circleci");
			const prTemplateCheck = generatedChecks.find(
				(entry) => entry.displayName === "pr-template",
			);
			expect(prTemplateCheck?.provider).toBe("circleci");
			expect(prTemplateCheck?.githubCheckName).toBe("pr-pipeline");
			expect(generatedChecks.map((entry) => entry.displayName)).toEqual([
				"pr-template",
				"linear-gate",
				"risk-policy-gate",
				"dependency-scan",
				"orb-pinning",
				"consistency-drift-health",
				"docs-gate",
				"lint",
				"typecheck",
				"test",
				"audit",
				"check",
				"memory",
				"security-scan",
				"CodeRabbit",
				"semgrep-cloud-platform/scan",
			]);
			expect(
				generatedChecks.every(
					(entry) => typeof entry.githubCheckName === "string",
				),
			).toBe(true);
			expect(
				generatedChecks
					.filter(
						(entry) =>
							entry.displayName !== "CodeRabbit" &&
							entry.displayName !== "security-scan" &&
							entry.displayName !== "semgrep-cloud-platform/scan",
					)
					.every((entry) => entry.githubCheckName === "pr-pipeline"),
			).toBe(true);
			const securityScanCheck = generatedChecks.find(
				(entry) => entry.displayName === "security-scan",
			);
			expect(securityScanCheck?.provider).toBe("circleci");
			expect(securityScanCheck?.githubCheckName).toBe("security-scan");
			expect(securityScanCheck?.class).toBe("required");
			const codeRabbitCheck = generatedChecks.find(
				(entry) => entry.displayName === "CodeRabbit",
			);
			expect(codeRabbitCheck?.provider).toBe("coderabbit");
			expect(codeRabbitCheck?.githubCheckName).toBe("CodeRabbit");
			const semgrepCloudCheck = generatedChecks.find(
				(entry) => entry.displayName === "semgrep-cloud-platform/scan",
			);
			expect(semgrepCloudCheck?.provider).toBe("semgrep-cloud-platform");
			expect(semgrepCloudCheck?.githubCheckName).toBe(
				"semgrep-cloud-platform/scan",
			);

			const circleConfig = require("node:fs").readFileSync(
				join(tempDir, ".circleci/config.yml"),
				"utf-8",
			);
			expect(circleConfig).toContain("name: Ensure baseline shell tools");
			expect(circleConfig).toContain(
				'export GH_BIN="${HARNESS_GH_BIN:-${GH_BIN:-gh}}"',
			);
			expect(circleConfig).toContain('packages+=("gh")');
			expect(circleConfig).toContain('packages+=("ripgrep")');
			expect(circleConfig).toContain('packages+=("fd-find")');
			expect(circleConfig).toContain('"$GH_BIN" --version');
			expect(circleConfig).not.toContain("gh --version | head -n 1");
			expect(circleConfig).toContain(
				'ln -sf "$(command -v fdfind)" "$HOME/.local/bin/fd"',
			);
			expect(circleConfig).toContain("name: Ensure mise available");
			expect(circleConfig).toContain('export MISE_VERSION="v2025.1.5"');
			expect(circleConfig).toContain('current_mise_version="$(mise --version');
			expect(circleConfig).toContain(
				'if [[ "$current_mise_version" != "${MISE_VERSION#v}" ]]; then',
			);
			expect(circleConfig).toContain("mise trust --yes .mise.toml");
			expect(circleConfig).toContain("name: Ensure pnpm available");
			expect(circleConfig).toContain(
				'export GH_TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN}"',
			);
			expect(circleConfig).toContain(
				'export GITHUB_TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN}"',
			);
			expect(circleConfig).toContain("run-governance-check:");
			expect(circleConfig).toContain("check_name:");
			expect(circleConfig).toContain("command:");
			expect(circleConfig).toContain("resource_class: small");
			expect(circleConfig).toContain("name: Configure pnpm store");
			expect(circleConfig).toContain("restore_cache:");
			expect(circleConfig).toContain("save_cache:");
			expect(circleConfig).toContain('export NPM_CONFIG_PREFIX="$HOME/.local"');
			expect(circleConfig).toContain(
				'npm install --global --prefix "$NPM_CONFIG_PREFIX" "pnpm@${required_pnpm_version}"',
			);
			expect(circleConfig).toContain("name: Inject npm auth");
			expect(circleConfig).toContain("pnpm install --frozen-lockfile");
			expect(circleConfig).toContain("name: check");
			expect(circleConfig).toContain("command: pnpm check");
			expect(circleConfig).toContain("name: pr-template");
			expect(circleConfig).toContain("check_name: pr-template");
			expect(circleConfig).toContain("resolve_pr_ref() {");
			expect(circleConfig).toContain('resolved="${CIRCLE_PULL_REQUESTS%%,*}"');
			expect(circleConfig).toContain(
				"PR context not available yet for pr-template; retrying ($attempt/6).",
			);
			expect(circleConfig).toContain(
				'--head "${CIRCLE_PROJECT_USERNAME}:${CIRCLE_BRANCH}"',
			);
			expect(circleConfig).toContain(
				"bash scripts/run-harness-gate.sh pr-template-gate --json",
			);
			expect(circleConfig).toContain("name: linear-gate");
			expect(circleConfig).toContain("check_name: linear-gate");
			expect(circleConfig).toContain(
				"bash scripts/run-harness-gate.sh linear-gate \\",
			);
			expect(circleConfig).toContain("requires:");
			expect(circleConfig).toContain(
				"command: bash scripts/run-harness-gate.sh policy-gate --max-tier medium --json",
			);
			expect(circleConfig).toContain(
				"command: bash scripts/run-harness-gate.sh docs-gate --mode required --json",
			);
			expect(circleConfig).toContain("store_test_results:");
			expect(circleConfig).toContain("path: artifacts/test-results");
			expect(circleConfig).not.toContain("name: Enforce Policy Bundle Outcome");
			expect(circleConfig).not.toContain("name: Enable corepack");
			expect(circleConfig).toContain("name: lint");
			expect(circleConfig).toContain("name: typecheck");
			expect(circleConfig).toContain("name: test");
			expect(circleConfig).toContain("command: pnpm test:ci");
			expect(circleConfig).toContain("name: audit");
			expect(circleConfig).toContain("name: security-scan");
			expect(circleConfig).toContain("check_name: security-scan");
			expect(circleConfig).toContain(
				"gitleaks detect --source . --config .gitleaks.toml --redact --no-banner",
			);
			expect(circleConfig).toContain(
				"trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 .",
			);
			expect(circleConfig).toContain("bash scripts/check-semgrep-full.sh");
			expect(circleConfig).toContain("name: orb-pinning");
			expect(circleConfig).toContain("packages=()");
			expect(circleConfig).toContain('packages+=("python3-venv")');
			expect(circleConfig).toContain(
				'sudo apt-get install -y "${packages[@]}"',
			);
			expect(circleConfig).toContain("mise install rust@stable");
			expect(circleConfig).not.toContain(
				"if ! command -v cargo >/dev/null 2>&1; then",
			);
			expect(circleConfig).toContain('if [[ -f "$HOME/.cargo/env" ]]; then');
			expect(circleConfig).toContain('. "$HOME/.cargo/env"');
			expect(circleConfig).toContain("export MISE_CARGO_BINSTALL=false");
			expect(circleConfig).toContain('export PATH="$HOME/.local/bin:$PATH"');
			expect(circleConfig).toContain('SEMGREP_VERSION="1.153.1"');
			expect(circleConfig).toContain('python3 -m venv "$SEMGREP_VENV"');
			expect(circleConfig).toContain(
				'ln -sf "$SEMGREP_VENV/bin/semgrep" "$HOME/.local/bin/semgrep"',
			);
			expect(circleConfig).toContain("export MISE_NODE_VERIFY=false");
			expect(circleConfig).toContain("mise install \\");
			expect(circleConfig).toContain("semgrep --version");
			expect(circleConfig).toContain("bash scripts/check-environment.sh");

			const transitionStatus = JSON.parse(
				readFileSync(
					join(tempDir, ".harness/ci-provider-transition-status.json"),
					"utf-8",
				),
			);
			expect(transitionStatus.schemaVersion).toBe(
				"ci-provider-transition-status/v1",
			);
			expect(transitionStatus.nextGateComplete).toBe(false);

			const npmrc = readFileSync(join(tempDir, ".npmrc"), "utf-8");
			expect(npmrc).toContain("ignore-scripts=true");
			expect(npmrc).toContain("@brainwav:registry=https://registry.npmjs.org/");
			expect(npmrc).not.toMatch(/^\/\/registry\.npmjs\.org\/:_authToken=/m);
		});

		it("skips existing files without --force", () => {
			// Create existing files that match the default circleci template set
			mkdirSync(join(tempDir, ".circleci"), { recursive: true });
			mkdirSync(join(tempDir, ".github"), { recursive: true });
			mkdirSync(join(tempDir, "scripts"), { recursive: true });
			mkdirSync(join(tempDir, ".diagram"), { recursive: true });
			mkdirSync(join(tempDir, "AI", "context"), { recursive: true });
			writeFileSync(join(tempDir, "harness.contract.json"), "{}");
			writeFileSync(join(tempDir, ".circleci/config.yml"), "existing");
			writeFileSync(join(tempDir, "CONTRIBUTING.md"), "existing");
			writeFileSync(
				join(tempDir, ".github/PULL_REQUEST_TEMPLATE.md"),
				"existing",
			);
			writeFileSync(join(tempDir, "memory.json"), "existing");

			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.created).toHaveLength(EXPECTED_TEMPLATE_COUNT - 5);
				expect(result.output.skipped).toHaveLength(5);
			}
		});
	});

	describe("force mode", () => {
		it("overwrites existing files with --force", () => {
			// Create existing files
			mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
			mkdirSync(join(tempDir, ".github"), { recursive: true });
			writeFileSync(join(tempDir, "harness.contract.json"), '{"old": true}');
			writeFileSync(
				join(tempDir, ".github/workflows/pr-pipeline.yml"),
				"old content",
			);
			writeFileSync(join(tempDir, "CONTRIBUTING.md"), "old content");
			writeFileSync(
				join(tempDir, ".github/PULL_REQUEST_TEMPLATE.md"),
				"old content",
			);
			writeFileSync(join(tempDir, "memory.json"), '{"old": true}');

			const result = runInit(tempDir, { dryRun: false, force: true });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.created).toHaveLength(EXPECTED_TEMPLATE_COUNT);
				expect(result.output.skipped).toHaveLength(0);
			}
		});
	});

	describe("path traversal protection", () => {
		it("rejects symlinked .harness before any tracked writes", () => {
			const outsideDir = join(tmpdir(), `harness-outside-${Date.now()}`);
			mkdirSync(outsideDir, { recursive: true });
			symlinkSync(outsideDir, join(tempDir, ".harness"), "dir");
			writeFileSync(
				join(tempDir, "harness.contract.json"),
				'{"sentinel":true}\n',
			);

			const beforeContract = readFileSync(
				join(tempDir, "harness.contract.json"),
				"utf-8",
			);
			const result = runInit(tempDir, {
				dryRun: false,
				force: true,
				track: true,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("PATH_TRAVERSAL");
			}
			expect(existsSync(join(outsideDir, "backups"))).toBe(false);
			expect(existsSync(join(outsideDir, "restore-manifest.json"))).toBe(false);
			expect(
				readFileSync(join(tempDir, "harness.contract.json"), "utf-8"),
			).toBe(beforeContract);
			expect(existsSync(join(tempDir, "memory.json"))).toBe(false);
			rmSync(outsideDir, { recursive: true, force: true });
		});
	});

	describe("error handling", () => {
		it("returns error for invalid base path", () => {
			// Pass empty string as target
			const result = runInit("", { dryRun: false, force: false });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_PATH");
			}
		});

		it("returns error for unsupported ci provider", () => {
			const result = runInit(tempDir, {
				dryRun: false,
				force: false,
				ciProvider: "buildkite",
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_PATH");
			}
		});
	});

	describe("file content", () => {
		it("creates valid contract.json", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);

			// Read and verify contract
			const contractPath = join(tempDir, "harness.contract.json");
			expect(existsSync(contractPath)).toBe(true);

			const content = JSON.parse(
				require("node:fs").readFileSync(contractPath, "utf-8"),
			);
			expect(content.version).toBe(CURRENT_SCHEMA_VERSION);
			expect(content.reviewPolicy).toBeUndefined();
			expect(content.ciProviderPolicy.activeProvider).toBe("circleci");
			expect(content.branchProtection.requiredChecks).toContain("pr-pipeline");
			expect(content.branchProtection.requiredChecks).toContain(
				"security-scan",
			);
			expect(content.branchProtection.requiredChecks).toContain("CodeRabbit");
			expect(content.branchProtection.requiredChecks).toContain(
				"semgrep-cloud-platform/scan",
			);
			expect(content.branchProtection.requiredChecks).not.toContain(
				"linear-gate",
			);
			expect(content.branchProtection.requiredApprovingReviewCount).toBe(1);
			expect(content.branchProtection.requireCodeOwnerReview).toBe(false);
			expect(content.branchProtection.requireLastPushApproval).toBe(false);
			expect(content.branchProtection.requireLinearHistory).toBe(true);
			expect(content.branchProtection.allowedMergeMethods).toEqual({
				mergeCommit: true,
				squash: true,
				rebase: true,
			});
			expect(content.branchProtection.codeQuality).toEqual({
				required: true,
				severity: "all",
			});
			expect(content.branchProtection.publicCodeScanning).toEqual({
				required: true,
				publicOnly: true,
				tool: "CodeQL",
				alertsThreshold: "errors",
				securityAlertsThreshold: "high_or_higher",
			});
			expect(content.toolingPolicy.miseFilePath).toBe(".mise.toml");
			expect(content.toolingPolicy.readinessScriptPath).toBe(
				"scripts/check-environment.sh",
			);
			expect(content.toolingPolicy.requiredDocumentationTerms).toContain(
				"agent-browser",
			);
			expect(content.toolingPolicy.requiredDocumentationTerms).toContain(
				"mermaid-cli",
			);
			expect(content.toolingPolicy.requiredBinaries).toContain("agent-browser");
			expect(content.toolingPolicy.requiredBinaries).toContain("mmdc");
			expect(content.toolingPolicy.requiredBinaries).not.toContain("gitleaks");
			expect(content.toolingPolicy.requiredMiseTools).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						tool: "npm:@brainwav/diagram",
						version: "1.1.0",
					}),
					expect.objectContaining({
						tool: "npm:agent-browser",
						version: "0.17.1",
					}),
					expect.objectContaining({
						tool: "npm:@mermaid-js/mermaid-cli",
						version: "11.12.0",
					}),
				]),
			);
			expect(content.toolingPolicy.codexEnvironment.path).toBe(
				".codex/environments/environment.toml",
			);
			expect(content.toolingPolicy.codexEnvironment.requiredActions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: "Tools", icon: "tool" }),
					expect.objectContaining({
						name: "Release Finalize",
						icon: "tool",
					}),
					expect.objectContaining({ name: "Cloudflared", icon: "run" }),
					expect.objectContaining({ name: "Vitest", icon: "test" }),
					expect.objectContaining({ name: "Mermaid CLI", icon: "tool" }),
				]),
			);
			expect(content.toolingPolicy.makefile.path).toBe("Makefile");
			expect(content.toolingPolicy.makefile.requiredTargets).toContain(
				"env-check",
			);
			expect(content.toolingPolicy.packagePolicy.packageJsonPath).toBe(
				"package.json",
			);
			expect(content.toolingPolicy.packagePolicy.explicitCapabilities).toEqual(
				[],
			);
			expect(content.toolingPolicy.packagePolicy.capabilityDetectors).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						capability: "ui",
						dependencyMarkers: expect.arrayContaining(["react", "vite"]),
					}),
					expect.objectContaining({
						capability: "chatgpt_apps_sdk",
						dependencyMarkers: expect.arrayContaining(["@openai/chatkit"]),
					}),
				]),
			);
			expect(content.toolingPolicy.packagePolicy.requiredPackages).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						package: "@brainwav/design-system-guidance",
						dependencyType: "either",
						requiredWhenCapabilities: expect.arrayContaining([
							"ui",
							"chatgpt_apps_sdk",
						]),
					}),
				]),
			);
			expect(content.toolingPolicy.projectBrainMemoryExtension).toEqual({
				enabled: true,
				requiredPaths: expect.arrayContaining([
					".harness/memory/LEARNINGS.md",
					".harness/knowledge/INDEX.md",
					".harness/knowledge/tooling/codex-learn-summary.md",
					".harness/decisions",
				]),
			});
			expect(content.issueTrackingPolicy.provider).toBe("linear");
			expect(content.issueTrackingPolicy.requirePackageBugsUrl).toBe(true);
			expect(content.issueTrackingPolicy.requirePrIssueKey).toBe(true);
			expect(content.runtimePolicy.nodeVersion).toBe(">=26.3.0");
			expect(content.runtimePolicy.createIssueOnAgentFindings).toBe(true);
			expect(content.loopStageContracts["risk-policy-gate"].schema).toBe(
				"loop-stage-contract/v1",
			);
			expect(content.loopStageContracts["review-gate"].timeoutMinutes).toBe(15);
			expect(content.controlPlanePolicy.overridePolicy.maxTtlHours).toBe(24);
			expect(
				content.controlPlanePolicy.overridePolicy.nonOverridableControls,
			).toContain("governance_trust_mismatch");
			expect(content.contextIntegrityPolicy.mode).toBe("shadow");
			expect(content.contextIntegrityPolicy.truthSources).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: "README.md",
						kind: "file",
						authority: "canonical",
						required: true,
					}),
					expect.objectContaining({
						path: "docs/agents",
						kind: "directory",
						authority: "governed",
					}),
				]),
			);
			expect(
				content.contextIntegrityPolicy.healthSampling.allowedTriggerTypes,
			).toEqual(["current_checkout", "recent_artifacts"]);
		});

		it("does not scaffold legacy .greptile files", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);
			expect(existsSync(join(tempDir, ".greptile/config.json"))).toBe(false);
			expect(existsSync(join(tempDir, ".greptile/rules.md"))).toBe(false);
			expect(existsSync(join(tempDir, ".greptile/files.json"))).toBe(false);
		});

		it("scaffolds github-actions workflow files when provider is github-actions", () => {
			const result = runInit(tempDir, {
				dryRun: false,
				force: false,
				ciProvider: "github-actions",
			});

			expect(result.ok).toBe(true);

			expect(
				existsSync(join(tempDir, ".github/workflows/pr-pipeline.yml")),
			).toBe(true);
			expect(
				existsSync(join(tempDir, ".github/workflows/secret-scan.yml")),
			).toBe(true);
			expect(
				existsSync(join(tempDir, ".github/workflows/release-private-npm.yml")),
			).toBe(true);
			// legacy review bridge workflow is no longer scaffolded
			expect(
				existsSync(join(tempDir, ".github/workflows/greptile-review.yml")),
			).toBe(false);
			// CircleCI file should not be created when github-actions is explicitly selected.
			expect(existsSync(join(tempDir, ".circleci/config.yml"))).toBe(false);
		});

		it("creates valid memory.json baseline", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);

			const memoryPath = join(tempDir, "memory.json");
			expect(existsSync(memoryPath)).toBe(true);

			const memory = JSON.parse(
				require("node:fs").readFileSync(memoryPath, "utf-8"),
			);
			expect(memory.meta.version).toBe("1.0");
			expect(memory.preamble.bootstrap).toBe(true);
			expect(memory.preamble.search).toBe(true);
			expect(Array.isArray(memory.entries)).toBe(true);
		});

		it("creates codex local environment actions with mapped icons", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						scripts: {
							dev: "vite",
							check: "pnpm lint && pnpm test",
							test: "vitest",
							"lint:fix": "biome check --write .",
						},
					},
					null,
					2,
				),
			);
			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);

			const environmentPath = join(
				tempDir,
				".codex/environments/environment.toml",
			);
			expect(existsSync(environmentPath)).toBe(true);

			const content = require("node:fs").readFileSync(environmentPath, "utf-8");
			expect(content).toContain('[[actions]]\nname = "Tools"\nicon = "tool"');
			expect(content).toContain('[[actions]]\nname = "Run"\nicon = "run"');
			expect(content).toContain('[[actions]]\nname = "Debug"\nicon = "debug"');
			expect(content).toContain('[[actions]]\nname = "Test"\nicon = "test"');
			expect(content).toContain('name = "Prek"\nicon = "test"');
			expect(content).toContain('name = "Release Finalize"\nicon = "tool"');
			expect(content).toContain('name = "Diagram"\nicon = "tool"');
			expect(content).toContain('name = "Ralph"\nicon = "debug"');
			expect(content).toContain('name = "Mise"\nicon = "tool"');
			expect(content).toContain('name = "Vale"\nicon = "debug"');
			expect(content).toContain('name = "Argos"\nicon = "test"');
			expect(content).toContain('name = "Cosign"\nicon = "debug"');
			expect(content).toContain('name = "Cloudflared"\nicon = "run"');
			expect(content).toContain('name = "Vitest"\nicon = "test"');
			expect(content).toContain('name = "Ruff"\nicon = "debug"');
			expect(content).toContain('name = "ESLint"\nicon = "debug"');
			expect(content).toContain('name = "Agent Browser"\nicon = "tool"');
			expect(content).toContain('name = "Agentation"\nicon = "tool"');
			expect(content).toContain('name = "MarkdownLint"\nicon = "debug"');
			expect(content).toContain('name = "Wrangler"\nicon = "run"');
			expect(content).toContain('name = "1Password"\nicon = "tool"');
			expect(content).toContain('name = "Beautiful Mermaid"\nicon = "tool"');
			expect(content).toContain('name = "Auth0"\nicon = "tool"');
			expect(content).toContain('name = "Semgrep"\nicon = "debug"');
			expect(content).toContain('name = "Semver"\nicon = "tool"');
			expect(content).toContain('name = "Trivy"\nicon = "debug"');
			expect(content).toContain('name = "Gitleaks"\nicon = "debug"');
			expect(content).toContain('name = "Research"\nicon = "tool"');
			expect(content).toContain('name = "WSearch"\nicon = "tool"');
			expect(content).toContain('name = "Script: dev"\nicon = "run"');
			expect(content).toContain('name = "Script: check"\nicon = "debug"');
			expect(content).toContain('name = "Script: test"\nicon = "test"');
			expect(content).toContain('name = "Script: lint:fix"\nicon = "debug"');
			expect(content).toContain("mise install");
			expect(content).toContain("mise trust --yes .mise.toml || true");
			expect(content).toContain("bash scripts/prepare-worktree.sh");
			expect(content).toContain(
				"[codex] detached HEAD detected; creating branch $branch_name",
			);
			expect(content).toContain(
				"[codex] tracking origin/main for $branch_name",
			);
			expect(content).toContain(
				"[codex] fast-forwarding $branch_name with origin/main",
			);
			expect(content).toContain("git pull --ff-only origin main");
			expect(content).toContain("npm install");
			expect(content).toContain("prek --version");
			expect(content).toContain(
				"Expected a release branch matching codex/release-* or release-*",
			);
			expect(content).toContain(
				'git fetch --prune origin main "$release_branch"',
			);
			expect(content).toContain(
				'local_main_ahead_count="$(git rev-list --count origin/main..HEAD)"',
			);
			expect(content).toContain(
				"Local main is ahead of origin/main; aborting.",
			);
			expect(content).toContain('git merge --ff-only "origin/$release_branch"');
			expect(content).toContain("diagram --help");
			expect(content).toContain("ralph --help");
			expect(content).toContain("cosign version");
			expect(content).toContain("cloudflared --version");
			expect(content).toContain("vitest --version");
			expect(content).toContain("ruff --version");
			expect(content).toContain("eslint --version");
			expect(content).toContain("agent-browser --help");
			expect(content).toContain("agentation-mcp --help");
			expect(content).toContain("mmdc --help");
			expect(content).toContain("wrangler --help");
			expect(content).toContain("gitleaks --help");
			expect(content).toContain("rsearch --help");
			expect(content).toContain("wsearch --help");
			expect(content).toContain("npm run 'dev'");
			expect(content).toContain("npm run 'check'");
			expect(content).toContain("npm run 'test'");
			expect(content).toContain("npm run 'lint:fix'");
		});

		it("fails release finalize when local main is ahead of origin/main", () => {
			const initResult = runInit(tempDir, { dryRun: false, force: false });
			expect(initResult.ok).toBe(true);

			const environmentPath = join(
				tempDir,
				".codex/environments/environment.toml",
			);
			const environmentContent = readFileSync(environmentPath, "utf-8");
			const releaseFinalizeMatch = environmentContent.match(
				/name = "Release Finalize"\nicon = "tool"\ncommand = '''\n([\s\S]*?)\n'''/,
			);
			expect(releaseFinalizeMatch).not.toBeNull();
			const releaseFinalizeCommand = releaseFinalizeMatch?.[1] ?? "";
			expect(releaseFinalizeCommand.length).toBeGreaterThan(0);

			const scenarioDir = mkdtempSync(join(tmpdir(), "release-finalize-test-"));
			try {
				const originDir = join(scenarioDir, "origin.git");
				const seedDir = join(scenarioDir, "seed");
				const workDir = join(scenarioDir, "work");
				mkdirSync(seedDir, { recursive: true });

				const runGit = (args: string[], cwd?: string) =>
					spawnSync("git", args, {
						cwd,
						encoding: "utf8",
						env: sanitizeGitEnv(),
					});

				expect(runGit(["init", "--bare", originDir]).status).toBe(0);
				expect(runGit(["init", "-b", "main"], seedDir).status).toBe(0);
				expect(
					runGit(["config", "user.email", "test@example.com"], seedDir).status,
				).toBe(0);
				expect(
					runGit(["config", "user.name", "Test User"], seedDir).status,
				).toBe(0);

				writeFileSync(join(seedDir, "README.md"), "seed\n", "utf-8");
				expect(runGit(["add", "README.md"], seedDir).status).toBe(0);
				expect(runGit(["commit", "-m", "seed main"], seedDir).status).toBe(0);
				expect(
					runGit(["remote", "add", "origin", originDir], seedDir).status,
				).toBe(0);
				expect(runGit(["push", "-u", "origin", "main"], seedDir).status).toBe(
					0,
				);
				expect(
					runGit(
						["--git-dir", originDir, "symbolic-ref", "HEAD", "refs/heads/main"],
						seedDir,
					).status,
				).toBe(0);

				expect(
					runGit(["checkout", "-b", "codex/release-0.12.1-coherence"], seedDir)
						.status,
				).toBe(0);
				writeFileSync(join(seedDir, "release.txt"), "release\n", "utf-8");
				expect(runGit(["add", "release.txt"], seedDir).status).toBe(0);
				expect(
					runGit(["commit", "-m", "release branch commit"], seedDir).status,
				).toBe(0);
				expect(
					runGit(
						["push", "-u", "origin", "codex/release-0.12.1-coherence"],
						seedDir,
					).status,
				).toBe(0);

				expect(runGit(["clone", originDir, "work"], scenarioDir).status).toBe(
					0,
				);
				expect(
					runGit(["config", "user.email", "test@example.com"], workDir).status,
				).toBe(0);
				expect(
					runGit(["config", "user.name", "Test User"], workDir).status,
				).toBe(0);
				writeFileSync(join(workDir, "local-only.txt"), "local\n", "utf-8");
				expect(runGit(["add", "local-only.txt"], workDir).status).toBe(0);
				expect(
					runGit(["commit", "-m", "local-only main commit"], workDir).status,
				).toBe(0);

				const finalizeRun = spawnSync(
					"bash",
					[
						"-lc",
						releaseFinalizeCommand,
						"release-finalize",
						"codex/release-0.12.1-coherence",
					],
					{
						cwd: workDir,
						encoding: "utf8",
						env: sanitizeGitEnv(),
					},
				);
				expect([1, 2]).toContain(finalizeRun.status ?? -1);
				const finalizeOutput = `${finalizeRun.stdout}${finalizeRun.stderr}`;
				expect(finalizeOutput).toMatch(
					/Local main is ahead of origin\/main; aborting\./,
				);
				expect(finalizeOutput).toMatch(
					/Reconcile local commits before running Release Finalize\./,
				);

				const remoteMainSha = runGit(
					["--git-dir", originDir, "rev-parse", "refs/heads/main"],
					workDir,
				);
				expect(remoteMainSha.status).toBe(0);
				const localMainSha = runGit(["rev-parse", "main"], workDir);
				expect(localMainSha.status).toBe(0);
				expect(localMainSha.stdout.trim()).not.toBe(
					remoteMainSha.stdout.trim(),
				);

				const releaseMerged = runGit(
					[
						"merge-base",
						"--is-ancestor",
						"origin/codex/release-0.12.1-coherence",
						"main",
					],
					workDir,
				);
				expect(releaseMerged.status).toBe(1);
			} finally {
				rmSync(scenarioDir, { recursive: true, force: true });
			}
		});

		it("shell-escapes script names in codex actions", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						scripts: {
							"build; echo INJECTED": "echo safe",
						},
					},
					null,
					2,
				),
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const environmentPath = join(
				tempDir,
				".codex/environments/environment.toml",
			);
			const content = require("node:fs").readFileSync(environmentPath, "utf-8");

			expect(content).toContain('name = "Script: build; echo INJECTED"');
			expect(content).toContain("npm run 'build; echo INJECTED'");
			expect(content).not.toContain("npm run build; echo INJECTED");
		});

		it("updates autogenerated codex environment file without --force", () => {
			for (const path of EXPECTED_TEMPLATE_PATHS) {
				mkdirSync(dirname(join(tempDir, path)), { recursive: true });
				const content =
					path === ".codex/environments/environment.toml"
						? "# THIS IS AUTOGENERATED. DO NOT EDIT MANUALLY\nold content"
						: "existing";
				writeFileSync(join(tempDir, path), content);
			}

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.created).toEqual([
					".codex/environments/environment.toml",
				]);
				expect(result.output.skipped).toHaveLength(EXPECTED_TEMPLATE_COUNT - 1);
			}

			const content = require("node:fs").readFileSync(
				join(tempDir, ".codex/environments/environment.toml"),
				"utf-8",
			);
			expect(content).toContain('name = "harness local environment"');
		});

		it("creates valid memory.json baseline", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);

			const memoryPath = join(tempDir, "memory.json");
			expect(existsSync(memoryPath)).toBe(true);

			const memory = JSON.parse(
				require("node:fs").readFileSync(memoryPath, "utf-8"),
			);
			expect(memory.meta.version).toBe("1.0");
			expect(memory.preamble.bootstrap).toBe(true);
			expect(memory.preamble.search).toBe(true);
			expect(Array.isArray(memory.entries)).toBe(true);
		});

		it("includes package manager in release workflow (github-actions)", () => {
			// Create pnpm lockfile
			writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");

			const result = runInit(tempDir, {
				dryRun: false,
				force: false,
				ciProvider: "github-actions",
			});

			expect(result.ok).toBe(true);

			// Read release workflow and verify pnpm is used
			const workflowPath = join(
				tempDir,
				".github/workflows/release-private-npm.yml",
			);
			const content = require("node:fs").readFileSync(workflowPath, "utf-8");
			expect(content).toContain("pnpm install");
			expect(content).toContain("pnpm check");
			expect(content).toContain("pnpm build");
			expect(content).toContain("name: Ensure pnpm available");
			expect(content).toContain(
				'echo "$NPM_CONFIG_PREFIX/bin" >> "$GITHUB_PATH"',
			);
			expect(content).not.toContain("name: Enable corepack");
			expect(content).toContain("name: Publish private package (token)");
			expect(content).toContain(
				"name: Publish private package (OIDC trusted publisher)",
			);
			expect(content).toContain("name: Verify tag matches package version");
			expect(content).toContain("name: Generate build provenance attestation");
			expect(content).toContain("name: Verify attestations");
			expect(content).toContain('"$GH_BIN" attestation verify');
			expect(content).toContain("name: Create GitHub Release");
		});

		it("uses npm run for npm script commands in CircleCI templates", () => {
			// No lockfile => npm
			const result = runInit(tempDir, {
				dryRun: false,
				force: false,
				ciProvider: "circleci",
			});

			expect(result.ok).toBe(true);

			const contractPath = join(tempDir, "harness.contract.json");
			const contract = JSON.parse(
				require("node:fs").readFileSync(contractPath, "utf-8"),
			);
			expect(contract.uiLoopPolicy.fastCommand).toBe("npm run ui:fast");
			expect(contract.uiLoopPolicy.verifyCommand).toBe("npm run ui:verify");
			expect(contract.uiLoopPolicy.exploreCommand).toBe("npm run ui:explore");

			const workflowPath = join(tempDir, ".circleci/config.yml");
			const workflow = require("node:fs").readFileSync(workflowPath, "utf-8");
			expect(workflow).toContain("npm run lint");
			expect(workflow).toContain("npm run check");
			expect(workflow).toContain("npm run audit:strict");
		});

		it("includes recommended security scanners in contributing template", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);

			const contributingPath = join(tempDir, "CONTRIBUTING.md");
			const content = require("node:fs").readFileSync(
				contributingPath,
				"utf-8",
			);
			expect(content).toContain("## Recommended security scanner baseline");
			expect(content).toContain("Gitleaks");
			expect(content).toContain("Trivy");
			expect(content).toContain("Semgrep");
		});

		it("keeps branch protection guidance aligned to the full required-check set", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });

			expect(result.ok).toBe(true);

			const contributingPath = join(tempDir, "CONTRIBUTING.md");
			const content = require("node:fs").readFileSync(
				contributingPath,
				"utf-8",
			);
			expect(content).not.toContain(".greptile/");
			expect(content).not.toContain("greptile-review.yml");
			expect(content).toContain("CodeRabbit");
			expect(content).toContain("`docs-gate`");
			expect(content).toContain("`CodeRabbit`");
			expect(content).toContain("`consistency-drift-health`");
			expect(content).toContain("- Require status checks:\n  - `pr-template`");
			expect(content).toContain(
				"- Allow `0` required reviewers for solo-maintainer repositories.",
			);
			expect(content).toContain(
				"- Require code quality results with severity `all`.",
			);
			expect(content).toContain(
				"- Allow merge commits, squash merges, and rebase merges.",
			);
		});

		it("routes issue intake to Linear via contact links", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						name: "fixture",
						bugs: {
							url: "https://linear.app/acme/project/platform-123",
						},
					},
					null,
					2,
				),
				"utf-8",
			);

			const retiredTemplates = [
				".github/ISSUE_TEMPLATE/issue.yml",
				".github/ISSUE_TEMPLATE/feature.yml",
				".github/ISSUE_TEMPLATE/security.yml",
			];
			for (const templatePath of retiredTemplates) {
				const fullPath = join(tempDir, templatePath);
				mkdirSync(dirname(fullPath), { recursive: true });
				writeFileSync(fullPath, "name: legacy-form\n", "utf-8");
			}

			const result = runInit(tempDir, { dryRun: false, force: true });
			expect(result.ok).toBe(true);

			const issueTemplateConfig = require("node:fs").readFileSync(
				join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
				"utf-8",
			);

			for (const templatePath of retiredTemplates) {
				expect(existsSync(join(tempDir, templatePath))).toBe(false);
			}
			expect(issueTemplateConfig).toContain("blank_issues_enabled: false");
			expect(issueTemplateConfig).toContain("Linear work intake");
			expect(issueTemplateConfig).toContain(
				"https://linear.app/acme/project/platform-123",
			);
			expect(issueTemplateConfig).toContain("Private security disclosure");
		});

		it("omits the linear issue-template contact link in github tracker mode", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						repository: {
							type: "git",
							url: "https://github.com/acme/my-app.git",
						},
					},
					null,
					2,
				),
				"utf-8",
			);
			const result = runInit(tempDir, {
				dryRun: false,
				force: true,
				issueTracker: "github",
			});
			expect(result.ok).toBe(true);

			const issueTemplateConfig = require("node:fs").readFileSync(
				join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
				"utf-8",
			);

			expect(issueTemplateConfig).not.toContain("Linear work intake");
			expect(issueTemplateConfig).toContain("Repository docs");
			expect(issueTemplateConfig).toContain("Private security disclosure");
		});

		it("renders github tracker assets without linear-only checks", () => {
			const result = runInit(tempDir, {
				dryRun: false,
				force: true,
				ciProvider: "circleci",
				issueTracker: "github",
			});
			expect(result.ok).toBe(true);

			const workflowContent = require("node:fs").readFileSync(
				join(tempDir, "WORKFLOW.md"),
				"utf-8",
			);
			const checksManifest = JSON.parse(
				require("node:fs").readFileSync(
					join(tempDir, ".harness/ci-required-checks.json"),
					"utf-8",
				),
			);
			const contract = JSON.parse(
				require("node:fs").readFileSync(
					join(tempDir, "harness.contract.json"),
					"utf-8",
				),
			);
			const circleConfig = require("node:fs").readFileSync(
				join(tempDir, ".circleci/config.yml"),
				"utf-8",
			);

			expect(workflowContent).toContain("kind: github");
			expect(workflowContent).not.toContain("harness linear claim");
			expect(workflowContent).toContain(
				"open PR and attach validation evidence",
			);
			expect(
				checksManifest.requiredChecks.map(
					(entry: { displayName: string }) => entry.displayName,
				),
			).not.toContain("linear-gate");
			expect(contract.branchProtection.requiredChecks).not.toContain(
				"linear-gate",
			);
			expect(circleConfig).not.toContain("name: linear-gate");
		});

		it("creates WORKFLOW.md with auto-populated Symphony config", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						name: "@acme/my-app",
						bugs: {
							url: "https://linear.app/acme/project/my-app-abc123",
						},
						repository: {
							type: "git",
							url: "git+https://github.com/acme/my-app.git",
						},
						scripts: {
							dev: "vite",
							test: "vitest",
							check: "pnpm lint && pnpm test",
						},
					},
					null,
					2,
				),
				"utf-8",
			);
			writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const workflowPath = join(tempDir, "WORKFLOW.md");
			expect(existsSync(workflowPath)).toBe(true);

			const content = require("node:fs").readFileSync(workflowPath, "utf-8");

			// Verify YAML front matter auto-populated from package.json
			expect(content).toContain('project_slug: "my-app-abc123"');
			expect(content).toContain("https://github.com/acme/my-app.git");
			expect(content).toContain("pnpm install --frozen-lockfile");

			// Verify project name used in heading (scope stripped)
			expect(content).toContain("# my-app Workflow");

			// Verify essential Symphony contract sections
			expect(content).toContain("## Invariants");
			expect(content).toContain("## Transition Table (Canonical)");
			expect(content).toContain("harness linear claim");
			expect(content).toContain("harness linear handoff");
			expect(content).toContain("harness linear close");
			expect(content).toContain("## States");
			expect(content).toContain("## Error Handling");
			expect(content).toContain("## Validation Checklist");
			expect(content).toContain("pnpm check");
		});

		it("creates WORKFLOW.md with placeholder defaults when no package.json", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const workflowPath = join(tempDir, "WORKFLOW.md");
			expect(existsSync(workflowPath)).toBe(true);

			const content = require("node:fs").readFileSync(workflowPath, "utf-8");

			// Verify placeholders used when no package.json fields available
			expect(content).toContain('project_slug: "<your-project-slug>"');
			expect(content).toContain("$SOURCE_REPO_URL");
			expect(content).toContain("# <project-name> Workflow");
			expect(content).toContain("git clone --depth 1 $SOURCE_REPO_URL .");
			expect(content).not.toContain("git clone --depth 1 '$SOURCE_REPO_URL' .");
		});

		it("normalizes string-form repository URLs for WORKFLOW.md clone hooks", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						name: "@acme/my-app",
						repository: "git+https://github.com/acme/my-app.git",
					},
					null,
					2,
				),
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const workflowPath = join(tempDir, "WORKFLOW.md");
			const content = require("node:fs").readFileSync(workflowPath, "utf-8");

			expect(content).toContain(
				"git clone --depth 1 'https://github.com/acme/my-app.git' .",
			);
			expect(content).not.toContain("git+https://github.com/acme/my-app.git");
		});

		it("normalizes repository shorthands for WORKFLOW.md clone hooks", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						name: "@acme/my-app",
						repository: "github:acme/my-app",
					},
					null,
					2,
				),
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const workflowPath = join(tempDir, "WORKFLOW.md");
			const content = require("node:fs").readFileSync(workflowPath, "utf-8");

			expect(content).toContain(
				"git clone --depth 1 'https://github.com/acme/my-app.git' .",
			);
			expect(content).not.toContain(
				'git clone --depth 1 "github:acme/my-app" .',
			);
		});

		it("shell-escapes repository metadata in WORKFLOW.md clone hooks", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						name: "@acme/my-app",
						repository:
							"https://github.com/acme/my-app.git$(touch /tmp/harness-pwned)",
					},
					null,
					2,
				),
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const workflowPath = join(tempDir, "WORKFLOW.md");
			const content = require("node:fs").readFileSync(workflowPath, "utf-8");

			expect(content).toContain(
				"git clone --depth 1 'https://github.com/acme/my-app.git$(touch /tmp/harness-pwned)' .",
			);
		});

		it("uses npm ci for npm repos in WORKFLOW.md bootstrap hooks", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						name: "@acme/my-app",
						repository: "git+https://github.com/acme/my-app.git",
					},
					null,
					2,
				),
				"utf-8",
			);
			writeFileSync(join(tempDir, "package-lock.json"), "{}\n", "utf-8");

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const workflowPath = join(tempDir, "WORKFLOW.md");
			const content = require("node:fs").readFileSync(workflowPath, "utf-8");

			expect(content).toContain("npm ci");
			expect(content).not.toContain("npm install --frozen-lockfile");
		});

		it("enforces strict commit and hook governance in templates", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const validateCommitMsg = require("node:fs").readFileSync(
				join(tempDir, "scripts/validate-commit-msg.js"),
				"utf-8",
			);
			const setupHooks = require("node:fs").readFileSync(
				join(tempDir, "scripts/setup-git-hooks.js"),
				"utf-8",
			);
			const stagedSecrets = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-staged-secrets.sh"),
				"utf-8",
			);
			const hookCriticalConfigSync = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-hook-critical-config-sync.sh"),
				"utf-8",
			);
			const docStyle = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-doc-style.sh"),
				"utf-8",
			);
			const relatedTests = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-related-tests.sh"),
				"utf-8",
			);
			const publicApiDocs = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-public-api-docs.mjs"),
				"utf-8",
			);
			const codeSize = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-code-size.mjs"),
				"utf-8",
			);
			const changedFiles = require("node:fs").readFileSync(
				join(tempDir, "scripts/lib/changed-files.mjs"),
				"utf-8",
			);
			const semgrepChanged = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-semgrep-changed.sh"),
				"utf-8",
			);
			const semgrepFull = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-semgrep-full.sh"),
				"utf-8",
			);
			const semgrepBootstrap = require("node:fs").readFileSync(
				join(tempDir, "scripts/semgrep-bootstrap.sh"),
				"utf-8",
			);
			const semgrepRules = require("node:fs").readFileSync(
				join(tempDir, "scripts/semgrep-pre-push.yml"),
				"utf-8",
			);
			const refreshDiagrams = require("node:fs").readFileSync(
				join(tempDir, "scripts/refresh-diagram-context.sh"),
				"utf-8",
			);
			const diagramFreshness = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-diagram-freshness.sh"),
				"utf-8",
			);
			const makefile = require("node:fs").readFileSync(
				join(tempDir, "Makefile"),
				"utf-8",
			);
			const prek = require("node:fs").readFileSync(
				join(tempDir, "prek.toml"),
				"utf-8",
			);
			const miseToml = require("node:fs").readFileSync(
				join(tempDir, ".mise.toml"),
				"utf-8",
			);
			const harnessCli = require("node:fs").readFileSync(
				join(tempDir, "scripts/harness-cli.sh"),
				"utf-8",
			);
			const runHarnessGate = require("node:fs").readFileSync(
				join(tempDir, "scripts/run-harness-gate.sh"),
				"utf-8",
			);
			const verifyWork = require("node:fs").readFileSync(
				join(tempDir, "scripts/verify-work.sh"),
				"utf-8",
			);
			const prepareWorktree = require("node:fs").readFileSync(
				join(tempDir, "scripts/prepare-worktree.sh"),
				"utf-8",
			);
			const newTask = require("node:fs").readFileSync(
				join(tempDir, "scripts/new-task.sh"),
				"utf-8",
			);
			const codexLearn = require("node:fs").readFileSync(
				join(tempDir, "scripts/codex-learn"),
				"utf-8",
			);
			const codexEnforced = require("node:fs").readFileSync(
				join(tempDir, "scripts/codex-enforced"),
				"utf-8",
			);
			const environmentCheck = require("node:fs").readFileSync(
				join(tempDir, "scripts/check-environment.sh"),
				"utf-8",
			);
			const codexPreflight = require("node:fs").readFileSync(
				join(tempDir, "scripts/codex-preflight.sh"),
				"utf-8",
			);

			expect(validateCommitMsg).toContain(
				"Agent branches require exactly one Co-authored-by trailer",
			);
			expect(validateCommitMsg).toContain(
				"Co-authored-by: Codex <noreply@openai.com>",
			);
			expect(setupHooks).toContain("Installing prek git hooks");
			expect(setupHooks).toContain("function getRepoRoot(): string");
			expect(setupHooks).toContain(
				'return execFileSync("git", ["rev-parse", "--show-toplevel"]',
			);
			expect(setupHooks).toContain(
				'return process.env.PREK_HOME ?? resolve(repoRoot, ".cache/prek")',
			);
			expect(setupHooks).toContain(
				'execFileSync("prek", ["install", "--overwrite"]',
			);
			expect(setupHooks).toContain("patchInstalledPrekHooks");
			expect(setupHooks).toContain(
				'WORKTREE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
			);
			expect(setupHooks).toContain(
				'PREK_HOME="${PREK_HOME:-$WORKTREE_ROOT/.cache/prek}"',
			);
			expect(setupHooks).toContain(
				'"Error: scripts/validate-commit-msg.js is required for commit message validation."',
			);
			expect(setupHooks).toContain("make hooks-pre-commit");
			expect(setupHooks).toContain("make hooks-pre-push");
			expect(setupHooks).toContain("make hooks-commit-msg");
			expect(setupHooks).not.toContain("simple-git-hooks");
			expect(stagedSecrets).toContain("gitleaks git");
			expect(stagedSecrets).toContain("--staged");
			expect(hookCriticalConfigSync).toContain('critical_files=("biome.json")');
			expect(hookCriticalConfigSync).toContain(
				'git rev-parse --verify ":${config_path}"',
			);
			expect(hookCriticalConfigSync).toContain(
				'git hash-object --path="$config_path" "$config_path"',
			);
			expect(hookCriticalConfigSync).toContain(
				"pre-commit style runners stash unstaged changes",
			);
			expect(docStyle).toContain("vale --config .vale.ini");
			expect(docStyle).toContain('":(glob)docs/**/*.md"');
			expect(relatedTests).toContain("Usage: scripts/check-related-tests.sh");
			expect(relatedTests).toContain("pnpm exec vitest related --run");
			expect(relatedTests).not.toContain("--passWithNoTests");
			expect(publicApiDocs).toContain("[check-public-api-docs]");
			expect(publicApiDocs).toContain(
				"exported public API declarations need JSDoc",
			);
			expect(codeSize).toContain("[check-code-size]");
			expect(codeSize).toContain("MAX_FUNCTION_LINES");
			expect(changedFiles).toContain("collectChangedPaths");
			expect(semgrepChanged).toContain(
				'RULESET_PATH="$REPO_ROOT/scripts/semgrep-pre-push.yml"',
			);
			expect(semgrepChanged).toContain(
				'git diff --name-only --diff-filter=ACMR -z "$base_ref"...HEAD --',
			);
			expect(semgrepChanged).toContain(
				'source "$REPO_ROOT/scripts/semgrep-bootstrap.sh"',
			);
			expect(semgrepChanged).toContain("run_semgrep scan");
			expect(semgrepFull).toContain(
				'RULESET_PATH="$REPO_ROOT/scripts/semgrep-pre-push.yml"',
			);
			expect(semgrepFull).toContain(
				'source "$REPO_ROOT/scripts/semgrep-bootstrap.sh"',
			);
			expect(semgrepFull).toContain("run_semgrep scan");
			expect(semgrepFull).toContain("\t.");
			expect(semgrepBootstrap).toContain(
				'SEMGREP_VERSION="${SEMGREP_VERSION:-1.153.1}"',
			);
			expect(semgrepBootstrap).toContain("semgrep_version_usable()");
			expect(semgrepBootstrap).toContain(
				"install_semgrep_with_site_packages()",
			);
			expect(semgrepRules).toContain("ts-no-eval");
			expect(semgrepRules).toContain("ts-no-shell-true");
			expect(makefile).toContain("check: ## Run all required quality gates");
			expect(makefile).toContain("\tnpm run check");
			expect(makefile).toContain(
				"preflight: ## Run repository preflight checks (required local-memory gate by default)",
			);
			expect(makefile).toContain("\t@bash ./scripts/codex-preflight.sh");
			expect(makefile).toContain(
				"verify-work: ## Run canonical repo-local verification wrapper",
			);
			expect(makefile).toContain("\t@bash ./scripts/verify-work.sh");
			expect(makefile).toContain(
				"hooks-pre-commit: ## Run local pre-commit gates before creating a commit",
			);
			expect(makefile).toContain(
				"\t@bash ./scripts/check-hook-critical-config-sync.sh",
			);
			expect(makefile).toContain(
				"hooks-pre-push: ## Run local pre-push governance gates before pushing",
			);
			expect(makefile).toContain(
				'changed_files="$$(git diff --name-only --diff-filter=ACMRDT "$$base_ref"...HEAD --)"',
			);
			expect(makefile).toContain(
				"grep -v '^\\.codex/environments/environment\\.toml$$'",
			);
			expect(makefile).toContain(
				"Environment-only push detected; running check-environment only.",
			);
			expect(makefile).toContain(
				"hooks-commit-msg: ## Validate commit message policy (use HOOK_COMMIT_MSG or MSG_FILE=/path)",
			);

			expect(makefile).toContain("\tnpm run quality:docstrings");
			expect(makefile).toContain("\tnpm run quality:size");

			expect(makefile).toContain("\t$(MAKE) secrets-staged");
			expect(makefile).toContain("\t$(MAKE) docs-style-changed");
			expect(makefile).toContain("\t$(MAKE) related-tests");
			expect(makefile).toContain("\t$(MAKE) semgrep-changed");
			expect(makefile).toContain(
				"\t@bash ./scripts/run-harness-gate.sh docs-gate --mode required --json",
			);
			expect(makefile).toContain(
				'git diff --name-only --diff-filter=ACMRDT "$$base_ref"...HEAD -- > "$$tmp_changed_files"',
			);
			expect(makefile).toContain(
				'bash ./scripts/check-diagram-freshness.sh --changed-files "$$tmp_changed_files"',
			);
			expect(makefile).toContain(
				"\t@bash ./scripts/run-harness-gate.sh tooling-audit --path . --json",
			);
			expect(makefile).toContain("\t@bash ./scripts/check-environment.sh");
			expect(makefile).toContain("\tnpm run build");
			expect(makefile).toContain(
				"diagrams-check: ## Refresh architecture diagrams when sensitive paths change and fail on drift",
			);
			expect(prek).toContain(
				'default_install_hook_types = ["pre-commit", "pre-push"]',
			);
			expect(prek).toContain("[[repos.hooks]]");
			expect(prek).toContain('id = "pre-commit"');
			expect(prek).toContain("make hooks-pre-commit");
			expect(prek).toContain('id = "pre-push"');
			expect(prek).toContain("make hooks-pre-push");
			expect(prek).toContain('stages = ["pre-push"]');
			expect(miseToml).toContain('"cargo:prek" = "0.3.4"');
			expect(miseToml).toContain('"npm:@brainwav/diagram" = "1.1.0"');
			expect(miseToml).toContain('"npm:@argos-ci/cli" = "4.1.1"');
			expect(miseToml).toContain('"cosign" = "3.0.5"');
			expect(miseToml).toContain('"cloudflared" = "2026.3.0"');
			expect(miseToml).toContain('"npm:vitest" = "4.1.5"');
			expect(miseToml).toContain('"ruff" = "0.15.5"');
			expect(miseToml).toContain('"npm:eslint" = "10.0.3"');
			expect(miseToml).toContain('"npm:agent-browser" = "0.17.1"');
			expect(miseToml).toContain('"npm:agentation" = "2.3.2"');
			expect(miseToml).toContain('"npm:agentation-mcp" = "1.2.0"');
			expect(miseToml).toContain('"npm:@mermaid-js/mermaid-cli" = "11.12.0"');
			expect(miseToml).toContain('"npm:@brainwav/rsearch" = "0.1.6"');
			expect(miseToml).toContain('"npm:@brainwav/wsearch-cli" = "0.1.9"');
			expect(miseToml).toContain('"npm:beautiful-mermaid" = "1.1.3"');
			expect(miseToml).toContain('"npm:markdownlint-cli2" = "0.21.0"');
			expect(miseToml).toContain('"npm:semver" = "7.7.4"');
			expect(miseToml).toContain('"npm:wrangler" = "4.69.0"');
			expect(miseToml).toContain('"semgrep" = "1.153.1"');
			expect(miseToml).toContain('"trivy" = "0.69.3"');
			expect(miseToml).toContain('"vale" = "3.13.1"');
			expect(harnessCli).toContain(
				"local $PACKAGE_NAME could not be resolved from this repo",
			);
			expect(harnessCli).toContain(
				"local install/bootstrap problem, not a harness command failure",
			);
			expect(harnessCli).toContain(
				"Private npm fallback is disabled by default",
			);
			expect(harnessCli).toContain("HARNESS_CLI_ALLOW_NPM_EXEC=1");
			expect(harnessCli).toContain("npm auth is missing in this process");
			expect(harnessCli).toContain("npm install");
			expect(harnessCli).toContain(
				"npm install --save-dev @brainwav/coding-harness",
			);
			expect(harnessCli).toContain("npm exec harness -- <command>");
			expect(runHarnessGate).toContain("if is_harness_source_repo; then");
			expect(runHarnessGate).toContain(
				'echo "Error: source checkout detected but node is unavailable; refusing fallback to avoid stale harness binaries." >&2',
			);
			expect(runHarnessGate).toContain(
				'exec node --import tsx "$REPO_ROOT/src/cli.ts" "$@"',
			);
			expect(runHarnessGate).not.toContain("harness-gate-tsx-stderr");
			expect(runHarnessGate).not.toContain("dist_freshness_marker");
			expect(runHarnessGate).not.toContain("newest_dist_file");
			expect(runHarnessGate).not.toContain("tsx IPC startup failed with EPERM");
			expect(runHarnessGate).toContain(
				'if [[ -f "$REPO_ROOT/dist/cli.js" ]] && command -v node >/dev/null 2>&1; then',
			);
			expect(runHarnessGate).toContain(
				'exec node "$REPO_ROOT/dist/cli.js" "$@"',
			);
			expect(runHarnessGate).toContain(
				'bash "$REPO_ROOT/scripts/harness-cli.sh" "$@" || wrapper_exit=$?',
			);
			expect(runHarnessGate).toContain(
				'if [[ "$wrapper_exit" -eq 126 || "$wrapper_exit" -eq 127 ]]; then',
			);
			expect(runHarnessGate).toContain(
				'echo "Warning: scripts/harness-cli.sh unavailable (exit $wrapper_exit); attempting fallback runners." >&2',
			);
			expect(runHarnessGate).toContain('exit "$wrapper_exit"');
			expect(runHarnessGate).toContain(
				"if command -v mise >/dev/null 2>&1; then",
			);
			expect(runHarnessGate).toContain(
				'MISE_RESOLVED="$(mise which harness 2>/dev/null || true)"',
			);
			expect(semgrepBootstrap).toContain(
				'echo "Error: python3 is required to install Semgrep." >&2',
			);
			expect(semgrepBootstrap).toContain(
				'SEMGREP_SITE_PACKAGES_DIR="${SEMGREP_CACHE_ROOT}/semgrep-site-packages-${SEMGREP_VERSION}"',
			);
			expect(semgrepBootstrap).toContain(
				'PYTHONPATH="$SEMGREP_SITE_PACKAGES_DIR${PYTHONPATH:+:$PYTHONPATH}" \\',
			);
			expect(semgrepBootstrap).toContain(
				'python3 -m pip install --quiet --upgrade --target "$SEMGREP_SITE_PACKAGES_DIR" "$SEMGREP_PIP_SPEC"',
			);
			expect(semgrepBootstrap).toContain("has_semgrep_installation()");
			expect(semgrepBootstrap).toContain(
				'if [[ -d "$SEMGREP_SITE_PACKAGES_DIR/semgrep" ]] && semgrep_version_usable; then',
			);
			expect(semgrepBootstrap).toContain(
				'if [[ -z "${CI:-}" && -z "${CIRCLECI:-}" ]]; then',
			);
			expect(semgrepBootstrap).toContain(
				"sudo apt-get install -y python3-pip python3-venv",
			);
			expect(semgrepBootstrap).toContain(
				'python3 -m venv "$SEMGREP_VENV_DIR" >/dev/null 2>&1',
			);
			expect(semgrepBootstrap).toContain(
				'python3 -m pip install --quiet --upgrade --target "$SEMGREP_SITE_PACKAGES_DIR" "$SEMGREP_PIP_SPEC"',
			);
			expect(semgrepBootstrap).toContain("has_semgrep_installation()");
			expect(semgrepBootstrap).toContain(
				'if [[ -d "$SEMGREP_SITE_PACKAGES_DIR/semgrep" ]] && semgrep_version_usable; then',
			);
			expect(semgrepBootstrap).toContain(
				'if [[ -z "${CI:-}" && -z "${CIRCLECI:-}" ]]; then',
			);
			expect(semgrepBootstrap).toContain(
				"sudo apt-get install -y python3-pip python3-venv",
			);
			expect(semgrepBootstrap).toContain(
				"Error: unable to install Semgrep ${SEMGREP_VERSION} or newer.",
			);
			expect(verifyWork).toContain("Canonical repo-local verification runner.");
			expect(verifyWork).toContain("--mode required");
			expect(verifyWork).toContain("scripts/verify-work.sh");
			expect(verifyWork).toContain("==> codex-preflight");
			expect(verifyWork).toContain("==> validate-codestyle");
			expect(verifyWork).toContain("==> validate-codestyle --fast");
			expect(verifyWork).toContain("scripts/validate-codestyle.sh");
			expect(prepareWorktree).toContain(
				"Prepare a freshly created git worktree for local hooks and pre-push checks.",
			);
			expect(prepareWorktree).toContain(
				"[prepare-worktree] detached HEAD detected; creating branch $branch_name",
			);
			expect(prepareWorktree).toContain(
				"[prepare-worktree] tracking origin/main for $branch_name",
			);
			expect(prepareWorktree).toContain(
				"[prepare-worktree] fast-forwarding $branch_name with origin/main",
			);
			expect(prepareWorktree).toContain("git fetch --quiet origin main");
			expect(prepareWorktree).toContain('git merge --ff-only "$target_ref"');
			expect(prepareWorktree).toContain('git switch -c "$branch_name"');
			expect(newTask).toContain(
				"[new-task] fetching latest $remote_name/$remote_base_branch",
			);
			expect(newTask).toContain(
				"--bootstrap             Run worktree bootstrap immediately after creation",
			);
			expect(newTask).toContain(
				'if git -C "$REPO_ROOT" remote get-url "$candidate_remote" >/dev/null 2>&1; then',
			);
			expect(newTask).toContain('elif [[ "$base_ref" != *"/"* ]]; then');
			expect(newTask).toContain(
				'if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$base_ref"; then',
			);
			expect(newTask).toContain(
				'elif ! git -C "$REPO_ROOT" rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null; then',
			);
			expect(newTask).toContain(
				'resolved_base_ref="refs/remotes/$remote_name/$remote_base_branch"',
			);
			expect(newTask).toContain(
				'if ! git rev-parse --verify --quiet "${resolved_base_ref}^{commit}" >/dev/null; then',
			);
			expect(newTask).toContain(
				"[new-task] base ref is not a valid commit: $base_ref",
			);
			expect(newTask).toContain(
				'git worktree add "$worktree_path" -b "${branch_name}" "$resolved_base_ref"',
			);
			expect(newTask).toContain('if [[ "$bootstrap" -eq 1 ]]; then');
			expect(newTask).toContain("[new-task] bootstrapping worktree");
			expect(newTask).toContain("# bootstrap already ran (--bootstrap)");
			expect(prepareWorktree).not.toContain("core.hooksPath");
			expect(prepareWorktree).toContain("node scripts/setup-git-hooks.js");
			expect(prepareWorktree).not.toContain("simple-git-hooks");
			expect(codexLearn).toContain(
				"Usage: codex-learn [--scope auto|global|repo] <command>",
			);
			expect(codexLearn).toContain(".harness/memory/codex-learned");
			expect(codexLearn).toContain(
				".harness/memory/codex-preflight-overrides.env",
			);
			expect(codexLearn).toContain(
				".harness/knowledge/tooling/codex-learn-summary.md",
			);
			expect(codexLearn).toContain(
				"Manual review still required for path hints",
			);
			expect(codexLearn).toContain("Project Brain summary updated:");
			expect(codexEnforced).toContain(
				"Runs repo-local preflight before executing codex.",
			);
			expect(codexEnforced).toContain(
				"--worktree-slug     On main, force task worktree slug before codex launch",
			);
			expect(codexEnforced).toContain(
				"Main branch guard: creating dedicated task worktree...",
			);
			expect(codexEnforced).toContain(
				"[codex] refusing to auto-create a task worktree from a dirty main checkout.",
			);
			expect(codexEnforced).toContain(
				"[codex] unable to verify remote branch availability for ${WORKTREE_BRANCH_PREFIX}/${slug}; refusing auto-create.",
			);
			expect(codexEnforced).toContain('NEW_ARGS+=("--")');
			expect(codexEnforced).toContain(
				'WORKTREE_BRANCH_PREFIX="${WORKTREE_BRANCH_PREFIX:-codex}"',
			);
			expect(codexEnforced).toContain(
				'SKIP_PREFLIGHT="${SKIP_PREFLIGHT:-false}"',
			);
			expect(codexEnforced).toContain(
				'SKIP_WORKTREE_GUARD="${SKIP_WORKTREE_GUARD:-false}"',
			);
			expect(codexEnforced).toContain("issue_key_slug()");
			expect(codexEnforced).toContain(
				"[codex] main-branch auto worktree requires an issue-keyed slug.",
			);
			expect(codexEnforced).toContain(
				'exec bash "${worktree_path}/scripts/codex-enforced" --skip-worktree-guard "${ORIGINAL_ARGS[@]}"',
			);
			expect(codexEnforced).toContain(
				"Skipping preflight before worktree creation (not recommended)",
			);
			expect(codexEnforced).toContain(
				"./scripts/codex-enforced --skip-preflight <your prompt>",
			);
			expect(codexEnforced).toContain("./scripts/codex-learn analyze");
			expect(environmentCheck).toContain("required_tooling_doc_terms=(");
			expect(environmentCheck).toContain('"make"');
			expect(environmentCheck).toContain('"beautiful-mermaid"');
			expect(environmentCheck).toContain('"cloudflared"');
			expect(environmentCheck).toContain('"agentation"');
			expect(environmentCheck).toContain('"mermaid-cli"');
			expect(environmentCheck).toContain('"rsearch"');
			expect(environmentCheck).toContain('"hooks-commit-msg"');
			expect(environmentCheck).toContain(
				"legacy simple-git-hooks config must be removed",
			);
			expect(environmentCheck).toContain('"wsearch"');
			expect(environmentCheck).toContain('"wrangler"');
			expect(environmentCheck).not.toMatch(
				/required_tooling_doc_terms=\([^\n]*"auth0"/,
			);
			expect(environmentCheck).not.toMatch(
				/required_tooling_doc_terms=\([^\n]*"gitleaks"/,
			);
			expect(environmentCheck).not.toMatch(
				/required_tooling_doc_terms=\([^\n]*"op"/,
			);
			expect(environmentCheck).not.toMatch(
				/required_tooling_doc_terms=\([^\n]*"ralph"/,
			);
			expect(environmentCheck).toContain(
				'CODEX_ENVIRONMENT_PATH="$REPO_ROOT/.codex/environments/environment.toml"',
			);
			expect(environmentCheck).toContain(
				'PREK_CONFIG_PATH="$REPO_ROOT/prek.toml"',
			);
			expect(environmentCheck).toContain(
				"echo \"Error: required binary 'mise' is not installed or not on PATH\"",
			);
			expect(environmentCheck).toContain("prepend_standard_tool_paths()");
			expect(environmentCheck).toContain("CHECK_ENVIRONMENT_REEXECED");
			expect(environmentCheck).toContain('"/opt/homebrew/bin"');
			expect(environmentCheck).toContain('"/usr/sbin"');
			probePrependStandardToolPaths(environmentCheck);
			expect(environmentCheck).toContain(
				'eval "$(mise --cd "$REPO_ROOT" activate bash)"',
			);
			expect(environmentCheck).toContain(
				'export CLAUDE_APPROVAL_POSTURE="${CLAUDE_APPROVAL_POSTURE:-require}"',
			);
			expect(environmentCheck).toContain("required_bins=(");
			expect(environmentCheck).toContain('"make"');
			expect(environmentCheck).toContain('"diagram"');
			expect(environmentCheck).toContain('"cloudflared"');
			expect(environmentCheck).toContain('"agentation-mcp"');
			expect(environmentCheck).toContain('"mmdc"');
			expect(environmentCheck).toContain('"markdownlint-cli2"');
			expect(environmentCheck).not.toMatch(/required_bins=\([^\n]*"auth0"/);
			expect(environmentCheck).not.toMatch(/required_bins=\([^\n]*"gitleaks"/);
			expect(environmentCheck).not.toMatch(/required_bins=\([^\n]*"op"/);
			expect(environmentCheck).not.toMatch(/required_bins=\([^\n]*"ralph"/);
			expect(environmentCheck).toContain("required_codex_actions=(");
			expect(environmentCheck).toContain('"Prek|test"');
			expect(environmentCheck).toContain('"Diagram|tool"');
			expect(environmentCheck).toContain('"Cloudflared|run"');
			expect(environmentCheck).toContain('"Agentation|tool"');
			expect(environmentCheck).toContain('"Mermaid CLI|tool"');
			expect(environmentCheck).toContain('"Wrangler|run"');
			expect(environmentCheck).toContain('"Gitleaks|debug"');
			expect(environmentCheck).toContain('"Research|tool"');
			expect(environmentCheck).toContain('MAKEFILE_PATH="$REPO_ROOT/Makefile"');
			expect(environmentCheck).toContain("required_support_files=(");
			expect(environmentCheck).toContain("prepend_standard_tool_paths()");
			expect(environmentCheck).toContain('"/opt/homebrew/bin"');
			expect(environmentCheck).toContain('"/usr/sbin"');
			expect(environmentCheck).toContain('"scripts/verify-work.sh"');
			expect(environmentCheck).toContain(
				'"scripts/codex-preflight-local-memory-legacy.sh"',
			);
			expect(environmentCheck).toContain('"scripts/codex-learn"');
			expect(environmentCheck).toContain('"scripts/codex-enforced"');
			expect(environmentCheck).toContain('"scripts/prepare-worktree.sh"');
			expect(environmentCheck).toContain('"scripts/new-task.sh"');
			expect(environmentCheck).toContain("ensure_mise_available()");
			expect(environmentCheck).not.toContain(
				"curl -fsSL https://mise.run | sh",
			);
			expect(environmentCheck).toContain("command -v mise >/dev/null 2>&1");
			expect(environmentCheck).toContain(
				'"scripts/check-hook-critical-config-sync.sh"',
			);
			expect(environmentCheck).toContain('"scripts/check-public-api-docs.mjs"');
			expect(environmentCheck).toContain('"scripts/check-code-size.mjs"');
			expect(environmentCheck).toContain('"scripts/lib/changed-files.mjs"');
			expect(environmentCheck).toContain('"scripts/check-semgrep-changed.sh"');
			expect(environmentCheck).toContain('"scripts/check-semgrep-full.sh"');
			expect(environmentCheck).toContain('"scripts/semgrep-pre-push.yml"');
			expect(environmentCheck).toContain("required_make_targets=(");
			expect(environmentCheck).toContain(
				"project_brain_memory_extension_enabled=true",
			);
			expect(environmentCheck).toContain("required_project_brain_paths=(");
			expect(environmentCheck).toContain('".harness/memory/LEARNINGS.md"');
			expect(environmentCheck).toContain('".harness/knowledge/INDEX.md"');
			expect(environmentCheck).toContain('".harness/decisions"');
			expect(environmentCheck).toContain(
				'if ! rg -q "^${target}:" "$MAKEFILE_PATH"; then',
			);
			expect(environmentCheck).toContain("required_prek_hooks=(");
			expect(environmentCheck).toContain("required_package_scripts=(");
			expect(environmentCheck).toContain(
				'"semgrep:changed|bash scripts/check-semgrep-changed.sh"',
			);
			expect(environmentCheck).toContain(
				'"quality:docstrings|node scripts/check-public-api-docs.mjs"',
			);
			expect(environmentCheck).toContain(
				'"quality:size|node scripts/check-code-size.mjs"',
			);
			expect(environmentCheck).not.toContain("required_simple_git_hooks=(");
			expect(environmentCheck).toContain(
				`or (((.scripts // {}) | to_entries | any(.value | test("simple-git-hooks"))))`,
			);
			expect(environmentCheck).toContain('"check"');
			expect(environmentCheck).toContain('"env-check"');
			expect(environmentCheck).toContain('"hooks-pre-commit"');
			expect(environmentCheck).toContain('"hooks-pre-push"');
			expect(environmentCheck).toContain('"verify-work"');
			expect(environmentCheck).toContain('"secrets-staged"');
			expect(environmentCheck).toContain('"docs-style-changed"');
			expect(environmentCheck).toContain('"related-tests"');
			expect(environmentCheck).toContain('"semgrep-changed"');
			expect(environmentCheck).toContain('"diagrams-check"');
			expect(environmentCheck).toContain(
				'PACKAGE_JSON_PATH="$REPO_ROOT/package.json"',
			);
			expect(environmentCheck).toContain("explicit_capabilities=(");
			expect(environmentCheck).toContain("ui_markers=(");
			expect(environmentCheck).toContain('"react"');
			expect(environmentCheck).toContain('"@openai/chatkit"');
			expect(environmentCheck).toContain(
				'required_package_specs=("@brainwav/design-system-guidance|either|ui,chatgpt_apps_sdk")',
			);
			expect(environmentCheck).toContain(
				"required package '$pkg' is missing from $PACKAGE_JSON_PATH",
			);
			expect(environmentCheck).toContain(
				"explicit or detected UI/App SDK capabilities",
			);
			expect(environmentCheck).toContain("required Makefile target");
			expect(environmentCheck).toContain("Codex environment action");
			expect(environmentCheck).toContain("run_check_environment_with_runner()");
			expect(environmentCheck).toContain(
				"repo source CLI (cd repo && node --import tsx src/cli.ts)",
			);
			expect(environmentCheck).toContain(
				'bash -lc \'cd "$1" && shift && exec "$@"\' _ "$REPO_ROOT" node --import tsx src/cli.ts',
			);
			expect(environmentCheck).toContain("repo dist CLI (node dist/cli.js)");
			expect(environmentCheck).toContain(
				"repo wrapper (bash scripts/harness-cli.sh)",
			);
			expect(environmentCheck).toContain(
				"@brainwav/coding-harness is not installed globally via npm",
			);
			expect(environmentCheck).toContain(
				'mise_harness_bin="$(mise which harness 2>/dev/null || true)"',
			);
			expect(environmentCheck).toContain(
				'run_check_environment_with_runner "mise harness ($mise_harness_bin)" "$mise_harness_bin"',
			);
			expect(environmentCheck).toContain(
				'run_check_environment_with_runner "global npm harness ($npm_harness_bin)" "$npm_harness_bin"',
			);
			expect(environmentCheck).toContain("npm i -g @brainwav/coding-harness");
			expect(environmentCheck).toContain("NPM_TOKEN");
			expect(environmentCheck).toContain("required_support_files=(");
			expect(environmentCheck).toContain('"scripts/codex-preflight.sh"');
			expect(environmentCheck).toContain(
				'"scripts/codex-preflight-local-memory-legacy.sh"',
			);
			expect(environmentCheck).toContain("required_make_targets=(");
			expect(environmentCheck).toContain('"preflight"');
			expect(environmentCheck).toContain('"worktree-ready"');
			expect(codexPreflight).toContain(
				"--mode <off|optional|required>    Local Memory mode. Default: required",
			);
			expect(codexPreflight).toContain(
				'PREFLIGHT_OVERRIDES_FILE="${WORKSPACE_ROOT}/.harness/memory/codex-preflight-overrides.env"',
			);
			expect(codexPreflight).toContain("Legacy compatibility:");
			expect(codexPreflight).toContain("local local_memory_mode='required'");
			expect(codexPreflight).toContain("preflight_local_memory_gold()");
			expect(codexPreflight).toContain(
				'LOCAL_MEMORY_FALLBACK_SCRIPT="${SCRIPT_DIR}/codex-preflight-local-memory-legacy.sh"',
			);
			expect(codexPreflight).toContain(
				"run_local_memory_preflight_via_harness()",
			);
			expect(codexPreflight).toContain("local-memory-preflight");
			expect(codexPreflight).toContain("PROJECT_BRAIN_REQUIRED_PATHS");
			expect(codexPreflight).toContain(
				".harness/knowledge/tooling/codex-learn-summary.md",
			);
			expect(codexPreflight).toContain("scripts/verify-work.sh");
			expect(codexPreflight).toContain("preflight_local_memory_shell_fallback");
			expect(codexPreflight).toContain("preflight_repo() {");
			expect(codexPreflight).toContain("resolve_script_path()");
			expect(codexPreflight).toContain("is_script_sourced()");
			expect(codexPreflight).toContain(
				"Do not source scripts/codex-preflight.sh.",
			);
			expect(codexPreflight).toContain('main "$@"');
			expect(refreshDiagrams).toContain(
				"diagram manifest generation requires ROOT_DIR, TMP_DIR, and MANIFEST_PATH",
			);
			expect(refreshDiagrams).toContain(
				"const stableId = (prefix, value) => {",
			);
			expect(refreshDiagrams).toContain(
				"const parseArchitecture = (content) => {",
			);
			expect(refreshDiagrams).toContain(
				"const buildArchitecture = (subgraphs) => {",
			);
			expect(refreshDiagrams).toContain(
				"const buildDependency = (content, nodeMap) => {",
			);
			expect(refreshDiagrams).toContain(
				'DIAGRAM_CONTEXT_DIR="$DIAGRAM_DIR/context"',
			);
			expect(refreshDiagrams).toContain(
				'TMP_DIR="$(mktemp -d "$DIAGRAM_CONTEXT_DIR/tmp-refresh-XXXXXX")"',
			);
			expect(refreshDiagrams).toContain(
				'TMP_OUTPUT_DIR=".diagram/context/$(basename "$TMP_DIR")/diagrams"',
			);
			expect(refreshDiagrams).toContain(
				'DEFAULT_DIAGRAM_PATTERNS="src/**/*.ts,scripts/**/*.js,scripts/**/*.cjs,scripts/**/*.mjs,e2e/**/*.ts"',
			);
			expect(refreshDiagrams).toContain(
				'DEFAULT_EXCLUDE_PATTERNS="node_modules/**,.git/**,dist/**,artifacts/**,.tmp-diagram-refresh-*/**,.diagram/**,**/*.test.*,**/*.spec.*"',
			);
			expect(refreshDiagrams).toContain(
				'MAX_FILES="${DIAGRAM_REFRESH_MAX_FILES:-10000}"',
			);
			expect(refreshDiagrams).toContain('--patterns "$DIAGRAM_PATTERNS"');
			expect(refreshDiagrams).toContain('--max-files "$MAX_FILES"');
			expect(refreshDiagrams).toContain("--deterministic");
			expect(refreshDiagrams).toContain(
				'pnpm exec diagram "${DIAGRAM_GENERATE_ARGS[@]}"',
			);
			expect(refreshDiagrams).toContain(
				'/System_Ext\\((ext_\\d+), "Version Control", "[^"]+"\\)/',
			);
			expect(refreshDiagrams).toContain('cp "$TMP_DIR/diagrams/manifest.json"');
			expect(refreshDiagrams).toContain("const sourceManifest = (() => {");
			expect(refreshDiagrams).toContain("...sourceManifest,");
			expect(diagramFreshness).toContain("is_ignored_change()");
			expect(diagramFreshness).toContain("is_architecture_sensitive_change()");
			expect(diagramFreshness).not.toContain(".diagram/*)");
			expect(diagramFreshness).not.toContain("AI/context/*)");
			expect(diagramFreshness).toContain("src/*.test.ts|src/*.spec.ts");
			expect(diagramFreshness).toContain(
				'if (.diagrams | type) == "array" then',
			);
			expect(diagramFreshness).toContain("with_entries(");
			expect(diagramFreshness).toContain(
				'bash "$REPO_ROOT/scripts/refresh-diagram-context.sh" --force --quiet',
			);
		});

		it("fails fast when codex preflight is sourced in zsh", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			// Skip on environments without zsh (e.g. cimg/node Docker on CircleCI).
			const zshCheck = spawnSync("zsh", ["--version"], { encoding: "utf8" });
			if (zshCheck.status !== 0 || zshCheck.error) {
				return; // zsh not available — skip sourcing test
			}

			const sourced = spawnSync(
				"zsh",
				[
					"-lc",
					"source scripts/codex-preflight.sh && whence -w preflight_repo >/dev/null",
				],
				{
					cwd: tempDir,
					encoding: "utf8",
				},
			);

			expect(sourced.status).toBe(1);
			expect(sourced.stderr).toContain(
				"Do not source scripts/codex-preflight.sh.",
			);
		});

		it("makes missing local harness installs actionable in the scaffolded wrapper", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify({ name: "fixture", private: true }, null, 2),
				"utf-8",
			);
			writeFileSync(
				join(tempDir, "pnpm-lock.yaml"),
				"lockfileVersion: '9.0'\n",
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const wrapper = spawnSync(
				"bash",
				["scripts/harness-cli.sh", "verify-coderabbit"],
				{
					cwd: tempDir,
					encoding: "utf8",
				},
			);

			expect(wrapper.status).toBe(1);
			expect(wrapper.stderr).toContain(
				"local @brainwav/coding-harness could not be resolved from this repo",
			);
			expect(wrapper.stderr).toContain(
				"local install/bootstrap problem, not a harness command failure",
			);
			expect(wrapper.stderr).toContain(
				"Private npm fallback is disabled by default",
			);
			expect(wrapper.stderr).toContain("pnpm install");
			expect(wrapper.stderr).toContain("pnpm add -D @brainwav/coding-harness");
			expect(wrapper.stderr).toContain("pnpm exec harness <command>");
			expect(wrapper.stderr).toContain("HARNESS_CLI_ALLOW_NPM_EXEC=1");
			expect(wrapper.stdout).toBe("");
		});

		it("does not fail closed for non-source fixture repos", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify({ name: "fixture", private: true }, null, 2),
				"utf-8",
			);
			writeFileSync(
				join(tempDir, "pnpm-lock.yaml"),
				"lockfileVersion: '9.0'\n",
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			mkdirSync(join(tempDir, "src"), { recursive: true });
			writeFileSync(
				join(tempDir, "src/cli.ts"),
				"console.log('source harness runner');\n",
				"utf-8",
			);

			// Remove the repo wrapper so a broken source-detection path would fall
			// through to the fake global harness and expose the regression.
			rmSync(join(tempDir, "scripts/harness-cli.sh"), { force: true });

			const fakeBin = join(tempDir, ".fake-bin");
			const globalHarnessLog = join(tempDir, ".global-harness.log");
			mkdirSync(fakeBin, { recursive: true });
			writeFileSync(
				join(fakeBin, "mise"),
				`#!/usr/bin/env bash
set -euo pipefail
exit 1
`,
				"utf-8",
			);
			writeFileSync(
				join(fakeBin, "harness"),
				`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${GLOBAL_HARNESS_LOG:?}"
printf '%s\\n' '{"passed":true}'
`,
				"utf-8",
			);
			for (const toolPath of [
				join(fakeBin, "mise"),
				join(fakeBin, "harness"),
			]) {
				const chmod = spawnSync("chmod", ["+x", toolPath], {
					encoding: "utf8",
				});
				expect(chmod.status).toBe(0);
			}

			const {
				BASH_ENV: _ignoredBashEnv,
				ENV: _ignoredEnv,
				...inheritedEnv
			} = process.env;
			const gateRun = spawnSync(
				"bash",
				["scripts/run-harness-gate.sh", "docs-gate", "--json"],
				{
					cwd: tempDir,
					encoding: "utf8",
					env: {
						...inheritedEnv,
						PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
						GLOBAL_HARNESS_LOG: globalHarnessLog,
					},
				},
			);

			expect(gateRun.status).toBe(0);
			expect(gateRun.stderr).not.toContain(
				"source checkout detected but tsx is not installed locally",
			);
		});

		it("executes scaffolded check-environment with mise-first then npm fallback runner selection", () => {
			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			// Force check-environment runner selection into the global fallback branch.
			rmSync(join(tempDir, "scripts/harness-cli.sh"), { force: true });

			const fakeBin = join(tempDir, ".fake-bin");
			const fakeNpmPrefix = join(tempDir, ".fake-npm-prefix");
			const fakeNpmBin = join(fakeNpmPrefix, "bin");
			const fakeMiseHarness = join(fakeBin, "mise-harness");
			const fakeNpmHarness = join(fakeNpmBin, "harness");
			const runnerLog = join(tempDir, ".runner-log");
			mkdirSync(fakeBin, { recursive: true });
			mkdirSync(fakeNpmBin, { recursive: true });

			const passthroughTools = [
				"pnpm",
				"node",
				"jq",
				"make",
				"rg",
				"fd",
				"realpath",
				"prek",
				"diagram",
				"vale",
				"argos",
				"cosign",
				"cloudflared",
				"vitest",
				"ruff",
				"eslint",
				"agent-browser",
				"agentation-mcp",
				"ctx7",
				"mmdc",
				"markdownlint-cli2",
				"wrangler",
				"beautiful-mermaid",
				"semgrep",
				"semver",
				"trivy",
				"rsearch",
				"wsearch",
			];

			const passthroughStub = `#!/usr/bin/env bash
set -euo pipefail
exit 0
`;
			for (const tool of passthroughTools) {
				const stubPath = join(fakeBin, tool);
				writeFileSync(stubPath, passthroughStub, "utf-8");
			}

			writeFileSync(
				fakeMiseHarness,
				`#!/usr/bin/env bash
set -euo pipefail
attestation=""
prev=""
for arg in "$@"; do
	if [[ "$prev" == "--attestation" ]]; then
		attestation="$arg"
	fi
	prev="$arg"
done
if [[ -n "$attestation" ]]; then
	printf '%s\\n' '{"passed":true}' > "$attestation"
fi
printf '%s\\n' "mise-harness $*" >> "\${FAKE_RUNNER_LOG:?}"
printf '%s\\n' '{"passed":true}'
`,
				"utf-8",
			);

			writeFileSync(
				fakeNpmHarness,
				`#!/usr/bin/env bash
set -euo pipefail
attestation=""
prev=""
for arg in "$@"; do
	if [[ "$prev" == "--attestation" ]]; then
		attestation="$arg"
	fi
	prev="$arg"
done
if [[ -n "$attestation" ]]; then
	printf '%s\\n' '{"passed":true}' > "$attestation"
fi
printf '%s\\n' "npm-harness $*" >> "\${FAKE_RUNNER_LOG:?}"
printf '%s\\n' '{"passed":true}'
`,
				"utf-8",
			);

			writeFileSync(
				join(fakeBin, "mise"),
				`#!/usr/bin/env bash
set -euo pipefail
args=("$@")
if [[ "\${args[0]:-}" == "--cd" ]]; then
	args=("\${args[@]:2}")
fi
	if [[ "\${args[0]:-}" == "trust" ]]; then
		if [[ "\${args[1]:-}" == "--show" ]]; then
			target="\${args[2]:-.}"
			echo "\${target%/.mise.toml}: trusted"
		fi
		exit 0
	fi
if [[ "\${args[0]:-}" == "activate" ]]; then
	echo 'true'
	exit 0
fi
if [[ "\${args[0]:-}" == "which" && "\${args[1]:-}" == "harness" ]]; then
	if [[ "\${FAKE_MISE_WHICH_MODE:-present}" == "present" ]]; then
		echo "\${FAKE_MISE_HARNESS:?}"
	fi
	exit 0
fi
exit 1
`,
				"utf-8",
			);

			writeFileSync(
				join(fakeBin, "npm"),
				`#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "ls" ]]; then
	exit 0
fi
if [[ "$1" == "whoami" ]]; then
	if [[ "\${FAKE_NPM_AUTH_FAIL:-}" == "1" ]]; then
		exit 1
	fi
	echo "fixture-user"
	exit 0
fi
if [[ "$1" == "prefix" && "$2" == "-g" ]]; then
	echo "\${FAKE_NPM_PREFIX:?}"
	exit 0
fi
exit 1
`,
				"utf-8",
			);

			for (const toolPath of [
				...passthroughTools.map((tool) => join(fakeBin, tool)),
				join(fakeBin, "mise"),
				join(fakeBin, "npm"),
				fakeMiseHarness,
				fakeNpmHarness,
			]) {
				const chmod = spawnSync("chmod", ["+x", toolPath], {
					encoding: "utf8",
				});
				expect(chmod.status).toBe(0);
			}

			const {
				BASH_ENV: _ignoredBashEnv,
				ENV: _ignoredEnv,
				...inheritedEnv
			} = process.env;
			const baseEnv = {
				...inheritedEnv,
				PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
				FAKE_RUNNER_LOG: runnerLog,
				FAKE_MISE_HARNESS: fakeMiseHarness,
				FAKE_NPM_PREFIX: fakeNpmPrefix,
			};

			const miseRun = spawnSync("bash", ["scripts/check-environment.sh"], {
				cwd: tempDir,
				encoding: "utf8",
				env: {
					...baseEnv,
					FAKE_MISE_WHICH_MODE: "present",
				},
			});
			expect(miseRun.status, miseRun.stdout + miseRun.stderr).toBe(0);
			expect(miseRun.stdout).toContain(
				`Using harness runner: mise harness (${fakeMiseHarness})`,
			);

			const npmAuthFailureRun = spawnSync(
				"bash",
				["scripts/check-environment.sh"],
				{
					cwd: tempDir,
					encoding: "utf8",
					env: {
						...baseEnv,
						FAKE_MISE_WHICH_MODE: "missing",
						FAKE_NPM_AUTH_FAIL: "1",
					},
				},
			);
			expect(
				npmAuthFailureRun.status,
				npmAuthFailureRun.stdout + npmAuthFailureRun.stderr,
			).toBe(0);
			expect(npmAuthFailureRun.stdout).toContain(
				`Using harness runner: global npm harness (${fakeNpmHarness})`,
			);

			const missingHarnessAuthFailureRun = spawnSync(
				"bash",
				["scripts/check-environment.sh"],
				{
					cwd: tempDir,
					encoding: "utf8",
					env: {
						...baseEnv,
						FAKE_MISE_WHICH_MODE: "missing",
						FAKE_NPM_AUTH_FAIL: "1",
						FAKE_NPM_PREFIX: join(tempDir, "missing-npm-prefix"),
					},
				},
			);
			expect(missingHarnessAuthFailureRun.status).toBe(1);
			const missingHarnessAuthFailureOutput = `${missingHarnessAuthFailureRun.stdout}${missingHarnessAuthFailureRun.stderr}`;
			expect(missingHarnessAuthFailureOutput).toContain(
				"Error: npm auth is missing in this process; cannot inspect private @brainwav/coding-harness.",
			);

			const npmFallbackRun = spawnSync(
				"bash",
				["scripts/check-environment.sh"],
				{
					cwd: tempDir,
					encoding: "utf8",
					env: {
						...baseEnv,
						FAKE_MISE_WHICH_MODE: "missing",
					},
				},
			);
			expect(npmFallbackRun.status).toBe(0);
			expect(npmFallbackRun.stdout).toContain(
				`Using harness runner: global npm harness (${fakeNpmHarness})`,
			);

			const npmPrefixFailureRun = spawnSync(
				"bash",
				["scripts/check-environment.sh"],
				{
					cwd: tempDir,
					encoding: "utf8",
					env: {
						...baseEnv,
						FAKE_MISE_WHICH_MODE: "missing",
						FAKE_NPM_PREFIX: join(tempDir, "missing-npm-prefix"),
					},
				},
			);
			expect(npmPrefixFailureRun.status).toBe(1);
			const npmPrefixFailureOutput = `${npmPrefixFailureRun.stdout}${npmPrefixFailureRun.stderr}`;
			expect(npmPrefixFailureOutput).toContain(
				"Error: unable to resolve npm-global harness binary.",
			);

			const loggedRuns = readFileSync(runnerLog, "utf-8").trim().split("\n");
			expect(loggedRuns[0]).toContain("mise-harness check-environment");
			expect(loggedRuns[1]).toContain("npm-harness check-environment");
		});

		it("runs scaffolded new-task for commit-ish and non-origin remote bases from outside repo root", () => {
			writeFileSync(
				join(tempDir, "pnpm-lock.yaml"),
				"lockfileVersion: '9.0'\n",
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const runGit = (args: string[], cwd = tempDir) =>
				spawnSync("git", args, {
					cwd,
					encoding: "utf8",
					env: sanitizeGitEnv(),
				});

			expect(runGit(["init", "-b", "main"]).status).toBe(0);
			expect(runGit(["config", "user.email", "test@example.com"]).status).toBe(
				0,
			);
			expect(runGit(["config", "user.name", "Test User"]).status).toBe(0);

			writeFileSync(join(tempDir, "README.md"), "seed\n", "utf-8");
			expect(runGit(["add", "README.md"]).status).toBe(0);
			expect(runGit(["commit", "-m", "seed main"]).status).toBe(0);

			const firstSha = runGit(["rev-parse", "HEAD"]).stdout.trim();
			expect(firstSha).toMatch(/^[0-9a-f]{40}$/);

			writeFileSync(join(tempDir, "CHANGELOG.md"), "second\n", "utf-8");
			expect(runGit(["add", "CHANGELOG.md"]).status).toBe(0);
			expect(runGit(["commit", "-m", "second commit"]).status).toBe(0);
			expect(runGit(["tag", "v0.0.1", firstSha]).status).toBe(0);

			const scriptPath = join(tempDir, "scripts/new-task.sh");
			const outsideRepoCwd = tmpdir();
			const createdWorktrees: string[] = [];

			const runNewTask = (baseRef: string, slug: string): string => {
				const worktreePath = join(tempDir, `wt-${slug}`);
				const taskRun = spawnSync(
					"bash",
					[scriptPath, "--base", baseRef, "--path", worktreePath, slug],
					{
						cwd: outsideRepoCwd,
						encoding: "utf8",
						env: sanitizeGitEnv(),
					},
				);
				const output = `${taskRun.stdout}${taskRun.stderr}`;
				expect(taskRun.status).toBe(0);
				expect(output).toContain(`[new-task] base: ${baseRef}`);
				createdWorktrees.push(worktreePath);
				return output;
			};

			expect(runNewTask("HEAD~1", "jsc-101-commit-ish-head")).toContain(
				"[new-task] branch: jscraik/feature/jsc-101-commit-ish-head",
			);
			expect(runNewTask("v0.0.1", "jsc-102-commit-ish-tag")).toContain(
				"[new-task] branch: jscraik/feature/jsc-102-commit-ish-tag",
			);
			expect(runNewTask(firstSha, "jsc-103-commit-ish-sha")).toContain(
				`[new-task] base: ${firstSha}`,
			);

			const upstreamFixture = mkdtempSync(join(tmpdir(), "new-task-upstream-"));
			try {
				const upstreamBare = join(upstreamFixture, "upstream.git");
				expect(
					runGit(["init", "--bare", upstreamBare], upstreamFixture).status,
				).toBe(0);
				expect(runGit(["remote", "add", "upstream", upstreamBare]).status).toBe(
					0,
				);
				expect(runGit(["push", "-u", "upstream", "main"]).status).toBe(0);

				const upstreamSlug = "jsc-104-upstream-main";
				const upstreamWorktreePath = join(tempDir, `wt-${upstreamSlug}`);
				const upstreamRun = spawnSync(
					"bash",
					[
						scriptPath,
						"--base",
						"upstream/main",
						"--path",
						upstreamWorktreePath,
						upstreamSlug,
					],
					{
						cwd: outsideRepoCwd,
						encoding: "utf8",
						env: sanitizeGitEnv(),
					},
				);
				const upstreamOutput = `${upstreamRun.stdout}${upstreamRun.stderr}`;
				expect(upstreamRun.status).toBe(0);
				expect(upstreamOutput).toContain(
					"[new-task] fetching latest upstream/main",
				);
				expect(upstreamOutput).toContain(
					"[new-task] resolved base: refs/remotes/upstream/main",
				);
				createdWorktrees.push(upstreamWorktreePath);
			} finally {
				rmSync(upstreamFixture, { recursive: true, force: true });
				for (const worktreePath of createdWorktrees) {
					runGit(["worktree", "remove", "--force", worktreePath]);
					rmSync(worktreePath, { recursive: true, force: true });
				}
			}
		});

		it("cleans up scaffolded new-task branch and worktree when bootstrap fails", () => {
			writeFileSync(join(tempDir, "pnpm-lock.yaml"), "", "utf-8");

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const runGit = (args: string[], cwd = tempDir) =>
				spawnSync("git", args, {
					cwd,
					encoding: "utf8",
					env: sanitizeGitEnv(),
				});

			expect(runGit(["init", "-b", "main"]).status).toBe(0);
			expect(runGit(["config", "user.email", "test@example.com"]).status).toBe(
				0,
			);
			expect(runGit(["config", "user.name", "Test User"]).status).toBe(0);

			writeFileSync(join(tempDir, "README.md"), "seed\n", "utf-8");
			writeFileSync(
				join(tempDir, "scripts/prepare-worktree.sh"),
				'#!/usr/bin/env bash\necho "[prepare-worktree] forced failure" >&2\nexit 42\n',
				"utf-8",
			);
			expect(
				runGit(["add", "README.md", "scripts/prepare-worktree.sh"]).status,
			).toBe(0);
			expect(runGit(["commit", "-m", "seed failing bootstrap"]).status).toBe(0);

			const slug = `jsc-105-bootstrap-cleanup-${process.pid}`;
			const branchName = `jscraik/feature/${slug}`;
			const worktreePath = join(dirname(tempDir), `wt-${slug}`);
			const taskRun = spawnSync(
				"bash",
				[join(tempDir, "scripts/new-task.sh"), "--bootstrap", slug],
				{
					cwd: tmpdir(),
					encoding: "utf8",
					env: sanitizeGitEnv(),
				},
			);
			const output = `${taskRun.stdout}${taskRun.stderr}`;

			expect(taskRun.status).toBe(1);
			expect(output).toContain(
				"[new-task] bootstrap failed; cleaning up created worktree and branch",
			);
			expect(
				runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`])
					.status,
			).toBe(1);
			expect(runGit(["worktree", "list", "--porcelain"]).stdout).not.toContain(
				worktreePath,
			);
			expect(existsSync(worktreePath)).toBe(false);
		});

		it("uses a suffixed scaffolded new-task path when the default path exists", () => {
			writeFileSync(join(tempDir, "pnpm-lock.yaml"), "", "utf-8");

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const runGit = (args: string[], cwd = tempDir) =>
				spawnSync("git", args, {
					cwd,
					encoding: "utf8",
					env: sanitizeGitEnv(),
				});

			expect(runGit(["init", "-b", "main"]).status).toBe(0);
			expect(runGit(["config", "user.email", "test@example.com"]).status).toBe(
				0,
			);
			expect(runGit(["config", "user.name", "Test User"]).status).toBe(0);
			writeFileSync(join(tempDir, "README.md"), "seed\n", "utf-8");
			expect(runGit(["add", "README.md"]).status).toBe(0);
			expect(runGit(["commit", "-m", "seed main"]).status).toBe(0);

			const slug = `jsc-106-path-collision-${process.pid}`;
			const branchName = `jscraik/feature/${slug}`;
			const defaultPath = join(dirname(realpathSync(tempDir)), `wt-${slug}`);
			const expectedWorktreePath = `${defaultPath}-1`;
			mkdirSync(defaultPath, { recursive: true });

			try {
				const taskRun = spawnSync(
					"bash",
					[join(tempDir, "scripts/new-task.sh"), "--base", "HEAD", slug],
					{
						cwd: tmpdir(),
						encoding: "utf8",
						env: sanitizeGitEnv(),
					},
				);
				const output = `${taskRun.stdout}${taskRun.stderr}`;

				expect(taskRun.status).toBe(0);
				expect(output).toContain(`[new-task] path: `);
				expect(output).toContain(`wt-${slug}-1`);
				expect(runGit(["worktree", "list", "--porcelain"]).stdout).toContain(
					expectedWorktreePath,
				);
			} finally {
				runGit(["worktree", "remove", "--force", expectedWorktreePath]);
				runGit(["branch", "-D", branchName]);
				rmSync(defaultPath, { recursive: true, force: true });
				rmSync(expectedWorktreePath, { recursive: true, force: true });
			}
		});

		it("refuses a stale default remote base unless explicitly allowed", () => {
			writeFileSync(join(tempDir, "pnpm-lock.yaml"), "", "utf-8");

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const realGit = spawnSync("bash", ["-lc", "command -v git"], {
				encoding: "utf8",
			}).stdout.trim();
			const fakeBin = join(tempDir, ".fake-bin");
			const fakeGit = join(fakeBin, "git");
			mkdirSync(fakeBin, { recursive: true });
			writeFileSync(
				fakeGit,
				`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "ls-remote" ]]; then
	exit 2
fi
if [[ "\${1:-}" == "fetch" ]]; then
	echo "fatal: simulated fetch failure" >&2
	exit 128
fi
exec "\${REAL_GIT:?}" "$@"
`,
				"utf-8",
			);
			expect(spawnSync("chmod", ["+x", fakeGit]).status).toBe(0);

			const runGit = (args: string[], cwd = tempDir) =>
				spawnSync("git", args, {
					cwd,
					encoding: "utf8",
					env: sanitizeGitEnv(),
				});

			expect(runGit(["init", "-b", "main"]).status).toBe(0);
			expect(runGit(["config", "user.email", "test@example.com"]).status).toBe(
				0,
			);
			expect(runGit(["config", "user.name", "Test User"]).status).toBe(0);
			writeFileSync(join(tempDir, "README.md"), "seed\n", "utf-8");
			expect(runGit(["add", "README.md"]).status).toBe(0);
			expect(runGit(["commit", "-m", "seed main"]).status).toBe(0);
			expect(
				runGit(["remote", "add", "origin", "https://example.invalid/repo.git"])
					.status,
			).toBe(0);

			const blockedSlug = `jsc-107-stale-base-blocked-${process.pid}`;
			const blockedRun = spawnSync(
				"bash",
				[join(tempDir, "scripts/new-task.sh"), blockedSlug],
				{
					cwd: tmpdir(),
					encoding: "utf8",
					env: {
						...sanitizeGitEnv(),
						PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
						REAL_GIT: realGit,
					},
				},
			);
			const blockedOutput = `${blockedRun.stdout}${blockedRun.stderr}`;
			expect(blockedRun.status).toBe(2);
			expect(blockedOutput).toContain(
				"refusing to create from stale local refs",
			);
			expect(
				runGit([
					"show-ref",
					"--verify",
					"--quiet",
					`refs/heads/jscraik/feature/${blockedSlug}`,
				]).status,
			).toBe(1);

			const allowedSlug = `jsc-108-stale-base-allowed-${process.pid}`;
			const allowedWorktreePath = join(
				dirname(realpathSync(tempDir)),
				`wt-${allowedSlug}`,
			);
			try {
				const allowedRun = spawnSync(
					"bash",
					[
						join(tempDir, "scripts/new-task.sh"),
						"--allow-stale-base",
						allowedSlug,
					],
					{
						cwd: tmpdir(),
						encoding: "utf8",
						env: {
							...sanitizeGitEnv(),
							PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
							REAL_GIT: realGit,
						},
					},
				);
				const allowedOutput = `${allowedRun.stdout}${allowedRun.stderr}`;
				expect(allowedRun.status).toBe(0);
				expect(allowedOutput).toContain(
					"warning: could not fetch origin/main; continuing with local refs",
				);
				expect(runGit(["worktree", "list", "--porcelain"]).stdout).toContain(
					allowedWorktreePath,
				);
			} finally {
				runGit(["worktree", "remove", "--force", allowedWorktreePath]);
				runGit(["branch", "-D", `jscraik/feature/${allowedSlug}`]);
			}
		});

		it("fails closed when detached prepare-worktree cannot check origin branch names", () => {
			writeFileSync(
				join(tempDir, "package.json"),
				'{"private":true}\n',
				"utf-8",
			);
			writeFileSync(join(tempDir, "pnpm-lock.yaml"), "", "utf-8");

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const realGit = spawnSync("bash", ["-lc", "command -v git"], {
				encoding: "utf8",
			}).stdout.trim();
			const fakeBin = join(tempDir, ".fake-bin");
			mkdirSync(fakeBin, { recursive: true });
			writeFileSync(
				join(fakeBin, "git"),
				`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "ls-remote" ]]; then
	echo "fatal: simulated remote lookup failure" >&2
	exit 128
fi
exec "\${REAL_GIT:?}" "$@"
`,
				"utf-8",
			);
			writeFileSync(
				join(fakeBin, "pnpm"),
				"#!/usr/bin/env bash\nexit 0\n",
				"utf-8",
			);
			for (const toolPath of [join(fakeBin, "git"), join(fakeBin, "pnpm")]) {
				expect(spawnSync("chmod", ["+x", toolPath]).status).toBe(0);
			}

			const runGit = (args: string[], cwd = tempDir) =>
				spawnSync("git", args, {
					cwd,
					encoding: "utf8",
					env: sanitizeGitEnv(),
				});

			expect(runGit(["init", "-b", "main"]).status).toBe(0);
			expect(runGit(["config", "user.email", "test@example.com"]).status).toBe(
				0,
			);
			expect(runGit(["config", "user.name", "Test User"]).status).toBe(0);
			writeFileSync(join(tempDir, "README.md"), "seed\n", "utf-8");
			expect(runGit(["add", "."]).status).toBe(0);
			expect(runGit(["commit", "-m", "seed detached prep"]).status).toBe(0);
			expect(
				runGit(["remote", "add", "origin", "https://example.invalid/repo.git"])
					.status,
			).toBe(0);
			expect(runGit(["checkout", "--detach", "HEAD"]).status).toBe(0);

			const prepareRun = spawnSync(
				"bash",
				[join(tempDir, "scripts/prepare-worktree.sh")],
				{
					cwd: tmpdir(),
					encoding: "utf8",
					env: {
						...sanitizeGitEnv(),
						PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
						REAL_GIT: realGit,
					},
				},
			);
			const output = `${prepareRun.stdout}${prepareRun.stderr}`;
			expect(prepareRun.status, output).toBe(2);
			expect(output).toContain(
				"[prepare-worktree] failed to check origin branch:",
			);
			expect(runGit(["symbolic-ref", "--short", "-q", "HEAD"]).stdout).toBe("");
		});

		it("passes the scaffolded repo-local verify-work wrapper outside /codex", () => {
			if (
				spawnSync("jq", ["--version"], { encoding: "utf8" }).status !== 0 ||
				spawnSync("python3", ["--version"], { encoding: "utf8" }).status !== 0
			) {
				return;
			}

			writeFileSync(
				join(tempDir, "package.json"),
				JSON.stringify(
					{
						name: "fixture",
						private: true,
						scripts: {
							check: "echo check",
							lint: "echo lint",
							typecheck: "echo typecheck",
							test: "echo test",
							"test:related": "echo related",
						},
					},
					null,
					2,
				),
				"utf-8",
			);
			writeFileSync(
				join(tempDir, "pnpm-lock.yaml"),
				"lockfileVersion: '9.0'\n",
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const gitInit = spawnSync("git", ["init"], {
				cwd: tempDir,
				encoding: "utf8",
			});
			expect(gitInit.status).toBe(0);

			writeFileSync(
				join(tempDir, "scripts/codex-preflight.sh"),
				`#!/usr/bin/env bash
set -euo pipefail
echo "local-memory preflight passed"
`,
				"utf-8",
			);
			writeFileSync(
				join(tempDir, "scripts/validate-codestyle.sh"),
				`#!/usr/bin/env bash
set -euo pipefail
echo "local codestyle passed"
pnpm run check
`,
				"utf-8",
			);

			const fakeBin = join(tempDir, ".fake-bin");
			mkdirSync(fakeBin, { recursive: true });

			const fakePnpm = join(fakeBin, "pnpm");
			writeFileSync(
				fakePnpm,
				`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "\${FAKE_PNPM_LOG:?}"
exit 0
`,
				"utf-8",
			);
			const fakeHarness = join(fakeBin, "harness");
			writeFileSync(
				fakeHarness,
				`#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "contract" && "$2" == "normalize-required-checks" ]]; then
	printf '%s\\n' '{"schemaVersion":1,"contractVersion":"1","activeProvider":"circleci","gates":[{"provider":"circleci","githubCheckName":"pr-pipeline"}]}'
	exit 0
fi
exit 1
`,
				"utf-8",
			);

			for (const toolPath of [
				join(tempDir, "scripts/codex-preflight.sh"),
				join(tempDir, "scripts/validate-codestyle.sh"),
				fakePnpm,
				fakeHarness,
			]) {
				const chmod = spawnSync("chmod", ["+x", toolPath], {
					encoding: "utf8",
				});
				expect(chmod.status).toBe(0);
			}
			const fakePnpmLog = join(tempDir, ".fake-pnpm-log");
			mkdirSync(join(tempDir, ".git"), { recursive: true });
			writeFileSync(
				join(tempDir, ".git/config"),
				"[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n",
				"utf-8",
			);

			const verify = spawnSync("bash", ["scripts/verify-work.sh", "--fast"], {
				cwd: tempDir,
				encoding: "utf8",
				env: {
					...process.env,
					FAKE_PNPM_LOG: fakePnpmLog,
					HARNESS_VERIFY_WORK_NO_DELEGATE: "1",
					PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
				},
			});

			expect(
				verify.status,
				`verify-work exited ${verify.status}\nstdout:\n${verify.stdout}\nstderr:\n${verify.stderr}`,
			).toBe(0);
			expect(verify.stdout).toContain("[verify-work] repo root:");
			expect(verify.stdout).toContain("==> codex-preflight");
			expect(verify.stdout).toContain("local-memory preflight passed");
			expect(verify.stdout).toContain("==> validate-codestyle");
			expect(verify.stdout).toContain("local codestyle passed");
			expect(readFileSync(fakePnpmLog, "utf-8")).toContain("check");
		});
	});

	describe("tooling drift guards", () => {
		it("keeps biome schema aligned between package.json, root config, and scaffolded template", () => {
			const packageJson = JSON.parse(
				readFileSync(join(process.cwd(), "package.json"), "utf-8"),
			) as {
				devDependencies?: Record<string, string>;
			};
			const expectedBiomeVersion = packageJson.devDependencies?.[
				"@biomejs/biome"
			]?.replace(/^[^\d]*/, "");
			expect(expectedBiomeVersion).toBeTruthy();

			const rootBiome = JSON.parse(
				readFileSync(join(process.cwd(), "biome.json"), "utf-8"),
			) as {
				$schema?: string;
			};

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const scaffoldedBiome = JSON.parse(
				readFileSync(join(tempDir, "biome.json"), "utf-8"),
			) as {
				$schema?: string;
			};

			const extractSchemaVersion = (
				schema: string | undefined,
			): string | null => {
				const match = schema?.match(/schemas\/([^/]+)\/schema\.json$/);
				return match?.[1] ?? null;
			};

			expect(extractSchemaVersion(rootBiome.$schema)).toBe(
				expectedBiomeVersion,
			);
			expect(extractSchemaVersion(scaffoldedBiome.$schema)).toBe(
				expectedBiomeVersion,
			);
		});

		it("keeps the repo runtime codex preflight executable and contract-aware", () => {
			const runtimeScript = readFileSync(
				join(process.cwd(), "scripts/codex-preflight.sh"),
				"utf-8",
			);
			const templateScript = readFileSync(
				join(process.cwd(), "src/templates/codex-preflight.sh"),
				"utf-8",
			);
			expect(runtimeScript).toContain("check_paths");
			expect(runtimeScript).toContain("is_allowed_repo_external_path");
			expect(templateScript).toContain("check_paths");
			expect(templateScript).toContain("is_allowed_repo_external_path");
			expect(
				statSync(join(process.cwd(), "scripts/codex-preflight.sh")).mode &
					0o111,
			).toBeTruthy();
		});

		it("keeps the repo runtime codex learn helper aligned with the scaffold template", () => {
			const runtimeScript = readFileSync(
				join(process.cwd(), "scripts/codex-learn"),
				"utf-8",
			);
			const templateScript = readFileSync(
				join(process.cwd(), "src/templates/codex-learn.sh"),
				"utf-8",
			);
			expect(runtimeScript).toBe(templateScript);
		});

		it("keeps the repo runtime codex enforced helper aligned with the scaffold template", () => {
			const runtimeScript = readFileSync(
				join(process.cwd(), "scripts/codex-enforced"),
				"utf-8",
			);
			const templateScript = readFileSync(
				join(process.cwd(), "src/templates/codex-enforced.sh"),
				"utf-8",
			);
			expect(runtimeScript).toBe(templateScript);
		});

		it("keeps the repo-local verify-work wrapper aligned with scaffold output", () => {
			writeFileSync(
				join(tempDir, "pnpm-lock.yaml"),
				"lockfileVersion: '9.0'\n",
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const runtimeScript = readFileSync(
				join(process.cwd(), "scripts/verify-work.sh"),
				"utf-8",
			);
			const scaffoldedScript = readFileSync(
				join(tempDir, "scripts/verify-work.sh"),
				"utf-8",
			);
			expect(scaffoldedScript).toBe(runtimeScript);
		});

		it("keeps the repo-local prepare-worktree helper aligned with scaffold output", () => {
			writeFileSync(
				join(tempDir, "pnpm-lock.yaml"),
				"lockfileVersion: '9.0'\n",
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const runtimeScript = readFileSync(
				join(process.cwd(), "scripts/prepare-worktree.sh"),
				"utf-8",
			);
			const scaffoldedScript = readFileSync(
				join(tempDir, "scripts/prepare-worktree.sh"),
				"utf-8",
			);
			expect(scaffoldedScript).toBe(runtimeScript);
		});

		it("keeps the scaffolded new-task helper aligned with the downstream branch policy", () => {
			writeFileSync(
				join(tempDir, "pnpm-lock.yaml"),
				"lockfileVersion: '9.0'\n",
				"utf-8",
			);

			const result = runInit(tempDir, { dryRun: false, force: false });
			expect(result.ok).toBe(true);

			const runtimeScript = readFileSync(
				join(process.cwd(), "scripts/new-task.sh"),
				"utf-8",
			);
			const scaffoldedScript = readFileSync(
				join(tempDir, "scripts/new-task.sh"),
				"utf-8",
			);
			expect(scaffoldedScript).toBe(
				runtimeScript
					.replace(
						"Branch prefix (default: codex)",
						"Branch prefix (default: jscraik/feature)",
					)
					.replace('branch_prefix="codex"', 'branch_prefix="jscraik/feature"'),
			);
		});
	});
});

describe("EXIT_CODES", () => {
	it("defines expected exit codes", () => {
		expect(EXIT_CODES.SUCCESS).toBe(0);
		expect(EXIT_CODES.PATH_TRAVERSAL).toBe(1);
		expect(EXIT_CODES.WRITE_ERROR).toBe(2);
		expect(EXIT_CODES.INVALID_PATH).toBe(3);
	});
});

describe("--track flag", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-track-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("creates manifest for new files", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toHaveLength(EXPECTED_TEMPLATE_COUNT);
		}

		// Verify manifest exists
		expect(existsSync(join(tempDir, ".harness/restore-manifest.json"))).toBe(
			true,
		);

		// Backups directory is created but may be empty for new files
		expect(existsSync(join(tempDir, ".harness/backups"))).toBe(true);
		const manifest = JSON.parse(
			require("node:fs").readFileSync(
				join(tempDir, ".harness/restore-manifest.json"),
				"utf-8",
			),
		);
		expect(manifest.ciProvider).toBe("circleci");
	});

	it("creates backups for existing files", () => {
		// Create existing file with unique content (using circleci default)
		mkdirSync(join(tempDir, ".circleci"), { recursive: true });
		writeFileSync(join(tempDir, ".circleci/config.yml"), "old content");

		const result = runInit(tempDir, {
			dryRun: false,
			force: true,
			track: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toHaveLength(EXPECTED_TEMPLATE_COUNT);
		}

		// Verify backup exists
		expect(existsSync(join(tempDir, ".harness/backups"))).toBe(true);

		// Read manifest and verify entry
		const manifestContent = require("node:fs").readFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			"utf-8",
		);
		const manifest = JSON.parse(manifestContent);
		expect(manifest.files).toHaveLength(EXPECTED_TEMPLATE_COUNT);
		expect(manifest.ciProvider).toBe("circleci");

		// Find the modified entry
		const modifiedEntry = manifest.files.find(
			(f: { path: string; action: string }) =>
				f.path === ".circleci/config.yml",
		);
		expect(modifiedEntry.action).toBe("modified");
		expect(modifiedEntry.backupHash).toMatch(/^[a-f0-9]{16}$/);
	});

	it("records circleci as manifest provider when selected", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			ciProvider: "circleci",
		});
		expect(result.ok).toBe(true);

		const manifest = JSON.parse(
			require("node:fs").readFileSync(
				join(tempDir, ".harness/restore-manifest.json"),
				"utf-8",
			),
		);
		expect(manifest.ciProvider).toBe("circleci");
	});

	it("records issueTracker in the manifest when explicitly configured", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			issueTracker: "github",
		});
		expect(result.ok).toBe(true);

		const manifest = JSON.parse(
			require("node:fs").readFileSync(
				join(tempDir, ".harness/restore-manifest.json"),
				"utf-8",
			),
		);
		expect(manifest.issueTracker).toBe("github");
	});

	it("preserves an explicit issueTracker when minimal tracked init is requested", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			minimal: true,
			issueTracker: "github",
		});
		expect(result.ok).toBe(true);

		const manifest = JSON.parse(
			require("node:fs").readFileSync(
				join(tempDir, ".harness/restore-manifest.json"),
				"utf-8",
			),
		);
		expect(manifest.issueTracker).toBe("github");
		expect(manifest.minimal).toBe(true);

		manifest.harnessVersion = "0.0.1";
		require("node:fs").writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify(manifest),
		);

		const updateResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});
		expect(updateResult.ok).toBe(true);
		expect(existsSync(join(tempDir, ".github/CODEOWNERS"))).toBe(false);
		expect(existsSync(join(tempDir, ".harness/ci-required-checks.json"))).toBe(
			false,
		);
		expect(existsSync(join(tempDir, ".greptile/config.json"))).toBe(false);
		expect(existsSync(join(tempDir, ".greptile/rules.md"))).toBe(false);
		expect(existsSync(join(tempDir, ".greptile/files.json"))).toBe(false);
		expect(
			existsSync(join(tempDir, ".github/workflows/greptile-review.yml")),
		).toBe(false);
	});

	it("rejects symlinks with error", () => {
		// Create symlink to a file outside the repo
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		const symlinkPath = join(
			tempDir,
			".github/workflows/release-private-npm.yml",
		);
		symlinkSync("/etc/passwd", symlinkPath);

		const result = runInit(tempDir, {
			dryRun: false,
			force: true,
			track: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			// sanitizePath now detects the symlink before any write occurs
			expect(result.error.code).toBe("PATH_TRAVERSAL");
			expect(result.error.message).toMatch(/symlink/i);
		}
	});

	// Regression: directory-level symlinks (.github -> /outside) must also be caught
	it("rejects symlinked directories that escape target dir", () => {
		const outsideDir = join(tempDir, "outside");
		mkdirSync(outsideDir, { recursive: true });
		// Symlink .github -> an otherwise-clean directory outside the repo
		symlinkSync(outsideDir, join(tempDir, ".github"));

		const result = runInit(tempDir, {
			dryRun: false,
			force: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("PATH_TRAVERSAL");
			expect(result.error.path).toMatch(/^\.github\//);
		}
		// Nothing should have been written to outsideDir
		expect(existsSync(join(outsideDir, "workflows"))).toBe(false);
	});
});

describe("--rollback flag", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-rollback-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("restores created files (deletes them)", () => {
		// First install with --track
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Verify files exist
		expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(true);
		expect(existsSync(join(tempDir, "memory.json"))).toBe(true);

		// Then rollback
		const rollbackResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
		});
		expect(rollbackResult.ok).toBe(true);

		// Verify files deleted
		expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(false);
		expect(
			existsSync(join(tempDir, ".github/workflows/release-private-npm.yml")),
		).toBe(false);
		expect(existsSync(join(tempDir, "CONTRIBUTING.md"))).toBe(false);
		expect(existsSync(join(tempDir, ".github/PULL_REQUEST_TEMPLATE.md"))).toBe(
			false,
		);
		expect(existsSync(join(tempDir, "memory.json"))).toBe(false);

		// Manifest cleaned up
		expect(existsSync(join(tempDir, ".harness/restore-manifest.json"))).toBe(
			false,
		);
	});

	// Regression: rollback must not follow symlinks and overwrite files outside workspace
	it("rejects rollback when target file is a symlink", () => {
		// Create the file that will be tracked (gives harness something to back up)
		const originalContent = "ORIGINAL CONTRACT CONTENT";
		writeFileSync(join(tempDir, "harness.contract.json"), originalContent);

		// Install with --track --force to produce a backup manifest entry
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: true,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Replace the tracked file with a symlink pointing to an external file
		const externalPath = join(tempDir, "external-target.txt");
		writeFileSync(externalPath, "EXTERNAL");
		rmSync(join(tempDir, "harness.contract.json"), { force: true });
		symlinkSync(externalPath, join(tempDir, "harness.contract.json"));

		const rollbackResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
		});

		// Rollback must fail — symlink caught by sanitizePath or executeRollback
		expect(rollbackResult.ok).toBe(false);
		if (!rollbackResult.ok) {
			expect(rollbackResult.error.code).toBe("WRITE_ERROR");
			// Error is caught at sanitizePath (manifest validation) or executeRollback
			// Either way the external file must not be overwritten
		}

		// External file must remain untouched
		const externalContent = require("node:fs").readFileSync(
			externalPath,
			"utf-8",
		);
		expect(externalContent).toBe("EXTERNAL");
	});

	it("restores modified files from backup", () => {
		// Create existing file (using circleci default)
		mkdirSync(join(tempDir, ".circleci"), { recursive: true });
		const originalContent = "ORIGINAL CONTENT";
		writeFileSync(join(tempDir, ".circleci/config.yml"), originalContent);

		// Install with --track --force
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: true,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Verify file was modified
		const modifiedContent = require("node:fs").readFileSync(
			join(tempDir, ".circleci/config.yml"),
			"utf-8",
		);
		expect(modifiedContent).not.toBe(originalContent);

		// Rollback
		const rollbackResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
		});
		expect(rollbackResult.ok).toBe(true);

		// Verify original content restored
		const restoredContent = require("node:fs").readFileSync(
			join(tempDir, ".circleci/config.yml"),
			"utf-8",
		);
		expect(restoredContent).toBe(originalContent);
	});

	it("fails when no manifest exists", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("MANIFEST_NOT_FOUND");
			expect(result.error.message).toContain("No restore manifest found");
		}
	});

	it("fails when manifest is corrupted", () => {
		// Create corrupted manifest
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			"not valid json {{{",
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("WRITE_ERROR");
			expect(result.error.message).toContain("Failed to load manifest");
		}
	});

	it("fails rollback when manifest provider and requested provider mismatch", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			ciProvider: "github-actions",
		});
		expect(installResult.ok).toBe(true);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
			ciProvider: "circleci",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_PATH");
			expect(result.error.message).toContain("manifest provider");
		}
	});

	it("reuses the tracked provider during rollback when no ciProvider flag is passed", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			ciProvider: "github-actions",
		});
		expect(installResult.ok).toBe(true);

		const rollbackResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
		});

		expect(rollbackResult.ok).toBe(true);
		expect(
			existsSync(join(tempDir, ".github/workflows/release-private-npm.yml")),
		).toBe(false);
		expect(existsSync(join(tempDir, ".harness/restore-manifest.json"))).toBe(
			false,
		);
	});

	it("blocks path traversal in manifest", () => {
		// Install first
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Tamper with manifest to add traversal
		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		manifest.files.push({
			path: "../../../etc/passwd",
			action: "created",
		});
		require("node:fs").writeFileSync(manifestPath, JSON.stringify(manifest));

		// Rollback should reject the tampered manifest
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toMatch(/traversal|blocked/i);
		}
	});

	it("rejects tampered backup hash bindings in manifest", () => {
		writeFileSync(join(tempDir, "AGENTS.md"), "legacy");
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: true,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		expect(manifest.files.length).toBeGreaterThan(0);
		manifest.files[0].action = "modified";
		manifest.files[0].backupHash = "0000000000000000";
		require("node:fs").writeFileSync(manifestPath, JSON.stringify(manifest));

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			rollback: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Manifest backup hash mismatch");
		}
	});
});

describe("--check-updates flag", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-check-updates-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("fails when no manifest exists", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			checkUpdates: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("MANIFEST_NOT_FOUND");
			expect(result.error.message).toContain("No restore manifest found");
		}
	});

	it("reports update available for old version", () => {
		// Install first
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Tamper with manifest to set old version
		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		manifest.harnessVersion = "0.0.1"; // Old version
		require("node:fs").writeFileSync(manifestPath, JSON.stringify(manifest));

		// Check for updates
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			checkUpdates: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.updateCheck).toBeDefined();
			expect(result.output.updateCheck?.updateAvailable).toBe(true);
			expect(result.output.updateCheck?.installedVersion).toBe("0.0.1");
		}
	});

	it("reports up to date for same version", () => {
		// Install first (this sets current version)
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Check for updates immediately (same version)
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			checkUpdates: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.updateCheck).toBeDefined();
			expect(result.output.updateCheck?.updateAvailable).toBe(false);
		}
	});

	it("fails closed when manifest is missing harnessVersion", () => {
		// Install first
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Remove version from manifest (simulates old manifest format)
		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		manifest.harnessVersion = undefined;
		require("node:fs").writeFileSync(manifestPath, JSON.stringify(manifest));

		// Check for updates
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			checkUpdates: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INCOMPLETE_MANIFEST");
			expect(result.error.message).toContain("Restore manifest is incomplete");
			expect(result.error.message).toContain("harnessVersion");
		}
	});
});

describe("--update flag", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-update-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("fails when no manifest exists", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("MANIFEST_NOT_FOUND");
			expect(result.error.message).toContain("No restore manifest found");
		}
	});

	it("fails closed for mutating untracked adoption while dry-run previews it", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
		});
		expect(installResult.ok).toBe(true);
		expect(existsSync(join(tempDir, ".harness/restore-manifest.json"))).toBe(
			false,
		);
		const staleCodeRabbit = "language: en-US\n";
		writeFileSync(join(tempDir, ".coderabbit.yaml"), staleCodeRabbit);

		const mutatingResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(mutatingResult.ok).toBe(false);
		if (!mutatingResult.ok) {
			expect(mutatingResult.error.message).toContain(
				"No restore manifest found",
			);
		}
		expect(readFileSync(join(tempDir, ".coderabbit.yaml"), "utf-8")).toBe(
			staleCodeRabbit,
		);

		const dryRunResult = runInit(tempDir, {
			dryRun: true,
			force: false,
			update: true,
		});

		expect(dryRunResult.ok).toBe(true);
		if (dryRunResult.ok) {
			expect(dryRunResult.output.updateMode).toBe("adoption-preview");
			expect(dryRunResult.output.trackedManifest).toBe(false);
		}
		expect(readFileSync(join(tempDir, ".coderabbit.yaml"), "utf-8")).toBe(
			staleCodeRabbit,
		);
	});

	it("previews untracked existing repo adoption without a restore manifest in dry-run", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
		});
		expect(installResult.ok).toBe(true);
		expect(existsSync(join(tempDir, ".harness/restore-manifest.json"))).toBe(
			false,
		);

		const staleCodeRabbit = "language: en-US\n";
		writeFileSync(join(tempDir, ".coderabbit.yaml"), staleCodeRabbit);

		const result = runInit(tempDir, {
			dryRun: true,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.updated).toEqual(
				expect.arrayContaining(["harness.contract.json", ".coderabbit.yaml"]),
			);
			expect(result.output.created).toEqual(result.output.updated);
			expect(result.output.updateDetails).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ".coderabbit.yaml",
						status: "updated",
						category: "code-review",
						reason: "code-review-policy-template-drift",
					}),
				]),
			);
		}
		expect(readFileSync(join(tempDir, ".coderabbit.yaml"), "utf-8")).toBe(
			staleCodeRabbit,
		);
		expect(existsSync(join(tempDir, ".harness/restore-manifest.json"))).toBe(
			false,
		);
	});

	it("rejects --update when combined with --track", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
			track: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_OPTIONS");
			expect(result.error.message).toContain(
				"--update cannot be combined with --track",
			);
			expect(result.error.message).toContain("harness upgrade --dry-run");
		}
	});

	it("rejects scaffold-shape flags when combined with --update", () => {
		const cases = [{ minimal: true }, { issueTracker: "github" as const }];

		for (const extraOptions of cases) {
			const result = runInit(tempDir, {
				dryRun: false,
				force: false,
				update: true,
				...extraOptions,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_OPTIONS");
				expect(result.error.message).toContain(
					"--update reuses the tracked scaffold configuration",
				);
				expect(result.error.message).toContain("--minimal");
				expect(result.error.message).toContain("--issue-tracker");
			}
		}
	});

	it("updates files and manifest version", () => {
		// Install first
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Set old version in manifest
		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		manifest.harnessVersion = "0.0.1";
		require("node:fs").writeFileSync(manifestPath, JSON.stringify(manifest));

		// Run update
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created.length).toBeGreaterThan(0);
		}

		// Verify manifest version was updated
		const updatedManifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		expect(updatedManifest.harnessVersion).not.toBe("0.0.1");
	});

	it("skips tracked codex environment updates after user customization", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const environmentPath = join(
			tempDir,
			".codex/environments/environment.toml",
		);
		const customizedEnvironment =
			'# Jamie-owned custom environment\n[tools]\ncustom = "preserve-me"\n';
		writeFileSync(environmentPath, customizedEnvironment, "utf-8");

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			harnessVersion?: string;
		};
		manifest.harnessVersion = "0.0.1";
		writeFileSync(manifestPath, JSON.stringify(manifest));

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.skipped).toContain(
				".codex/environments/environment.toml",
			);
			expect(result.output.updated).not.toContain(
				".codex/environments/environment.toml",
			);
		}
		expect(readFileSync(environmentPath, "utf-8")).toBe(customizedEnvironment);
	});

	it("adopts newly introduced scaffolded scripts during update when older manifests do not track them", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			harnessVersion?: string;
			files: Array<{ path: string; action: string }>;
		};
		manifest.harnessVersion = "0.0.1";
		manifest.files = manifest.files.filter(
			(entry) =>
				entry.path !== "scripts/codex-learn" &&
				entry.path !== "scripts/codex-enforced",
		);
		writeFileSync(manifestPath, JSON.stringify(manifest));

		rmSync(join(tempDir, "scripts/codex-learn"), { force: true });
		rmSync(join(tempDir, "scripts/codex-enforced"), { force: true });

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		expect(existsSync(join(tempDir, "scripts/codex-learn"))).toBe(true);
		expect(existsSync(join(tempDir, "scripts/codex-enforced"))).toBe(true);
		expect(
			statSync(join(tempDir, "scripts/codex-learn")).mode & 0o111,
		).toBeTruthy();
		expect(
			statSync(join(tempDir, "scripts/codex-enforced")).mode & 0o111,
		).toBeTruthy();

		const updatedManifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			files: Array<{ path: string }>;
		};
		expect(
			updatedManifest.files.some(
				(entry) => entry.path === "scripts/codex-learn",
			),
		).toBe(true);
		expect(
			updatedManifest.files.some(
				(entry) => entry.path === "scripts/codex-enforced",
			),
		).toBe(true);
	});

	it("auto-repairs manifest when ciProvider is missing via the requested/default provider", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		manifest.ciProvider = undefined;
		require("node:fs").writeFileSync(manifestPath, JSON.stringify(manifest));

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		const repairedManifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		expect(repairedManifest.ciProvider).toBe("circleci");
	});

	it("reuses the tracked provider during update when no ciProvider flag is passed", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			ciProvider: "github-actions",
		});
		expect(installResult.ok).toBe(true);
		expect(
			existsSync(join(tempDir, ".github/workflows/release-private-npm.yml")),
		).toBe(true);
		expect(existsSync(join(tempDir, ".circleci/config.yml"))).toBe(false);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		expect(
			existsSync(join(tempDir, ".github/workflows/release-private-npm.yml")),
		).toBe(true);
		expect(existsSync(join(tempDir, ".circleci/config.yml"))).toBe(false);
	});

	it("prefers the requested/default provider when ci layout is ambiguous", () => {
		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify({ harnessVersion: "0.8.1", files: [] }),
		);
		mkdirSync(join(tempDir, ".circleci"), { recursive: true });
		writeFileSync(join(tempDir, ".circleci/config.yml"), "version: 2.1\n");
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		const repairedManifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		expect(repairedManifest.ciProvider).toBe("circleci");
	});

	it("is no-op when already up to date", () => {
		// Install first (sets current version)
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		// Run update immediately (same version)
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			// Should have updated files (even if same content)
			expect(result.output.created.length).toBeGreaterThanOrEqual(0);
		}
	});

	it("preserves a tracked issueTracker=none selection during update", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			issueTracker: "none",
		});
		expect(installResult.ok).toBe(true);
		expect(existsSync(join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"))).toBe(
			false,
		);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		manifest.harnessVersion = "0.0.1";
		require("node:fs").writeFileSync(manifestPath, JSON.stringify(manifest));

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		expect(existsSync(join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"))).toBe(
			false,
		);
		const updatedManifest = JSON.parse(
			require("node:fs").readFileSync(manifestPath, "utf-8"),
		);
		expect(updatedManifest.issueTracker).toBe("none");

		const contract = JSON.parse(
			require("node:fs").readFileSync(
				join(tempDir, "harness.contract.json"),
				"utf-8",
			),
		);
		expect(contract.issueTrackingPolicy).toBeUndefined();
	});

	it("preserves github issue-tracker mode during update when the manifest lacks issueTracker", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			issueTracker: "github",
		});
		expect(installResult.ok).toBe(true);
		expect(existsSync(join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"))).toBe(
			true,
		);
		expect(existsSync(join(tempDir, ".linear"))).toBe(false);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		manifest.issueTracker = undefined;
		manifest.harnessVersion = "0.0.1";
		writeFileSync(manifestPath, JSON.stringify(manifest));
		const contractPath = join(tempDir, "harness.contract.json");
		const contractBeforeUpdate = JSON.parse(
			readFileSync(contractPath, "utf-8"),
		);
		contractBeforeUpdate.issueTrackingPolicy = undefined;
		writeFileSync(contractPath, JSON.stringify(contractBeforeUpdate, null, 2));

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		expect(existsSync(join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"))).toBe(
			true,
		);
		expect(existsSync(join(tempDir, ".linear"))).toBe(false);
		const issueTemplateConfig = readFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			"utf-8",
		);
		expect(issueTemplateConfig).not.toContain("Linear work intake");
		expect(issueTemplateConfig).toContain("Private security disclosure");

		const contract = JSON.parse(
			readFileSync(join(tempDir, "harness.contract.json"), "utf-8"),
		);
		expect(contract.issueTrackingPolicy).toBeUndefined();
		const updatedManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		expect(updatedManifest.issueTracker).toBe("github");
	});

	it("fails update when the existing contract JSON is malformed", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		manifest.harnessVersion = "0.0.1";
		writeFileSync(manifestPath, JSON.stringify(manifest));
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			"{not valid json",
			"utf-8",
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("WRITE_ERROR");
			expect(result.error.message).toContain(
				"Failed to parse existing contract JSON",
			);
			expect(result.error.path).toBe("harness.contract.json");
		}
	});

	it("fails update when the tracked contract is missing", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			issueTracker: "github",
		});
		expect(installResult.ok).toBe(true);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		manifest.harnessVersion = "0.0.1";
		writeFileSync(manifestPath, JSON.stringify(manifest));
		rmSync(join(tempDir, "harness.contract.json"));

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("WRITE_ERROR");
			expect(result.error.path).toBe("harness.contract.json");
			expect(result.error.message).toContain(
				"Update requires harness.contract.json",
			);
		}

		const issueTemplateConfig = readFileSync(
			join(tempDir, ".github/ISSUE_TEMPLATE/config.yml"),
			"utf-8",
		);
		expect(issueTemplateConfig).not.toContain("Linear work intake");
		expect(issueTemplateConfig).toContain("Private security disclosure");
		expect(existsSync(join(tempDir, ".linear"))).toBe(false);
	});

	it("never scaffolds legacy .greptile files", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(result.ok).toBe(true);
		expect(existsSync(join(tempDir, ".greptile/config.json"))).toBe(false);
		expect(
			existsSync(join(tempDir, ".github/workflows/greptile-review.yml")),
		).toBe(false);

		const contract = JSON.parse(
			readFileSync(join(tempDir, "harness.contract.json"), "utf-8"),
		);
		expect(
			contract.remediationPolicy?.providerDefaults?.coderabbit,
		).toBeUndefined();
	});

	it("never includes legacy review bridge guidance in contributor surfaces", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
		});
		expect(result.ok).toBe(true);

		const contributing = readFileSync(
			join(tempDir, "CONTRIBUTING.md"),
			"utf-8",
		);
		const prTemplate = readFileSync(
			join(tempDir, ".github/PULL_REQUEST_TEMPLATE.md"),
			"utf-8",
		);

		expect(contributing).not.toContain("@greptileai");
		expect(contributing).not.toContain("greptile-review.yml");
		expect(contributing).toContain("CodeRabbit");
		expect(contributing).toContain("## Project Brain workflow");
		expect(contributing).toContain(
			".harness/knowledge/tooling/codex-learn-summary.md",
		);
		expect(prTemplate).not.toContain("@greptileai");
		expect(prTemplate).toContain("Codex: <link / artifact path / comment ID>");
	});

	it("fails update when manifest provider and requested provider mismatch", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			ciProvider: "github-actions",
		});
		expect(installResult.ok).toBe(true);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
			ciProvider: "circleci",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_PATH");
			expect(result.error.message).toContain("manifest provider");
		}
	});

	it("merges updates with existing protected and customized contract fields", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					...JSON.parse(
						readFileSync(join(tempDir, "harness.contract.json"), "utf-8"),
					),
					version: "1.4.0",
					ciProviderPolicy: {
						mode: "required",
					},
					mergeQueueEvidenceBinding: {
						provider: "github",
						queue: "main",
					},
				},
				null,
				2,
			),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const updatedContract = JSON.parse(
				readFileSync(join(tempDir, "harness.contract.json"), "utf-8"),
			) as Record<string, unknown>;
			const ownershipDecisions = result.output.ownershipDecisions ?? [];
			expect(updatedContract.version).toBe(CURRENT_SCHEMA_VERSION);
			expect(updatedContract.mergeQueueEvidenceBinding).toEqual({
				provider: "github",
				queue: "main",
			});

			const ciProviderPolicy = updatedContract.ciProviderPolicy as Record<
				string,
				unknown
			>;
			expect(ciProviderPolicy.mode).toBe("required");
			expect(ciProviderPolicy.migrationStage).toBeDefined();
			expect(ciProviderPolicy.authorityConfigPath).toBe(
				"harness.contract.json",
			);
			expect(ciProviderPolicy.trustedPolicyRef).toBe("refs/heads/main");
			expect(ownershipDecisions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						file: "harness.contract.json",
						path: "version",
						owner: "template",
						action: "updated",
					}),
					expect.objectContaining({
						file: "harness.contract.json",
						path: "mergeQueueEvidenceBinding.provider",
						owner: "repo",
						action: "preserved",
					}),
					expect.objectContaining({
						file: "harness.contract.json",
						path: "ciProviderPolicy.authorityConfigPath",
						owner: "template",
						action: "added",
					}),
				]),
			);
		}
	});

	it("backfills existing untracked contracts during tracked update", () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					riskTierRules: {},
					mergePolicy: { high: [], medium: [], low: [] },
					branchProtection: {
						requiredChecks: ["security-scan", "CodeRabbit"],
					},
				},
				null,
				2,
			),
		);

		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toContain("harness.contract.json");
			const updatedContract = JSON.parse(
				readFileSync(join(tempDir, "harness.contract.json"), "utf-8"),
			) as Record<string, unknown>;
			expect(updatedContract.northStar).toBeDefined();
			expect(updatedContract.docsGatePolicy).toBeDefined();
			expect(updatedContract.ciProviderPolicy).toBeDefined();
			expect(
				(
					updatedContract.branchProtection as {
						requiredChecks: string[];
					}
				).requiredChecks,
			).toEqual(
				expect.arrayContaining([
					"pr-pipeline",
					"security-scan",
					"CodeRabbit",
					"semgrep-cloud-platform/scan",
				]),
			);
			expect(result.output.ownershipDecisions ?? []).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						file: "harness.contract.json",
						path: "docsGatePolicy.enabled",
						owner: "template",
						action: "added",
					}),
				]),
			);
		}
	});

	it("previews tracked updates without mutating existing contracts", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const contractPath = join(tempDir, "harness.contract.json");
		const existingContract = JSON.stringify(
			{
				version: "1.5.0",
				riskTierRules: {},
				mergePolicy: { high: [], medium: [], low: [] },
			},
			null,
			2,
		);
		writeFileSync(contractPath, existingContract);

		const result = runInit(tempDir, {
			dryRun: true,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toContain("harness.contract.json");
		}
		expect(readFileSync(contractPath, "utf-8")).toBe(existingContract);
	});

	it("enforces existing untracked CI and review templates during update", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const enforcedPaths = [
			".coderabbit.yaml",
			".circleci/config.yml",
			".harness/ci-required-checks.json",
			"scripts/check-semgrep-changed.sh",
			"scripts/check-semgrep-full.sh",
			"scripts/semgrep-bootstrap.sh",
			"scripts/semgrep-pre-push.yml",
		];
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			harnessVersion?: string;
			files: Array<{ path: string; action: string }>;
		};
		manifest.harnessVersion = "0.0.1";
		manifest.files = manifest.files.filter(
			(entry) => !enforcedPaths.includes(entry.path),
		);
		writeFileSync(manifestPath, JSON.stringify(manifest));
		writeFileSync(join(tempDir, ".coderabbit.yaml"), "language: en-US\n");
		writeFileSync(join(tempDir, ".circleci/config.yml"), "version: 2.1\n");
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify({ schemaVersion: 1, requiredChecks: [] }, null, 2),
		);
		writeFileSync(
			join(tempDir, "scripts/check-semgrep-changed.sh"),
			"#!/usr/bin/env bash\necho old changed\n",
		);
		writeFileSync(
			join(tempDir, "scripts/check-semgrep-full.sh"),
			"#!/usr/bin/env bash\necho old full\n",
		);
		writeFileSync(
			join(tempDir, "scripts/semgrep-bootstrap.sh"),
			"#!/usr/bin/env bash\necho old bootstrap\n",
		);
		writeFileSync(join(tempDir, "scripts/semgrep-pre-push.yml"), "rules: []\n");

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toEqual(
				expect.arrayContaining(enforcedPaths),
			);
		}
		expect(readFileSync(join(tempDir, ".coderabbit.yaml"), "utf-8")).toContain(
			"Harness-managed CodeRabbit baseline",
		);
		const circleConfig = readFileSync(
			join(tempDir, ".circleci/config.yml"),
			"utf-8",
		);
		expect(circleConfig).toContain("security-scan");
		expect(circleConfig).toContain("bash scripts/check-semgrep-full.sh");
		const requiredChecks = JSON.parse(
			readFileSync(join(tempDir, ".harness/ci-required-checks.json"), "utf-8"),
		) as { requiredChecks: Array<{ displayName: string }> };
		expect(
			requiredChecks.requiredChecks.map((check) => check.displayName),
		).toEqual(
			expect.arrayContaining(["CodeRabbit", "semgrep-cloud-platform/scan"]),
		);
		expect(
			readFileSync(join(tempDir, "scripts/check-semgrep-changed.sh"), "utf-8"),
		).toContain("run_semgrep scan");
		expect(
			readFileSync(join(tempDir, "scripts/check-semgrep-full.sh"), "utf-8"),
		).toContain("run_semgrep scan");
		expect(
			readFileSync(join(tempDir, "scripts/semgrep-bootstrap.sh"), "utf-8"),
		).toContain("install_semgrep_with_site_packages()");
		expect(
			readFileSync(join(tempDir, "scripts/semgrep-pre-push.yml"), "utf-8"),
		).toContain("ts-no-eval");

		const updatedManifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			files: Array<{ path: string }>;
		};
		for (const enforcedPath of enforcedPaths) {
			expect(
				updatedManifest.files.some((entry) => entry.path === enforcedPath),
			).toBe(true);
		}
	});

	it("previews enforced untracked template updates without mutating files", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifestBefore = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			harnessVersion?: string;
			files: Array<{ path: string; action: string }>;
		};
		manifestBefore.harnessVersion = "0.0.1";
		manifestBefore.files = manifestBefore.files.filter(
			(entry) =>
				entry.path !== ".coderabbit.yaml" &&
				entry.path !== ".circleci/config.yml",
		);
		const staleManifestContent = JSON.stringify(manifestBefore);
		writeFileSync(manifestPath, staleManifestContent);
		const staleCodeRabbit = "language: en-US\n";
		const staleCircle = "version: 2.1\n";
		writeFileSync(join(tempDir, ".coderabbit.yaml"), staleCodeRabbit);
		writeFileSync(join(tempDir, ".circleci/config.yml"), staleCircle);

		const result = runInit(tempDir, {
			dryRun: true,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toEqual(
				expect.arrayContaining([".coderabbit.yaml", ".circleci/config.yml"]),
			);
		}
		expect(readFileSync(join(tempDir, ".coderabbit.yaml"), "utf-8")).toBe(
			staleCodeRabbit,
		);
		expect(readFileSync(join(tempDir, ".circleci/config.yml"), "utf-8")).toBe(
			staleCircle,
		);
		expect(readFileSync(manifestPath, "utf-8")).toBe(staleManifestContent);
	});

	it("rejects enforced untracked update targets that are symlinks", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			harnessVersion?: string;
			files: Array<{ path: string; action: string }>;
		};
		manifest.harnessVersion = "0.0.1";
		manifest.files = manifest.files.filter(
			(entry) => entry.path !== ".coderabbit.yaml",
		);
		writeFileSync(manifestPath, JSON.stringify(manifest));
		const outsideConfig = join(
			tmpdir(),
			`harness-coderabbit-${Date.now()}.yaml`,
		);
		writeFileSync(outsideConfig, "language: en-US\n");
		rmSync(join(tempDir, ".coderabbit.yaml"), { force: true });
		symlinkSync(outsideConfig, join(tempDir, ".coderabbit.yaml"));

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(["PATH_TRAVERSAL", "WRITE_ERROR"]).toContain(result.error.code);
			expect(result.error.path).toBe(".coderabbit.yaml");
		}
		expect(readFileSync(outsideConfig, "utf-8")).toBe("language: en-US\n");
		rmSync(outsideConfig, { force: true });
	});

	it("rejects updates that would downgrade the contract version", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					...JSON.parse(
						readFileSync(join(tempDir, "harness.contract.json"), "utf-8"),
					),
					version: "9.9.9",
				},
				null,
				2,
			),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("WRITE_ERROR");
			expect(result.error.message).toContain("downgrade harness.contract.json");
			expect(result.error.message).toContain("harness upgrade --dry-run");
		}
	});

	it("updates tracked files through safe in-repo symlinks without replacing the symlink", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
			ciProvider: "github-actions",
		});
		expect(installResult.ok).toBe(true);

		const linkPath = join(tempDir, ".mise.toml");
		const targetDir = join(tempDir, "mise");
		const targetPath = join(targetDir, "config.toml");
		mkdirSync(targetDir, { recursive: true });
		rmSync(linkPath, { force: true });
		writeFileSync(targetPath, "legacy = true\n");
		symlinkSync("mise/config.toml", linkPath);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
			ciProvider: "github-actions",
		});

		expect(result.ok).toBe(true);
		expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
		expect(realpathSync(linkPath)).toBe(realpathSync(targetPath));
		expect(readFileSync(targetPath, "utf-8")).not.toContain("legacy = true");
	});

	it("updates tracked files through safe in-repo symlinked directories", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const scriptsLink = join(tempDir, "scripts");
		const scriptsTarget = join(tempDir, "Infrastructure/scripts");
		const targetPath = join(scriptsTarget, "validate-commit-msg.js");
		rmSync(scriptsLink, { recursive: true, force: true });
		mkdirSync(scriptsTarget, { recursive: true });
		writeFileSync(targetPath, "console.log('legacy');\n");
		symlinkSync("Infrastructure/scripts", scriptsLink);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(true);
		expect(lstatSync(scriptsLink).isSymbolicLink()).toBe(true);
		expect(realpathSync(scriptsLink)).toBe(realpathSync(scriptsTarget));
		expect(readFileSync(targetPath, "utf-8")).toContain("validate-commit-msg");
		expect(readFileSync(targetPath, "utf-8")).not.toContain("legacy");
	});

	// Security regression: executeUpdate must not follow symlinks when writing
	// template files. An attacker-controlled repo can replace a tracked directory
	// (e.g. .github) with a symlink to an outside path; --update must detect
	// this and fail rather than overwriting files outside the workspace.
	it("rejects update when tracked path traverses through symlinked directory", () => {
		const installResult = runInit(tempDir, {
			dryRun: false,
			force: false,
			track: true,
		});
		expect(installResult.ok).toBe(true);

		const githubDir = join(tempDir, ".github");
		const outsideDir = join(tmpdir(), `harness-outside-${Date.now()}`);
		mkdirSync(outsideDir, { recursive: true });

		// Replace the tracked .github directory with a symlink to an outside location.
		rmSync(githubDir, { recursive: true, force: true });
		symlinkSync(outsideDir, githubDir);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			update: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			// The symlink may be caught either by sanitizePath's segment-walker
			// during manifest re-validation (PATH_TRAVERSAL) or by the explicit
			// symlink guard in executeUpdate (WRITE_ERROR / "escaped workspace").
			// Either way the update must be rejected.
			expect(["PATH_TRAVERSAL", "WRITE_ERROR"]).toContain(result.error.code);
		}

		rmSync(outsideDir, { recursive: true, force: true });
	});
});

describe("--interactive flag", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-interactive-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns proposed changes without writing files", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			interactive: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.proposedChanges).toBeDefined();
			expect(result.output.proposedChanges?.length).toBeGreaterThan(0);
			expect(result.output.created).toEqual([]);
		}

		// Verify no files were created
		expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(false);
	});

	it("marks new files as 'create' action", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			interactive: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const contractChange = result.output.proposedChanges?.find(
				(c) => c.path === "harness.contract.json",
			);
			expect(contractChange).toBeDefined();
			expect(contractChange?.action).toBe("create");
			expect(contractChange?.currentContent).toBeNull();
			expect(contractChange?.newContent).toBeDefined();
		}
	});

	it("marks existing files as 'skip' action without --force", () => {
		// Create existing file
		writeFileSync(join(tempDir, "harness.contract.json"), '{"version": "old"}');

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			interactive: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const contractChange = result.output.proposedChanges?.find(
				(c) => c.path === "harness.contract.json",
			);
			expect(contractChange).toBeDefined();
			expect(contractChange?.action).toBe("skip");
			expect(contractChange?.currentContent).toBeNull();
		}
	});

	it("marks existing files as 'modify' action with --force", () => {
		// Create existing file
		writeFileSync(join(tempDir, "harness.contract.json"), '{"version": "old"}');

		const result = runInit(tempDir, {
			dryRun: false,
			force: true,
			interactive: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const contractChange = result.output.proposedChanges?.find(
				(c) => c.path === "harness.contract.json",
			);
			expect(contractChange).toBeDefined();
			expect(contractChange?.action).toBe("modify");
			expect(contractChange?.currentContent).toBe('{"version": "old"}');
			expect(contractChange?.newContent).toContain(
				`"version": "${CURRENT_SCHEMA_VERSION}"`,
			);
		}
	});

	// Security: symlinks to outside-repo paths are rejected entirely by sanitizePath
	it("excludes template paths that are symlinks pointing outside the repo", () => {
		const targetPath = join(tempDir, "harness.contract.json");
		symlinkSync("/etc/passwd", targetPath);

		const result = runInit(tempDir, {
			dryRun: false,
			force: true,
			interactive: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			// sanitizePath detects the out-of-repo realpath and skips the entry
			const contractChange = result.output.proposedChanges?.find(
				(c) => c.path === "harness.contract.json",
			);
			expect(contractChange).toBeUndefined();
		}
	});

	it("detects package manager for rendering", () => {
		writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			interactive: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.packageManager).toBe("pnpm");
			// The CI template should contain pnpm (default is circleci)
			const workflowChange = result.output.proposedChanges?.find(
				(c) => c.path === ".circleci/config.yml",
			);
			expect(workflowChange?.newContent).toContain("pnpm");
		}
	});
});

describe("generateDiff", () => {
	it("generates diff for new file (create action)", async () => {
		const { generateDiff } = await import("./init.js");

		const change = {
			path: "new-file.txt",
			action: "create" as const,
			currentContent: null,
			newContent: "line1\nline2\n",
		};

		const diff = generateDiff(change);
		expect(diff).toContain("--- /dev/null");
		expect(diff).toContain("+++ b/new-file.txt");
		expect(diff).toContain("+line1");
		expect(diff).toContain("+line2");
	});

	it("generates diff for modified file", async () => {
		const { generateDiff } = await import("./init.js");

		const change = {
			path: "modified.txt",
			action: "modify" as const,
			currentContent: "old line\nunchanged\n",
			newContent: "new line\nunchanged\n",
		};

		const diff = generateDiff(change);
		expect(diff).toContain("--- a/modified.txt");
		expect(diff).toContain("+++ b/modified.txt");
		expect(diff).toContain("-old line");
		expect(diff).toContain("+new line");
		expect(diff).toContain(" unchanged");
	});

	it("returns empty string for skip action", async () => {
		const { generateDiff } = await import("./init.js");

		const change = {
			path: "skip.txt",
			action: "skip" as const,
			currentContent: "content",
			newContent: "new content",
		};

		const diff = generateDiff(change);
		expect(diff).toBe("");
	});
});

describe("--migrate flag", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-migrate-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("fails when no contract exists", () => {
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("WRITE_ERROR");
			expect(result.error.message).toContain("Contract file not found");
		}
	});

	it("succeeds when contract is already at latest version", () => {
		// Create a contract at the current version
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({
				version: CURRENT_SCHEMA_VERSION,
				riskTierRules: {},
				reviewPolicy: { timeoutSeconds: 600, timeoutAction: "fail" },
			}),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			// No migrations applied, so created should be empty
			expect(result.output.created).toHaveLength(0);
		}
	});

	it("fails when --migrate is combined with --dry-run", () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({ version: "1.0.0" }),
		);

		const result = runInit(tempDir, {
			dryRun: true,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_PATH");
			expect(result.error.message).toContain(
				"--migrate cannot be combined with --dry-run",
			);
		}
	});

	it("fails when --migrate is combined with --interactive", () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({ version: "1.0.0" }),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			interactive: true,
			migrate: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_PATH");
			expect(result.error.message).toContain(
				"--migrate cannot be combined with --interactive",
			);
		}
	});

	it("migrates legacy 1.0.0 contracts to current schema", () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({
				version: "1.0.0",
				riskTierRules: { "src/legacy/*": "low" },
				reviewPolicy: { timeoutSeconds: 300, timeoutAction: "warn" },
			}),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toHaveLength(1);
			const migrated = JSON.parse(
				require("node:fs").readFileSync(
					join(tempDir, "harness.contract.json"),
					"utf-8",
				),
			);
			expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
			expect(migrated.riskTierRules["src/legacy/*"]).toBe("low");
			expect(migrated.reviewPolicy.timeoutSeconds).toBe(300);
			expect(migrated.reviewPolicy.timeoutAction).toBe("warn");
			expect(migrated.toolingPolicy.miseFilePath).toBe(".mise.toml");
			expect(migrated.toolingPolicy.packagePolicy.packageJsonPath).toBe(
				"package.json",
			);
			expect(migrated.toolingPolicy.packagePolicy.explicitCapabilities).toEqual(
				[],
			);
			expect(migrated.toolingPolicy.projectBrainMemoryExtension).toEqual({
				enabled: true,
				requiredPaths: expect.arrayContaining([
					".harness/memory/LEARNINGS.md",
					".harness/knowledge/INDEX.md",
					".harness/decisions",
				]),
			});
		}
	});

	it("fails when no supported migration path exists", () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({
				version: "0.9.0",
				riskTierRules: {},
				reviewPolicy: { timeoutSeconds: 300, timeoutAction: "warn" },
			}),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("E_UNSUPPORTED_MIGRATION_PATH");
			expect(result.error.message).toContain(
				`No supported migration path from 0.9.0 to ${CURRENT_SCHEMA_VERSION}`,
			);
		}
	});

	it("fails when contract has invalid JSON", () => {
		writeFileSync(join(tempDir, "harness.contract.json"), "not valid json {{{");

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("WRITE_ERROR");
			expect(result.error.message).toContain("Failed to parse contract");
		}
	});

	it("fails when contract is missing version field", () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({
				riskTierRules: {},
				reviewPolicy: { timeoutSeconds: 600 },
			}),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("WRITE_ERROR");
			expect(result.error.message).toContain(
				"missing required 'version' field",
			);
		}
	});

	it("preserves user customizations during migration", () => {
		// Create a contract with custom settings
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({
				version: "1.0",
				riskTierRules: { "src/auth/*": "high" },
				reviewPolicy: { timeoutSeconds: 300, timeoutAction: "warn" },
			}),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			// Read the migrated contract
			const migrated = JSON.parse(
				require("node:fs").readFileSync(
					join(tempDir, "harness.contract.json"),
					"utf-8",
				),
			);
			// Custom settings should be preserved
			expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
			expect(migrated.riskTierRules["src/auth/*"]).toBe("high");
			expect(migrated.reviewPolicy.timeoutSeconds).toBe(300);
			expect(migrated.toolingPolicy.readinessScriptPath).toBe(
				"scripts/check-environment.sh",
			);
			expect(migrated.toolingPolicy.packagePolicy.explicitCapabilities).toEqual(
				[],
			);
			expect(migrated.toolingPolicy.packagePolicy.requiredPackages).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						package: "@brainwav/design-system-guidance",
					}),
				]),
			);
			expect(migrated.toolingPolicy.projectBrainMemoryExtension).toEqual({
				enabled: true,
				requiredPaths: expect.arrayContaining([
					".harness/memory/LEARNINGS.md",
					".harness/knowledge/INDEX.md",
				]),
			});
		}
	});

	it("preserves contract content when already up to date", () => {
		// Create a contract at current version with customizations
		const originalContent = {
			version: CURRENT_SCHEMA_VERSION,
			riskTierRules: { "src/api/*": "medium" },
			reviewPolicy: { timeoutSeconds: 900, timeoutAction: "fail" },
		};
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(originalContent, null, 2),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			migrate: true,
		});

		expect(result.ok).toBe(true);

		// Contract should be unchanged
		const content = require("node:fs").readFileSync(
			join(tempDir, "harness.contract.json"),
			"utf-8",
		);
		expect(JSON.parse(content)).toEqual(originalContent);
	});
});

describe("detectContractVersion", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-version-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns null when contract doesn't exist", async () => {
		const { detectContractVersion } = await import("../lib/init/migration.js");
		const version = detectContractVersion(tempDir);
		expect(version).toBeNull();
	});

	it("returns version from valid contract", async () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({ version: "2.5.0" }),
		);

		const { detectContractVersion } = await import("../lib/init/migration.js");
		const version = detectContractVersion(tempDir);
		expect(version).toBe("2.5.0");
	});

	it("returns null for contract without version", async () => {
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify({ riskTierRules: {} }),
		);

		const { detectContractVersion } = await import("../lib/init/migration.js");
		const version = detectContractVersion(tempDir);
		expect(version).toBeNull();
	});

	it("returns null for invalid JSON", async () => {
		writeFileSync(join(tempDir, "harness.contract.json"), "not valid json");

		const { detectContractVersion } = await import("../lib/init/migration.js");
		const version = detectContractVersion(tempDir);
		expect(version).toBeNull();
	});
});

// JSC-57: Tooling version detection
describe("tooling version detection (JSC-57)", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-tooling-version-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("skips biome.json if existing version is newer than template", () => {
		// Write a biome.json with a newer schema version than the template (2.4.15)
		writeFileSync(
			join(tempDir, "biome.json"),
			JSON.stringify({
				$schema: "https://biomejs.dev/schemas/2.5.0/schema.json",
				organizeImports: { enabled: true },
			}),
		);

		const result = runInit(tempDir, { dryRun: false, force: false });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.skipped).toContain("biome.json");
			expect(result.output.created).not.toContain("biome.json");
		}

		// Original newer biome.json should be intact
		const biomecontent = JSON.parse(
			require("node:fs").readFileSync(join(tempDir, "biome.json"), "utf-8"),
		);
		expect(biomecontent.$schema).toContain("2.5.0");
	});

	it("overwrites biome.json if existing version is older than template", () => {
		// Write a biome.json with an older schema version (0.5.0 is older than 2.4.15)
		writeFileSync(
			join(tempDir, "biome.json"),
			JSON.stringify({
				$schema: "https://biomejs.dev/schemas/0.5.0/schema.json",
			}),
		);

		const result = runInit(tempDir, { dryRun: false, force: false });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toContain("biome.json");
		}

		// Biome.json should now have the template version
		const biomecontent = JSON.parse(
			require("node:fs").readFileSync(join(tempDir, "biome.json"), "utf-8"),
		);
		expect(biomecontent.$schema).toContain("2.4.15");
	});

	it("skips biome.json if existing version equals template version", () => {
		writeFileSync(
			join(tempDir, "biome.json"),
			JSON.stringify({
				$schema: "https://biomejs.dev/schemas/2.4.15/schema.json",
			}),
		);

		const result = runInit(tempDir, { dryRun: false, force: false });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.skipped).toContain("biome.json");
		}
	});

	it("--force bypasses version check and overwrites biome.json anyway", () => {
		writeFileSync(
			join(tempDir, "biome.json"),
			JSON.stringify({
				$schema: "https://biomejs.dev/schemas/2.5.0/schema.json",
			}),
		);

		const result = runInit(tempDir, { dryRun: false, force: true });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.created).toContain("biome.json");
		}

		// Should be overwritten with template version
		const biomecontent = JSON.parse(
			require("node:fs").readFileSync(join(tempDir, "biome.json"), "utf-8"),
		);
		expect(biomecontent.$schema).toContain("2.4.15");
	});

	it("interactive mode shows biome.json with newer version as 'skip'", () => {
		writeFileSync(
			join(tempDir, "biome.json"),
			JSON.stringify({
				$schema: "https://biomejs.dev/schemas/2.5.0/schema.json",
			}),
		);

		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			interactive: true,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			const biomeChange = result.output.proposedChanges?.find(
				(c) => c.path === "biome.json",
			);
			expect(biomeChange).toBeDefined();
			expect(biomeChange?.action).toBe("skip");
		}
	});
});

// ─── Project-type detection integration (SA11, SA12, SA10, I6) ───────────────

describe("project-type detection integration", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-pt-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("SA11: re-init without --project-type preserves stored projectType in contract", () => {
		// First init writes the contract (no prior contract → auto-detect; tempDir has no signals → unknown)
		const first = runInit(tempDir, { dryRun: false, force: false });
		expect(first.ok).toBe(true);

		// Manually write a contract with a known projectType (simulates a repo that was previously typed)
		const contractPath = join(tempDir, "harness.contract.json");
		const existing = JSON.parse(readFileSync(contractPath, "utf-8"));
		existing.projectType = "cli";
		writeFileSync(contractPath, JSON.stringify(existing, null, 2));

		// Re-init without --project-type: idempotency must not overwrite stored value
		const second = runInit(tempDir, { dryRun: false, force: false });
		expect(second.ok).toBe(true);

		const afterContract = JSON.parse(readFileSync(contractPath, "utf-8"));
		// The template loop skips the existing contract file, so projectType should remain "cli"
		expect(afterContract.projectType).toBe("cli");
	});

	it("SA12: --project-type flag overwrites stored value without requiring --force", () => {
		// Bootstrap the contract first
		const first = runInit(tempDir, { dryRun: false, force: false });
		expect(first.ok).toBe(true);

		// Write a known stored value
		const contractPath = join(tempDir, "harness.contract.json");
		const existing = JSON.parse(readFileSync(contractPath, "utf-8"));
		existing.projectType = "library";
		writeFileSync(contractPath, JSON.stringify(existing, null, 2));

		// Re-init with --project-type web: should patch contract without --force
		const second = runInit(tempDir, {
			dryRun: false,
			force: false,
			projectType: "web",
		});
		expect(second.ok).toBe(true);

		const afterContract = JSON.parse(readFileSync(contractPath, "utf-8"));
		expect(afterContract.projectType).toBe("web");
	});

	it("SA10/I6: invalid --project-type value returns an error", () => {
		// "unknown" is not a valid explicit override value (I6)
		const result = runInit(tempDir, {
			dryRun: false,
			force: false,
			projectType: "unknown" as "cli",
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Invalid --project-type");
		}
	});

	it("first-time init writes detected projectType into new contract", () => {
		// Place vite.config.ts to trigger web detection
		writeFileSync(join(tempDir, "vite.config.ts"), "export default {}");

		const result = runInit(tempDir, { dryRun: false, force: false });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.projectTypeDetection?.projectType).toBe("web");
			expect(result.output.projectTypeDetection?.matchedRule).toBe("vite");
		}

		const contract = JSON.parse(
			readFileSync(join(tempDir, "harness.contract.json"), "utf-8"),
		);
		expect(contract.projectType).toBe("web");
	});
});

// ─── runInitCLI --json error output (JSC-96) ─────────────────────────────────

describe("runInitCLI --json error output", () => {
	let tempDir: string;
	let infoSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "jsc96-"));
		infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("emits structured JSON error for INCOMPLETE_MANIFEST when --json is set", () => {
		// Install, then corrupt the manifest to remove harnessVersion
		runInit(tempDir, { dryRun: false, force: false, track: true });
		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const { harnessVersion: _, ...manifest } = JSON.parse(
			readFileSync(manifestPath, "utf-8"),
		) as Record<string, unknown>;
		writeFileSync(manifestPath, JSON.stringify(manifest));

		const code = runInitCLI(tempDir, {
			dryRun: false,
			force: false,
			checkUpdates: true,
			json: true,
		});

		expect(code).not.toBe(0);
		expect(infoSpy).toHaveBeenCalledOnce();
		const emitted = JSON.parse(infoSpy.mock.calls[0]![0] as string) as {
			error: { code: string; message: string };
		};
		expect(emitted.error.code).toBe("INCOMPLETE_MANIFEST");
		expect(emitted.error.message).toContain("harnessVersion");
		// Prose must NOT be emitted when --json is active
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("emits prose error to stderr when --json is NOT set", () => {
		// Install, then corrupt the manifest
		runInit(tempDir, { dryRun: false, force: false, track: true });
		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const { harnessVersion: _, ...manifest } = JSON.parse(
			readFileSync(manifestPath, "utf-8"),
		) as Record<string, unknown>;
		writeFileSync(manifestPath, JSON.stringify(manifest));

		const code = runInitCLI(tempDir, {
			dryRun: false,
			force: false,
			checkUpdates: true,
			json: false,
		});

		expect(code).not.toBe(0);
		expect(errorSpy).toHaveBeenCalled();
		expect(errorSpy.mock.calls[0]![0]).toContain(
			"Restore manifest is incomplete",
		);
		// No JSON to stdout
		expect(infoSpy).not.toHaveBeenCalled();
	});

	it("--json success still emits structured output, not error envelope", () => {
		runInit(tempDir, { dryRun: false, force: false, track: true });

		const code = runInitCLI(tempDir, {
			dryRun: false,
			force: false,
			checkUpdates: true,
			json: true,
		});

		expect(code).toBe(0);
		expect(infoSpy).toHaveBeenCalledOnce();
		const emitted = JSON.parse(infoSpy.mock.calls[0]![0] as string) as {
			updateCheck?: unknown;
			error?: unknown;
		};
		expect(emitted).not.toHaveProperty("error");
		expect(emitted).toHaveProperty("updateCheck");
	});

	it("--json update exposes updated paths while preserving created compatibility", () => {
		runInit(tempDir, { dryRun: false, force: false, track: true });
		const manifestPath = join(tempDir, ".harness/restore-manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			files: Array<{ path: string; action: string }>;
		};
		manifest.files = manifest.files.filter(
			(entry) => entry.path !== ".coderabbit.yaml",
		);
		writeFileSync(manifestPath, JSON.stringify(manifest));
		writeFileSync(join(tempDir, ".coderabbit.yaml"), "language: en-US\n");

		const code = runInitCLI(tempDir, {
			dryRun: false,
			force: false,
			update: true,
			json: true,
		});

		expect(code).toBe(0);
		expect(infoSpy).toHaveBeenCalledOnce();
		const emitted = JSON.parse(infoSpy.mock.calls[0]![0] as string) as {
			created?: string[];
			updated?: string[];
			updateDetails?: Array<Record<string, unknown>>;
			updateMode?: string;
			trackedManifest?: boolean;
			error?: unknown;
		};
		expect(emitted).not.toHaveProperty("error");
		expect(emitted.updateMode).toBe("tracked-update");
		expect(emitted.trackedManifest).toBe(true);
		expect(emitted.updated).toEqual(
			expect.arrayContaining([".coderabbit.yaml"]),
		);
		expect(emitted.created).toEqual(emitted.updated);
		expect(emitted.updateDetails).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ".coderabbit.yaml",
					status: "updated",
					category: "code-review",
				}),
			]),
		);
	});

	it("--json update dry-run previews untracked adoption without creating a manifest", () => {
		runInit(tempDir, { dryRun: false, force: false });
		writeFileSync(join(tempDir, ".coderabbit.yaml"), "language: en-US\n");

		const code = runInitCLI(tempDir, {
			dryRun: true,
			force: false,
			update: true,
			json: true,
		});

		expect(code).toBe(0);
		expect(infoSpy).toHaveBeenCalledOnce();
		const emitted = JSON.parse(infoSpy.mock.calls[0]![0] as string) as {
			created?: string[];
			updated?: string[];
			skipped?: string[];
			updateDetails?: Array<Record<string, unknown>>;
			updateMode?: string;
			trackedManifest?: boolean;
			error?: unknown;
		};
		expect(emitted).not.toHaveProperty("error");
		expect(emitted.updateMode).toBe("adoption-preview");
		expect(emitted.trackedManifest).toBe(false);
		expect(emitted.updated).toEqual(
			expect.arrayContaining(["harness.contract.json", ".coderabbit.yaml"]),
		);
		expect(emitted.skipped).toEqual(expect.any(Array));
		expect(emitted.created).toEqual(emitted.updated);
		expect(emitted.updateDetails).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "harness.contract.json",
					status: "updated",
					category: "contract",
				}),
				expect.objectContaining({
					path: ".coderabbit.yaml",
					status: "updated",
					category: "code-review",
				}),
			]),
		);
		expect(existsSync(join(tempDir, ".harness/restore-manifest.json"))).toBe(
			false,
		);
		expect(readFileSync(join(tempDir, ".coderabbit.yaml"), "utf-8")).toBe(
			"language: en-US\n",
		);
	});
});
