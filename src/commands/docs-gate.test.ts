import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDocsGate } from "./docs-gate.js";

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

function createContractWithDocsGate(
	root: string,
	docsGatePolicy: unknown,
): void {
	const contract = {
		version: "1.0",
		docsGatePolicy,
	};
	write(join(root, "harness.contract.json"), JSON.stringify(contract, null, 2));
}

function createContractWithoutDocsGate(root: string): void {
	const contract = {
		version: "1.0",
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
});
