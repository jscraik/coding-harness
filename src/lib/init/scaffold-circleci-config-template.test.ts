import { describe, expect, it } from "vitest";
import { renderCircleCIConfig } from "./scaffold-circleci-config-template.js";

describe("scaffold CircleCI config template", () => {
	const circleCiConfigInput = {
		packageManager: "pnpm",
		installCommand: "pnpm install --frozen-lockfile --prefer-offline",
		lintCommand: "pnpm lint",
		typecheckCommand: "pnpm typecheck",
		testCommand: "pnpm test:ci",
		auditCommand: "pnpm audit",
		checkCommand: "pnpm check",
		dependencyAuditCommand: "pnpm audit:strict",
		memoryValidateCommand: "pnpm memory:validate",
		linearTrackingEnabled: true,
	};

	it("renders the CircleCI PR pipeline with Linear gating enabled", () => {
		const config = renderCircleCIConfig(circleCiConfigInput);

		expect(config).not.toContain("\t");
		expect(config).toContain("version: 2.1");
		expect(config).toContain("name: linear-gate");
		expect(config).toContain("bash scripts/run-harness-gate.sh linear-gate");
		expect(config).toContain("resolve_pr_ref() {");
		expect(config).toContain(
			"PR context not available yet for pr-template; retrying",
		);
		expect(config).toContain(
			"PR context not available yet for linear-gate; retrying",
		);
		expect(config).toContain("name: risk-policy-gate");
		expect(config).toContain("            - linear-gate");
		expect(config).toContain(
			"command: pnpm install --frozen-lockfile --prefer-offline",
		);
		expect(config).toContain("command: pnpm audit:strict");
		expect(config).toContain("command: pnpm lint");
		expect(config).toContain("command: pnpm typecheck");
		expect(config).toContain("command: pnpm test:ci");
		expect(config).toContain("command: pnpm audit");
		expect(config).toContain("command: pnpm check");
		expect(config).toContain("command: pnpm memory:validate");
		expect(config).toContain("name: Configure pnpm store");
		expect(config).toContain("v2-pnpm-store-{{ arch }}-");
		expect(config).toContain("name: snyk-dependency-scan");
		expect(config).toContain("name: Run report-only Snyk dependency scan");
		expect(config).toContain(
			"Skipping report-only CircleCI Snyk scan; external GitHub Snyk remains the blocking PR check.",
		);
		expect(config).toContain(
			"snyk test --severity-threshold=high --file=package.json --package-manager=pnpm || true",
		);
		expect(config).toContain("name: security-scan");
		expect(config).not.toContain("}}      -");
		expect(config).not.toMatch(/{{[a-zA-Z]+}}/);
	});

	it("renders the CircleCI PR pipeline without Linear gating", () => {
		const config = renderCircleCIConfig({
			...circleCiConfigInput,
			packageManager: "npm",
			installCommand: "npm ci",
			linearTrackingEnabled: false,
		});

		expect(config).not.toContain("name: linear-gate");
		expect(config).not.toContain("linear-gate \\");
		expect(config).toContain("resolve_pr_ref() {");
		expect(config).toContain(
			"PR context not available yet for pr-template; retrying",
		);
		expect(config).not.toContain(
			"PR context not available yet for linear-gate; retrying",
		);
		expect(config).not.toContain("}}      -");
		expect(config).toContain("            - pr-template\n");
		expect(config).not.toContain("            - linear-gate");
		expect(config).not.toContain("name: Configure pnpm store");
		expect(config).toContain("command: npm ci");
		expect(config).not.toMatch(/{{[a-zA-Z]+}}/);
	});
});
