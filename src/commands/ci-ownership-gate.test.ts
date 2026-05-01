import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCIOwnershipGateCLI } from "./ci-ownership-gate.js";

describe("ci-ownership-gate command", () => {
	const cleanup: string[] = [];

	afterEach(() => {
		for (const path of cleanup.splice(0)) {
			rmSync(path, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	function writeContract(contract: unknown): string {
		const repoRoot = mkdtempSync(join(tmpdir(), "ci-ownership-gate-"));
		cleanup.push(repoRoot);
		mkdirSync(repoRoot, { recursive: true });
		writeFileSync(
			join(repoRoot, "harness.contract.json"),
			JSON.stringify(contract, null, 2),
		);
		return repoRoot;
	}

	it("passes for CircleCI primary ownership with CodeRabbit and Semgrep Cloud required", () => {
		const repoRoot = writeContract({
			ciProviderPolicy: { activeProvider: "circleci" },
			branchProtection: {
				requiredChecks: [
					"pr-pipeline",
					"security-scan",
					"CodeRabbit",
					"semgrep-cloud-platform/scan",
				],
			},
		});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runCIOwnershipGateCLI({ repoRoot, json: true });

		expect(exitCode).toBe(0);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.status).toBe("pass");
		expect(payload.summary.errors).toBe(0);
	});

	it("fails when GitHub Actions is configured as the primary PR gate", () => {
		const repoRoot = writeContract({
			ciProviderPolicy: { activeProvider: "github-actions" },
			branchProtection: {
				requiredChecks: [
					"pr-pipeline",
					"CodeRabbit",
					"semgrep-cloud-platform/scan",
				],
			},
		});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runCIOwnershipGateCLI({ repoRoot, json: true });

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(
			payload.findings.map((finding: { id: string }) => finding.id),
		).toContain("ci-ownership.primary-provider.mismatch");
	});

	it("fails when independent review or security checks are missing", () => {
		const repoRoot = writeContract({
			ciProviderPolicy: { activeProvider: "circleci" },
			branchProtection: {
				requiredChecks: ["pr-pipeline"],
			},
		});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runCIOwnershipGateCLI({ repoRoot, json: true });

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(
			payload.findings.map((finding: { id: string }) => finding.id),
		).toEqual(
			expect.arrayContaining([
				"ci-ownership.coderabbit-review-check.missing",
				"ci-ownership.semgrep-cloud-check.missing",
			]),
		);
	});

	it("fails when fallback GitHub Actions workflows auto-trigger on PRs", () => {
		const repoRoot = writeContract({
			ciProviderPolicy: { activeProvider: "circleci" },
			ciOwnership: {
				schemaVersion: "ci-ownership/v1",
				primaryPrGate: "circleci",
				reviewProvider: "coderabbit",
				securityChecks: ["semgrep-cloud-platform/scan"],
				fallbackWorkflows: [
					{
						path: ".github/workflows/pr-fallback.yml",
						role: "fallback_pr_gate",
						purpose: "Emergency fallback only.",
						allowAutomaticPrTriggers: false,
					},
				],
			},
			branchProtection: {
				requiredChecks: [
					"pr-pipeline",
					"CodeRabbit",
					"semgrep-cloud-platform/scan",
				],
			},
		});
		mkdirSync(join(repoRoot, ".github/workflows"), { recursive: true });
		writeFileSync(
			join(repoRoot, ".github/workflows/pr-fallback.yml"),
			["name: PR fallback", "on:", "  pull_request:", "jobs: {}"].join("\n"),
		);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runCIOwnershipGateCLI({ repoRoot, json: true });

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(
			payload.findings.map((finding: { id: string }) => finding.id),
		).toContain(
			"ci-ownership.fallback-workflow..github/workflows/pr-fallback.yml.automatic-pr-trigger",
		);
	});

	it("uses deterministic legacy defaults when ciOwnership is absent", () => {
		const repoRoot = writeContract({
			ciProviderPolicy: { activeProvider: "circleci" },
			branchProtection: {
				requiredChecks: [
					"pr-pipeline",
					"CodeRabbit",
					"semgrep-cloud-platform/scan",
				],
			},
		});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runCIOwnershipGateCLI({ repoRoot, json: true });

		expect(exitCode).toBe(0);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(
			payload.findings.map((finding: { id: string }) => finding.id),
		).toContain("ci-ownership.contract.defaulted");
	});

	it("fails when fallback workflow entries have invalid schema fields", () => {
		const repoRoot = writeContract({
			ciProviderPolicy: { activeProvider: "circleci" },
			ciOwnership: {
				schemaVersion: "ci-ownership/v1",
				primaryPrGate: "circleci",
				reviewProvider: "coderabbit",
				securityChecks: ["semgrep-cloud-platform/scan"],
				fallbackWorkflows: [
					{
						path: ".github/workflows/pr-fallback.yml",
						role: "unexpected",
						purpose: "",
						allowAutomaticPrTriggers: "no",
					},
				],
			},
			branchProtection: {
				requiredChecks: [
					"pr-pipeline",
					"CodeRabbit",
					"semgrep-cloud-platform/scan",
				],
			},
		});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runCIOwnershipGateCLI({ repoRoot, json: true });

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(
			payload.findings.map((finding: { id: string }) => finding.id),
		).toContain(
			"ci-ownership.fallback-workflow..github/workflows/pr-fallback.yml.role-invalid",
		);
	});

	it("fails when ciOwnership securityChecks contains non-string values", () => {
		const repoRoot = writeContract({
			ciProviderPolicy: { activeProvider: "circleci" },
			ciOwnership: {
				schemaVersion: "ci-ownership/v1",
				primaryPrGate: "circleci",
				reviewProvider: "coderabbit",
				securityChecks: ["semgrep-cloud-platform/scan", 42],
				fallbackWorkflows: [],
			},
			branchProtection: {
				requiredChecks: [
					"pr-pipeline",
					"CodeRabbit",
					"semgrep-cloud-platform/scan",
				],
			},
		});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runCIOwnershipGateCLI({ repoRoot, json: true });

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(
			payload.findings.map((finding: { id: string }) => finding.id),
		).toContain("ci-ownership.security-checks.invalid");
	});
});
