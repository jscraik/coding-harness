import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { HarnessContract } from "../contract/types.js";
import type { CheckRun } from "../github/client.js";
import {
	evaluateRequiredChecks,
	resolveRequiredCheckAliases,
} from "./required-checks.js";

describe("required check aliases", () => {
	let tempDir: string | undefined;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	it("includes aliases for explicit external required checks", () => {
		tempDir = mkdtempSync(join(tmpdir(), "required-check-aliases-"));
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness", "ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "circleci",
					requiredChecks: [
						{
							displayName: "semgrep-cloud-platform/scan",
							sourceAppSlug: "semgrep-cloud-platform",
							sourceAppId: "semgrep-cloud-platform",
							externalIdPattern: "^semgrep-cloud-platform/scan$",
							class: "required",
							githubCheckName: "Semgrep Cloud",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);
		const contract = {
			ciProviderPolicy: {
				requiredCheckManifestPath: ".harness/ci-required-checks.json",
			},
		} as HarnessContract;
		const aliases = resolveRequiredCheckAliases(
			contract,
			join(tempDir, "harness.contract.json"),
		);
		const checkRuns: CheckRun[] = [
			{
				id: 1,
				name: "Semgrep Cloud",
				status: "completed",
				conclusion: "success",
				head_sha: "a".repeat(40),
				app: {
					id: 1,
					slug: "semgrep-cloud-platform",
					name: "Semgrep Cloud",
				},
			},
		];

		expect(aliases.get("semgrep-cloud-platform/scan")).toEqual([
			"Semgrep Cloud",
		]);
		expect(
			evaluateRequiredChecks(
				checkRuns,
				["semgrep-cloud-platform/scan"],
				aliases,
				new Map(),
			),
		).toEqual([]);
	});
});
