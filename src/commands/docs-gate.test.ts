import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONTEXT_INTEGRITY_POLICY } from "../lib/contract/types.js";
import { runDocsGate } from "./docs-gate.js";

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

function seedRequiredTruthSources(root: string): void {
	write(join(root, "README.md"), "# README\nUse `pnpm test`.\n");
	write(join(root, "AGENTS.md"), "# AGENTS\nRun `pnpm test`.\n");
	write(join(root, "CONTRIBUTING.md"), "# CONTRIBUTING\n");
	write(join(root, "CLAUDE.md"), "# CLAUDE\n");
	write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
	write(
		join(root, "docs/agents/00-architecture-bootstrap.md"),
		"# Bootstrap\n",
	);
	write(
		join(root, "package.json"),
		JSON.stringify({ packageManager: "pnpm@10.0.0" }, null, 2),
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

describe("docs-gate command", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) {
			rmSync(root, { recursive: true, force: true });
		}
		roots.length = 0;
	});

	it("returns bootstrap_gap when docsGatePolicy is missing", () => {
		const root = join(process.cwd(), "artifacts", "docs-gate-test-1");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-2");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-3");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-4");
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

	it("passes when required documentation was updated", () => {
		const root = join(process.cwd(), "artifacts", "docs-gate-test-5");
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

	it("reports advisory (warning) in advisory mode for missing docs", () => {
		const root = join(process.cwd(), "artifacts", "docs-gate-test-6");
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

	it("skips evaluation when docs-gate is disabled", () => {
		const root = join(process.cwd(), "artifacts", "docs-gate-test-7");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-8");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-9");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-10");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-11");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-12");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-13");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-14");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-15");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-16");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-17");
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-18");
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
		write(join(root, "CLAUDE.md"), "# CLAUDE\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "pnpm@10.0.0" }, null, 2),
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
		write(join(root, "CLAUDE.md"), "# CLAUDE\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "docs/agents/00-architecture-bootstrap.md"),
			"# Bootstrap\n",
		);
		write(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "pnpm@10.0.0" }, null, 2),
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
		write(join(root, "CLAUDE.md"), "# CLAUDE\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "docs/agents/00-architecture-bootstrap.md"),
			"# Bootstrap\n",
		);
		write(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "pnpm@10.0.0" }, null, 2),
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
		const root = join(process.cwd(), "artifacts", "docs-gate-test-19");
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
			"# CONTRIBUTING\n\n- Require status checks: `lint`, `CodeRabbit`, `Greptile Review`, `security-scan`\n",
		);
		write(join(root, "CLAUDE.md"), "# CLAUDE\n");
		write(join(root, "AI/context/diagram-context.md"), "# Diagram Context\n");
		write(
			join(root, "docs/agents/00-architecture-bootstrap.md"),
			"# Bootstrap\n",
		);
		write(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "pnpm@10.0.0" }, null, 2),
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
			requiredChecks: [
				"lint",
				"CodeRabbit",
				"Greptile Review",
				"security-scan",
			],
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
});
