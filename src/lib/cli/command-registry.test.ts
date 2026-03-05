import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	MIGRATED_COMMAND_AND_ALIAS_NAMES,
	MIGRATED_COMMAND_NAMES,
	dispatchRegistryCommand,
	getRegistryCommandHelpRows,
} from "./command-registry.js";
import {
	compareRegistryToReadme,
	extractReadmeCommandNames,
} from "./doc-parity.js";

describe("command registry", () => {
	it("exposes migrated command names", () => {
		expect(MIGRATED_COMMAND_NAMES).toEqual([
			"policy-gate",
			"evidence-verify",
			"preflight-gate",
			"review-gate",
			"branch-protect",
			"check-authz",
			"check-environment",
		]);
	});

	it("resolves alias to policy-gate spec", () => {
		const result = dispatchRegistryCommand("risk-policy-gate", []);
		expect(result?.spec.name).toBe("policy-gate");
	});

	it("exposes migrated aliases alongside canonical command names", () => {
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("risk-policy-gate");
		expect(MIGRATED_COMMAND_AND_ALIAS_NAMES).toContain("policy-gate");
	});

	it("returns undefined for unknown commands", () => {
		expect(dispatchRegistryCommand("unknown", [])).toBeUndefined();
	});

	it("provides unique help rows", () => {
		const names = getRegistryCommandHelpRows().map((row) => row.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("ensures migrated commands exist in README command index", () => {
		const readmePath = join(process.cwd(), "README.md");
		const readmeContent = readFileSync(readmePath, "utf-8");
		const readmeCommands = extractReadmeCommandNames(readmeContent);
		const result = compareRegistryToReadme(
			MIGRATED_COMMAND_NAMES,
			readmeCommands,
		);

		expect(result.missingInReadme).toEqual([]);
	});
});
