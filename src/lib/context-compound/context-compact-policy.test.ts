import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONTEXT_COMPACT_POLICY } from "../contract/types.js";
import { loadContextCompactPolicy } from "./context-compact-policy.js";

describe("loadContextCompactPolicy", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("returns DEFAULT_CONTEXT_COMPACT_POLICY for minimal contracts", () => {
		const dir = mkdtempSync(join(tmpdir(), "context-compact-policy-"));
		tempDirs.push(dir);

		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ version: "1.0" }, null, 2),
			"utf-8",
		);

		const policy = loadContextCompactPolicy(dir);
		expect(policy).toEqual(DEFAULT_CONTEXT_COMPACT_POLICY);
	});

	it("loads explicit contextCompact policy from contract", () => {
		const dir = mkdtempSync(join(tmpdir(), "context-compact-policy-"));
		tempDirs.push(dir);

		const explicitPolicy = {
			thresholdPercent: 90,
			microCompactThresholdTokens: 800,
			strategy: "aggressive" as const,
		};

		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify(
				{ version: "1.0", contextCompact: explicitPolicy },
				null,
				2,
			),
			"utf-8",
		);

		const policy = loadContextCompactPolicy(dir);
		expect(policy).toEqual(explicitPolicy);
		expect(policy?.thresholdPercent).toBe(90);
		expect(policy?.strategy).toBe("aggressive");
	});

	it("returns undefined when contract file does not exist", () => {
		const dir = mkdtempSync(join(tmpdir(), "context-compact-policy-"));
		tempDirs.push(dir);

		const policy = loadContextCompactPolicy(dir);
		expect(policy).toBeUndefined();
	});
});
