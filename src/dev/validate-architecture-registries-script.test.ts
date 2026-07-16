import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const detectorModule: unknown = require("../../scripts/lib/direct-pnpm-audit.cjs");
if (
	detectorModule === null ||
	typeof detectorModule !== "object" ||
	!("findDirectPnpmAudit" in detectorModule) ||
	typeof detectorModule.findDirectPnpmAudit !== "function"
) {
	throw new Error("direct pnpm audit detector module is malformed");
}
const findDirectPnpmAudit = detectorModule.findDirectPnpmAudit;

function parseValidationReport(value: unknown): {
	schemaVersion: string;
	status: string;
	violations: unknown[];
} {
	if (
		value === null ||
		typeof value !== "object" ||
		!("schemaVersion" in value) ||
		typeof value.schemaVersion !== "string" ||
		!("status" in value) ||
		typeof value.status !== "string" ||
		!("violations" in value) ||
		!Array.isArray(value.violations)
	) {
		throw new Error("architecture validation report is malformed");
	}
	return {
		schemaVersion: value.schemaVersion,
		status: value.status,
		violations: value.violations,
	};
}

function parseRequiredGates(value: unknown): string[] {
	if (
		value === null ||
		typeof value !== "object" ||
		!("policyModules" in value) ||
		!Array.isArray(value.policyModules)
	) {
		throw new Error("coding policy modules are malformed");
	}
	const gates = [];
	for (const module of value.policyModules) {
		if (module === null || typeof module !== "object") continue;
		if (!("requiredGates" in module) || module.requiredGates === undefined) {
			continue;
		}
		if (!Array.isArray(module.requiredGates)) {
			throw new Error("coding policy requiredGates are malformed");
		}
		for (const command of module.requiredGates) {
			if (typeof command !== "string") {
				throw new Error("coding policy requiredGates are malformed");
			}
			gates.push(command);
		}
	}
	return gates;
}

describe("architecture registry validator", () => {
	it("distinguishes package scripts from same-named pnpm built-ins", () => {
		const result = spawnSync(
			process.execPath,
			["scripts/validate-architecture-registries.cjs"],
			{ cwd: process.cwd(), encoding: "utf8" },
		);
		const report = parseValidationReport(JSON.parse(result.stdout));

		expect(result.status).toBe(0);
		expect(report).toEqual({
			schemaVersion: "architecture-registries-validation/v1",
			status: "pass",
			violations: [],
		});
	});

	it("keeps Make and machine policy on the governed audit wrapper", () => {
		expect(readFileSync("Makefile", "utf8")).toMatch(
			/^audit:[^\n]*\n\tpnpm run audit$/m,
		);
		const requiredGates = parseRequiredGates(
			JSON.parse(readFileSync("coding-policy.json", "utf8")),
		);
		expect(requiredGates).toContain("pnpm run audit");
		expect(requiredGates).not.toContain("pnpm audit");
		for (const path of [
			"SECURITY.md",
			"docs/ai-assistant-security-policy.md",
			"docs/automations/jsc-249-phased-friction-evidence-work.md",
			"docs/examples/trust-artifacts/run-record.example.json",
		]) {
			expect(readFileSync(path, "utf8")).not.toMatch(
				/(^|[^\w])pnpm\s+audit(?:\s|$)/m,
			);
		}
	});

	it("detects direct audit commands with arguments and Markdown punctuation", () => {
		for (const text of [
			"`pnpm audit`",
			"Run (pnpm audit --audit-level=high).",
			"Commands: pnpm audit, pnpm test",
			"pnpm lint && pnpm audit --json",
		]) {
			expect(findDirectPnpmAudit(text)).toHaveLength(1);
		}
		for (const text of [
			"pnpm run audit",
			"pnpm audit:strict",
			"pnpm run audit -- --audit-level=high",
		]) {
			expect(findDirectPnpmAudit(text)).toEqual([]);
		}
	});
});
