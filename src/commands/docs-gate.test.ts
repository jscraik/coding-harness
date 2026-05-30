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
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_CI_PROVIDER_POLICY,
	DEFAULT_CONTEXT_INTEGRITY_POLICY,
} from "../lib/contract/types.js";
import {
	isGitEnvironmentKey,
	sanitizeGitEnvironment,
} from "../lib/git/safe-env.js";
import { runDocsGate, runDocsGateCLI } from "./docs-gate.js";

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

function createContractWithoutDocsGate(root: string): void {
	const contract = {
		version: "1.5.0",
		riskTierRules: {},
	};
	write(join(root, "harness.contract.json"), JSON.stringify(contract, null, 2));
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

	it("returns bootstrap_gap when docsGatePolicy is missing", () => {
		const root = createTestRoot("docs-gate-test-1");
		roots.push(root);
		createContractWithoutDocsGate(root);

		const result = runDocsGate({
			repoRoot: root,
			mode: "advisory",
			changedFiles: ["src/cli.ts"],
		});

		expect(result.exitCode).toBe(0); // advisory mode doesn't block
		expect(result.report.outcome).toBe("bootstrap_gap");
		expect(result.report.status).toBe("partial");
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "docs.gate.bootstrap_gap",
			),
		).toBe(true);
		const bootstrapGapFinding = result.report.findings.find(
			(f) => f.rule_id === "docs.gate.bootstrap_gap",
		);
		expect(bootstrapGapFinding?.details).toContain("harness init --track");
	});

	it("blocks on bootstrap_gap in required mode", () => {
		const root = createTestRoot("docs-gate-test-2");
		roots.push(root);
		createContractWithoutDocsGate(root);

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/cli.ts"],
		});

		expect(result.exitCode).toBe(11); // bootstrap_gap exit code
		expect(result.report.outcome).toBe("bootstrap_gap");
		expect(result.report.status).toBe("blocked");
	});

	it("returns ok when no governance-relevant files changed", () => {
		const root = createTestRoot("docs-gate-test-3");
		roots.push(root);
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

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/lib/utils.ts"], // Not a governance file
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("ok");
		expect(result.report.status).toBe("success");
	});

	it("detects missing documentation for CLI changes", () => {
		const root = createTestRoot("docs-gate-test-4");
		roots.push(root);
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

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/cli.ts"], // CLI change without README update
		});

		expect(result.exitCode).toBe(10); // drift_detected
		expect(result.report.outcome).toBe("drift_detected");
		expect(
			result.report.findings.some((f) => f.rule_id === "docs.surface.missing"),
		).toBe(true);
		expect(result.report.summary.missing_surface_count).toBe(1);
	});

	it("emits canonical gate envelope fields in JSON mode", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"docs-gate-test-json-envelope",
		);
		roots.push(root);
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
		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		const exitCode = runDocsGateCLI({
			repoRoot: root,
			mode: "required",
			json: true,
			changedFiles: ["src/cli.ts"],
		});

		expect(exitCode).toBe(10);
		const payload = stdoutSpy.mock.calls.at(-1)?.[0];
		expect(typeof payload).toBe("string");
		const parsed = JSON.parse(String(payload)) as {
			status: string;
			reason: string;
			action_now: unknown[];
			action_later: unknown[];
			evidence_ref: unknown[];
		};
		expect(parsed.status).toBe("fail");
		expect(typeof parsed.reason).toBe("string");
		expect(Array.isArray(parsed.action_now)).toBe(true);
		expect(Array.isArray(parsed.action_later)).toBe(true);
		expect(Array.isArray(parsed.evidence_ref)).toBe(true);
	});

	it("passes when required documentation was updated", () => {
		const root = createTestRoot("docs-gate-test-5");
		roots.push(root);
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

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/cli.ts", "README.md"], // Both changed
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("ok");
		expect(
			result.report.findings.some((f) => f.rule_id === "docs.surface.present"),
		).toBe(true);
		expect(result.report.summary.missing_surface_count).toBe(0);
	});

	it("treats deleted required documentation surfaces as missing", () => {
		const root = createTestRoot("docs-gate-test-5b");
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
		execFileSync("git", ["init"], { cwd: root, stdio: "ignore", env: gitEnv });
		execFileSync("git", ["config", "user.email", "docs-gate@example.com"], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});
		execFileSync("git", ["config", "user.name", "Docs Gate Test"], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});
		execFileSync("git", ["add", "."], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});
		execFileSync("git", ["commit", "-m", "seed"], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});
		const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: root,
			encoding: "utf-8",
			env: gitEnv,
		}).trim();
		write(join(root, "src/cli.ts"), "export const cli = true;\n");
		rmSync(join(root, "README.md"), { force: true });
		execFileSync("git", ["add", "-A"], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});
		execFileSync("git", ["commit", "-m", "delete required docs surface"], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});

		const result = runDocsGateWithIsolatedGitEnv({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(13);
		expect(result.report.outcome).toBe("policy_error");
		const missingFinding = result.report.findings.find(
			(f) => f.rule_id === "docs.surface.missing" && f.surface === "README.md",
		);
		expect(missingFinding).toBeDefined();
	});

	it("reports advisory (warning) in advisory mode for missing docs", () => {
		const root = createTestRoot("docs-gate-test-6");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "advisory",
			rules: [
				{
					ruleId: "cli-surface-docs",
					when: { categories: ["cli_surface"] },
					requireDocs: ["README.md"],
					severity: "error",
				},
			],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "advisory",
			changedFiles: ["src/cli.ts"],
		});

		expect(result.exitCode).toBe(0); // advisory doesn't block
		expect(result.report.outcome).toBe("drift_detected");
		expect(result.report.status).toBe("partial");
		// Findings should be warnings, not errors in advisory mode
		const missingFinding = result.report.findings.find(
			(f) => f.rule_id === "docs.surface.missing",
		);
		expect(missingFinding?.severity).toBe("warning");
	});

	it("blocks existing deep-module README drift in required mode", () => {
		const root = createTestRoot("docs-gate-deep-module-readme-missing");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});
		write(join(root, "src/lib/init/README.md"), "# Init module\n");
		write(join(root, "src/lib/init/runner.ts"), "export const ok = true;\n");

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/lib/init/runner.ts"],
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.outcome).toBe("drift_detected");
		expect(result.report.status).toBe("blocked");
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "docs.deep_module_readme.missing" &&
					f.path === "src/lib/init/README.md" &&
					f.severity === "error",
			),
		).toBe(true);
	});

	it("blocks deleted deep-module README in required mode", () => {
		const root = createTestRoot("docs-gate-deep-module-readme-deleted");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});
		write(join(root, "src/lib/init/README.md"), "# Init module\n");
		write(join(root, "src/lib/init/runner.ts"), "export const ok = true;\n");

		// Delete the README before running docs-gate
		rmSync(join(root, "src/lib/init/README.md"));

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/lib/init/runner.ts", "src/lib/init/README.md"],
			deletedFiles: ["src/lib/init/README.md"],
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.outcome).toBe("drift_detected");
		expect(result.report.status).toBe("blocked");
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "docs.deep_module_readme.missing" &&
					f.path === "src/lib/init/README.md" &&
					f.severity === "error",
			),
		).toBe(true);
	});

	it("accepts existing deep-module README updates beside module changes", () => {
		const root = createTestRoot("docs-gate-deep-module-readme-present");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});
		write(join(root, "src/lib/init/README.md"), "# Init module\n");
		write(join(root, "src/lib/init/runner.ts"), "export const ok = true;\n");

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/lib/init/runner.ts", "src/lib/init/README.md"],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("ok");
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "docs.deep_module_readme.present" &&
					f.path === "src/lib/init/README.md",
			),
		).toBe(true);
	});

	it("skips evaluation when docs-gate is disabled", () => {
		const root = createTestRoot("docs-gate-test-7");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: false,
			mode: "required",
			rules: [],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/cli.ts"],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("ok");
		expect(
			result.report.findings.some((f) => f.rule_id === "docs.gate.disabled"),
		).toBe(true);
	});

	it("detects unknown governance changes", () => {
		const root = createTestRoot("docs-gate-test-8");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [
				{
					ruleId: "unknown-governance-docs",
					when: { categories: ["unknown_governance_change"] },
					requireDocs: [],
					severity: "warning",
				},
			],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["scripts/setup/random.sh"], // Unknown file in governance path
		});

		expect(result.exitCode).toBe(10); // drift_detected
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "docs.gate.unknown_governance_change",
			),
		).toBe(true);
		expect(result.report.summary.unknown_category_count).toBeGreaterThan(0);
	});

	it("classifies CI workflow changes correctly", () => {
		const root = createTestRoot("docs-gate-test-9");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [
				{
					ruleId: "ci-workflow-docs",
					when: { categories: ["ci_workflow"] },
					requireDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md"],
					severity: "error",
				},
			],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: [".github/workflows/pr-pipeline.yml"],
		});

		expect(result.report.categories).toContain("ci_workflow");
		expect(result.report.summary.required_surface_count).toBe(3);
	});

	it("writes output report to --out path", () => {
		const root = createTestRoot("docs-gate-test-10");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "advisory",
			rules: [],
		});

		const outPath = "artifacts/consistency-gate/custom-docs-report.json";
		const result = runDocsGate({
			repoRoot: root,
			mode: "advisory",
			changedFiles: [],
			outPath,
		});

		expect(result.exitCode).toBe(0);
		const written = JSON.parse(readFileSync(join(root, outPath), "utf-8")) as {
			schemaVersion: string;
			command: string;
		};
		expect(written.schemaVersion).toBe("1.0.0");
		expect(written.command).toBe("docs-gate");
	});

	it("captures execution context correctly", () => {
		const root = createTestRoot("docs-gate-test-11");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			trigger: "pull_request",
			changedFiles: [],
			trustedBaseRef: "main",
			trustedContractSha: "abc123",
		});

		expect(result.report.execution_context.trigger).toBe("pull_request");
		expect(result.report.execution_context.mergeAuthoritative).toBe(true);
		expect(result.report.execution_context.trustedBaseAvailable).toBe(true);
		expect(result.report.execution_context.trustedBaseRef).toBe("main");
		expect(result.report.execution_context.trustedContractSha).toBe("abc123");
	});

	it("classifies multiple change categories", () => {
		const root = createTestRoot("docs-gate-test-12");
		roots.push(root);
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
				{
					ruleId: "ci-workflow-docs",
					when: { categories: ["ci_workflow"] },
					requireDocs: ["CONTRIBUTING.md"],
					severity: "error",
				},
			],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["src/cli.ts", ".github/workflows/test.yml"],
		});

		expect(result.report.categories).toContain("cli_surface");
		expect(result.report.categories).toContain("ci_workflow");
		expect(result.report.summary.required_surface_count).toBe(2);
	});

	it("requires tooling docs for local runtime policy changes", () => {
		const root = createTestRoot("docs-gate-test-13");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [
				{
					ruleId: "tooling-runtime-docs",
					when: { categories: ["tooling_runtime"] },
					requireDocs: [
						"docs/agents/02-tooling-policy.md",
						"docs/agents/06-security-and-governance.md",
					],
					severity: "error",
				},
			],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["Makefile"],
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("tooling_runtime");
		expect(result.report.summary.required_surface_count).toBe(2);
	});

	it("passes architecture context changes when bootstrap docs were updated", () => {
		const root = createTestRoot("docs-gate-test-14");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [
				{
					ruleId: "architecture-context-docs",
					when: { categories: ["architecture_context"] },
					requireDocs: ["docs/agents/00-architecture-bootstrap.md"],
					severity: "error",
				},
			],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: [
				"scripts/check-diagram-freshness.sh",
				"docs/agents/00-architecture-bootstrap.md",
			],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.categories).toContain("architecture_context");
		expect(result.report.summary.missing_surface_count).toBe(0);
	});

	it("tracks plan artifacts via directory-backed documentation surfaces", () => {
		const root = createTestRoot("docs-gate-test-15");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [
				{
					ruleId: "plan-artifact-docs",
					when: { categories: ["plan_artifact"] },
					requireDocs: ["docs/plans/"],
					severity: "error",
				},
			],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["docs/plans/2026-03-11-example-plan.md"],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.categories).toContain("plan_artifact");
		expect(result.report.summary.missing_surface_count).toBe(0);
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "docs.surface.present" && f.surface === "docs/plans/",
			),
		).toBe(true);
	});

	it("tracks brainstorm and spec artifacts as governed workflow docs", () => {
		const root = createTestRoot("docs-gate-test-16");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [
				{
					ruleId: "brainstorm-artifact-docs",
					when: { categories: ["brainstorm_artifact"] },
					requireDocs: ["docs/brainstorms/"],
					severity: "error",
				},
				{
					ruleId: "spec-artifact-docs",
					when: { categories: ["spec_artifact"] },
					requireDocs: ["docs/specs/"],
					severity: "error",
				},
			],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: [
				"docs/brainstorms/2026-03-11-example-brainstorm.md",
				"docs/specs/2026-03-11-example-spec.md",
			],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.categories).toContain("brainstorm_artifact");
		expect(result.report.categories).toContain("spec_artifact");
		expect(result.report.summary.missing_surface_count).toBe(0);
	});

	it("classifies authoritative workflow docs separately from agent governance", () => {
		const root = createTestRoot("docs-gate-test-17");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["docs/agents/14-docs-gate-rollout.md"],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.categories).toContain("workflow_authority");
		expect(result.report.categories).not.toContain("agent_governance");
	});

	it("treats compound-routing workflow docs as workflow authority", () => {
		const root = createTestRoot("docs-gate-test-18");
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: [
				"docs/agents/04-validation.md",
				"docs/agents/08-release-and-change-control.md",
				"docs/agents/10-agent-testing-gates.md",
			],
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.categories).toContain("workflow_authority");
		expect(result.report.categories).not.toContain("agent_governance");
	});

	it("blocks policy docs that duplicate frontmatter metadata as headings or TOC entries", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"docs-gate-test-frontmatter-metadata",
		);
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});
		write(
			join(root, "docs/agents/policy.md"),
			`---
schema_version: 1
status: active
applies_to:
  - docs
---

# Policy

## Table of Contents
- [schema_version](#schema_version)
- [applies_to](#applies_to)

## schema_version

Machine metadata does not belong here.
`,
		);

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["docs/agents/policy.md"],
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.outcome).toBe("drift_detected");
		const finding = result.report.findings.find(
			(f) => f.rule_id === "docs.frontmatter.metadata_not_prose",
		);
		expect(finding?.severity).toBe("error");
		expect(finding?.source_of_truth_ref).toBe(
			"coderabbit.coding-harness.docs-frontmatter-machine-readable",
		);
		expect(finding?.details).toContain("applies_to");
		expect(finding?.details).toContain("schema_version");
	});

	it("allows frontmatter metadata keys inside fenced examples", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"docs-gate-test-frontmatter-example",
		);
		roots.push(root);
		createContractWithDocsGate(root, {
			enabled: true,
			mode: "required",
			rules: [],
		});
		write(
			join(root, "docs/agents/policy.md"),
			`---
schema_version: 1
status: active
applies_to:
  - docs
---

# Policy

\`\`\`yaml
schema_version: 1
status: active
applies_to:
  - docs
\`\`\`
`,
		);

		const result = runDocsGate({
			repoRoot: root,
			mode: "required",
			changedFiles: ["docs/agents/policy.md"],
		});

		expect(result.exitCode).toBe(0);
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "docs.frontmatter.metadata_not_prose",
			),
		).toBe(false);
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
});
