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

		expect(config).toContain("version: 2.1");
		expect(config).toContain("name: linear-gate");
		expect(config).toContain("bash scripts/run-harness-gate.sh linear-gate");
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
		expect(config).toContain("name: security-scan");
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
		expect(config).toContain("            - pr-template\n");
		expect(config).not.toContain("            - linear-gate");
		expect(config).not.toContain("name: Configure pnpm store");
		expect(config).toContain("command: npm ci");
		expect(config).not.toMatch(/{{[a-zA-Z]+}}/);
	});
});
