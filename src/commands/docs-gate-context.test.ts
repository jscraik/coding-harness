import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_CI_PROVIDER_POLICY,
	DEFAULT_CONTEXT_INTEGRITY_POLICY,
} from "../lib/contract/types.js";
import {
	isGitEnvironmentKey,
	sanitizeGitEnvironment,
} from "../lib/git/safe-env.js";
import { runDocsGate } from "./docs-gate.js";

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

function createTestRoot(label: string): string {
	return mkdtempSync(join(tmpdir(), `${label}-`));
}

function seedRequiredTruthSources(root: string): void {
	write(join(root, "README.md"), "# README\nUse `pnpm test`.\n");
	write(join(root, "AGENTS.md"), "# AGENTS\nRun `pnpm test`.\n");
	write(join(root, "CONTRIBUTING.md"), "# CONTRIBUTING\n");
	write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
	write(
		join(root, "docs/agents/00-architecture-bootstrap.md"),
		"# Bootstrap\n",
	);
	write(
		join(root, "package.json"),
		JSON.stringify({ packageManager: "pnpm@10.33.0" }, null, 2),
	);
}

function createContractWithDocsGate(
	root: string,
	docsGatePolicy: unknown,
	{ seedTruthSources = true }: { seedTruthSources?: boolean } = {},
): void {
	const contract = {
		version: "1.5.0",
		docsGatePolicy,
		contextIntegrityPolicy: DEFAULT_CONTEXT_INTEGRITY_POLICY,
	};
	write(join(root, "harness.contract.json"), JSON.stringify(contract, null, 2));
	if (seedTruthSources) {
		seedRequiredTruthSources(root);
	}
}

function createIsolatedGitEnv(): NodeJS.ProcessEnv {
	return sanitizeGitEnvironment({ policy: "strict" });
}

function runDocsGateWithIsolatedGitEnv(
	options: Parameters<typeof runDocsGate>[0],
): ReturnType<typeof runDocsGate> {
	const savedGitEnv = Object.entries(process.env).filter(([key]) =>
		isGitEnvironmentKey(key),
	);
	for (const [key] of savedGitEnv) {
		delete process.env[key];
	}
	try {
		return runDocsGate(options);
	} finally {
		for (const key of Object.keys(process.env)) {
			if (isGitEnvironmentKey(key)) {
				delete process.env[key];
			}
		}
		for (const [key, value] of savedGitEnv) {
			if (value === undefined) {
				delete process.env[key];
				continue;
			}
			process.env[key] = value;
		}
	}
}

describe("docs-gate command", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) {
			rmSync(root, { recursive: true, force: true });
		}
		roots.length = 0;
	});
	it("emits source_truth_missing contradictions for missing required truth sources", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"docs-gate-test-contradiction-1",
		);
		roots.push(root);
		createContractWithDocsGate(
			root,
			{
				enabled: true,
				mode: "required",
				rules: [],
			},
			{ seedTruthSources: false },
		);

		write(join(root, "README.md"), "# README\n");
		write(join(root, "CONTRIBUTING.md"), "# CONTRIBUTING\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "pnpm@10.33.0" }, null, 2),
		);

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["README.md"],
		});

		expect(result.exitCode).toBe(13);
		expect(result.report.outcome).toBe("policy_error");
		expect(result.report.summary.contradiction_count).toBeGreaterThan(0);
		expect(
			result.report.findings.some(
				(finding) =>
					finding.category === "source_truth_missing" &&
					finding.path === "AGENTS.md",
			),
		).toBe(true);
		const historyPath = join(
			root,
			"artifacts/context-integrity/contradiction-history.jsonl",
		);
		expect(readFileSync(historyPath, "utf-8")).toContain('"status":"open"');
	});

	it("emits command_contract_conflict contradictions when canonical docs use the wrong package manager", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"docs-gate-test-contradiction-2",
		);
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});

		write(
			join(root, "README.md"),
			"Use `npm install` before running the harness.\n",
		);
		write(join(root, "AGENTS.md"), "# AGENTS\nRun `pnpm test`.\n");
		write(join(root, "CONTRIBUTING.md"), "# CONTRIBUTING\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "docs/agents/00-architecture-bootstrap.md"),
			"# Bootstrap\n",
		);
		write(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "pnpm@10.33.0" }, null, 2),
		);

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["README.md"],
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.outcome).toBe("drift_detected");
		expect(
			result.report.findings.some(
				(finding) =>
					finding.category === "command_contract_conflict" &&
					finding.path === "README.md",
			),
		).toBe(true);
	});

	it("emits required_check_conflict contradictions when workflow checks drift from branch protection", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"docs-gate-test-contradiction-3",
		);
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});

		write(join(root, "README.md"), "# README\nUse `pnpm test`.\n");
		write(join(root, "AGENTS.md"), "# AGENTS\nRun `pnpm test`.\n");
		write(join(root, "CONTRIBUTING.md"), "# CONTRIBUTING\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "docs/agents/00-architecture-bootstrap.md"),
			"# Bootstrap\n",
		);
		write(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "pnpm@10.33.0" }, null, 2),
		);
		write(
			join(root, ".github/workflows/pr-pipeline.yml"),
			[
				"name: PR Pipeline",
				"jobs:",
				"  lint:",
				"    name: lint",
				"    runs-on: ubuntu-latest",
			].join("\n"),
		);
		const contractPath = join(root, "harness.contract.json");
		const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			branchProtection?: { requiredChecks?: string[] };
		};
		contract.branchProtection = {
			requiredChecks: ["lint", "typecheck", "CodeRabbit"],
		};
		write(contractPath, JSON.stringify(contract, null, 2));

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: [".github/workflows/pr-pipeline.yml"],
		});

		expect(result.exitCode).toBe(12);
		expect(result.report.outcome).toBe("trust_mismatch");
		expect(
			result.report.findings.some(
				(finding) =>
					finding.category === "required_check_conflict" &&
					finding.path === ".github/workflows/pr-pipeline.yml",
			),
		).toBe(true);
	});

	it("ignores shared non-workflow required checks when evaluating workflow drift", () => {
		const root = createTestRoot("docs-gate-test-19");
		roots.push(root);
		createContractWithDocsGate(
			root,
			{
				enabled: true,
				mode: "required",
				rules: [],
			},
			{ seedTruthSources: false },
		);

		write(
			join(root, "README.md"),
			"# README\nUse `pnpm lint` and rely on external checks.\n",
		);
		write(join(root, "AGENTS.md"), "# AGENTS\n");
		write(
			join(root, "CONTRIBUTING.md"),
			"# CONTRIBUTING\n\n- Require status checks: `lint`, `CodeRabbit`\n",
		);
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "docs/agents/00-architecture-bootstrap.md"),
			"# Bootstrap\n",
		);
		write(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "pnpm@10.33.0" }, null, 2),
		);
		write(
			join(root, ".github/workflows/pr-pipeline.yml"),
			[
				"name: PR Pipeline",
				"jobs:",
				"  lint:",
				"    name: lint",
				"    runs-on: ubuntu-latest",
			].join("\n"),
		);
		const contractPath = join(root, "harness.contract.json");
		const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			branchProtection?: { requiredChecks?: string[] };
		};
		contract.branchProtection = {
			requiredChecks: ["lint", "CodeRabbit"],
		};
		write(contractPath, JSON.stringify(contract, null, 2));

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: [".github/workflows/pr-pipeline.yml"],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("ok");
		expect(
			result.report.findings.some(
				(finding) => finding.category === "required_check_conflict",
			),
		).toBe(false);
	});

	it("skips workflow drift checks when CircleCI is the active provider", () => {
		const root = createTestRoot("docs-gate-test-20");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});

		const contractPath = join(root, "harness.contract.json");
		const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			branchProtection?: { requiredChecks?: string[] };
			ciProviderPolicy?: {
				activeProvider?: string;
				migrationStage?: string;
				mode?: string;
			};
		};
		contract.branchProtection = {
			requiredChecks: ["lint", "typecheck", "CodeRabbit"],
		};
		contract.ciProviderPolicy = {
			...DEFAULT_CI_PROVIDER_POLICY,
			activeProvider: "circleci",
			migrationStage: "circleci-only",
			mode: "required",
		};
		write(contractPath, JSON.stringify(contract, null, 2));

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["README.md"],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("ok");
		expect(
			result.report.findings.some(
				(finding) => finding.category === "required_check_conflict",
			),
		).toBe(false);
	});

	it("uses trusted base refs to detect committed branch changes", () => {
		const root = createTestRoot("docs-gate-test-21");
		roots.push(root);
		const gitEnv = createIsolatedGitEnv();
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [
				{
					ruleId: "cli-surface-docs",
					when: { categories: ["cli_surface"] },
					requireDocs: ["README.md"],
					severity: "error",
				},
			],
		});

		execFileSync("git", ["init", "-b", "main"], { cwd: root, env: gitEnv });
		execFileSync("git", ["config", "user.email", "codex@example.com"], {
			cwd: root,
			env: gitEnv,
		});
		execFileSync("git", ["config", "user.name", "Codex"], {
			cwd: root,
			env: gitEnv,
		});
		execFileSync("git", ["add", "-f", "."], { cwd: root, env: gitEnv });
		execFileSync("git", ["commit", "-m", "base"], { cwd: root, env: gitEnv });
		const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: root,
			encoding: "utf-8",
			env: gitEnv,
		}).trim();

		write(join(root, "src/cli.ts"), "export const changed = true;\n");
		execFileSync("git", ["add", "src/cli.ts"], { cwd: root, env: gitEnv });
		execFileSync("git", ["commit", "-m", "feature"], {
			cwd: root,
			env: gitEnv,
		});

		const result = runDocsGateWithIsolatedGitEnv({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.report.changed_files).toContain("src/cli.ts");
		expect(result.report.categories).toContain("cli_surface");
		expect(result.report.outcome).toBe("drift_detected");
	});

	it("includes tracked worktree edits when auto-discovering changed files", () => {
		const root = createTestRoot("docs-gate-test-21b");
		roots.push(root);
		const gitEnv = createIsolatedGitEnv();
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [
				{
					ruleId: "cli-surface-docs",
					when: { categories: ["cli_surface"] },
					requireDocs: ["README.md"],
					severity: "error",
				},
			],
		});
		execFileSync("git", ["init", "-b", "main"], { cwd: root, env: gitEnv });
		execFileSync("git", ["config", "user.email", "codex@example.com"], {
			cwd: root,
			env: gitEnv,
		});
		execFileSync("git", ["config", "user.name", "Codex"], {
			cwd: root,
			env: gitEnv,
		});
		execFileSync("git", ["add", "-f", "."], { cwd: root, env: gitEnv });
		execFileSync("git", ["commit", "-m", "base"], { cwd: root, env: gitEnv });
		const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: root,
			encoding: "utf-8",
			env: gitEnv,
		}).trim();
		write(join(root, "src/cli.ts"), "export const changed = true;\n");

		const result = runDocsGateWithIsolatedGitEnv({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.report.changed_files).toContain("src/cli.ts");
		expect(result.report.categories).toContain("cli_surface");
		expect(result.report.outcome).toBe("drift_detected");
	});

	it("parses quoted activeProvider declarations when checking workflow policy conflicts", () => {
		const root = createTestRoot("docs-gate-test-22");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});

		const contractPath = join(root, "harness.contract.json");
		const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			ciProviderPolicy?: {
				activeProvider?: string;
				migrationStage?: string;
				mode?: string;
			};
		};
		contract.ciProviderPolicy = {
			...DEFAULT_CI_PROVIDER_POLICY,
			activeProvider: "circleci",
			migrationStage: "circleci-only",
			mode: "required",
		};
		write(contractPath, JSON.stringify(contract, null, 2));
		write(
			join(root, "docs/agents/17-ci-required-checks.md"),
			[
				"# CI Required Checks",
				"```json",
				'{ "activeProvider": "github-actions" }',
				"```",
			].join("\n"),
		);

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["docs/agents/17-ci-required-checks.md"],
		});

		expect(result.exitCode).toBe(12);
		expect(result.report.outcome).toBe("trust_mismatch");
		expect(
			result.report.findings.some(
				(finding) =>
					finding.category === "workflow_policy_conflict" &&
					finding.path === "docs/agents/17-ci-required-checks.md",
			),
		).toBe(true);
	});

	it("treats validation docs as workflow policy conflict sources", () => {
		const root = createTestRoot("docs-gate-test-23");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});

		const contractPath = join(root, "harness.contract.json");
		const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			ciProviderPolicy?: {
				activeProvider?: string;
				migrationStage?: string;
				mode?: string;
			};
		};
		contract.ciProviderPolicy = {
			...DEFAULT_CI_PROVIDER_POLICY,
			activeProvider: "circleci",
			migrationStage: "circleci-only",
			mode: "required",
		};
		write(contractPath, JSON.stringify(contract, null, 2));
		write(
			join(root, "docs/agents/04-validation.md"),
			["# Validation", "```yaml", "activeProvider: github-actions", "```"].join(
				"\n",
			),
		);

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["docs/agents/04-validation.md"],
		});

		expect(result.exitCode).toBe(12);
		expect(result.report.outcome).toBe("trust_mismatch");
		expect(
			result.report.findings.some(
				(finding) =>
					finding.category === "workflow_policy_conflict" &&
					finding.path === "docs/agents/04-validation.md",
			),
		).toBe(true);
	});

	it("keeps advisory archive candidates non-blocking in required mode", () => {
		const root = createTestRoot("docs-gate-archive-candidates");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});
		write(
			join(root, "docs/superseded.md"),
			[
				"---",
				"authority: supporting",
				"canon_class: supporting",
				"lifecycle_state: superseded",
				"last_reviewed: 2025-01-01",
				"---",
				"# Superseded",
			].join("\n"),
		);
		const env = createIsolatedGitEnv();
		execFileSync("git", ["init"], { cwd: root, env });
		execFileSync("git", ["add", "."], { cwd: root, env });

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: [],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("ok");
		expect(result.report.status).toBe("partial");
		expect(result.report.summary.archive_candidate_count).toBe(1);
		expect(
			result.report.findings.some(
				(finding) =>
					finding.rule_id === "docs.archive_candidates.advisory" &&
					finding.severity === "warning",
			),
		).toBe(true);
	});

	it("does not raise docs-gate warnings or repair debt for generated projections", () => {
		const root = createTestRoot("docs-gate-generated-archive-hints");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});
		write(join(root, "AI/context/diagram-context.md"), "# Generated\n");
		write(
			join(root, ".harness/plan/source.md"),
			[
				"---",
				"authority: execution-input",
				"lifecycle_status: execution-input",
				"---",
				"# Source",
			].join("\n"),
		);
		write(
			join(root, ".harness/active-artifacts.md"),
			"[Source](.harness/plan/source.md)\n",
		);
		const env = createIsolatedGitEnv();
		execFileSync("git", ["init"], { cwd: root, env });
		execFileSync("git", ["add", "."], { cwd: root, env });

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: [],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("ok");
		expect(result.report.summary.archive_repair_finding_count).toBe(0);
		expect(
			result.report.findings.some(
				(finding) =>
					finding.rule_id === "docs.archive_candidates.advisory" &&
					finding.severity === "warning",
			),
		).toBe(false);
	});
});
