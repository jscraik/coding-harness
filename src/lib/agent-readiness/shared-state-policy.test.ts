import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSharedStateActionPolicy } from "./shared-state-policy.js";

describe("readSharedStateActionPolicy", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("passes when every required shared-state action is present", () => {
		const repoRoot = makeRepo(tempDirs);
		writeContract(repoRoot, {
			toolingPolicy: {
				sharedStateActions: [
					{ name: "stage", authority: "user_or_explicit_request" },
					{ name: "commit", authority: "user_or_explicit_request" },
					{ name: "push", authority: "user_or_explicit_request" },
					{ name: "merge", authority: "pull_request_policy" },
					{ name: "deploy", authority: "release_policy" },
					{
						name: "external_mutation",
						authority: "explicit_credentialed_request",
					},
				],
			},
		});

		expect(readSharedStateActionPolicy(repoRoot)).toEqual({
			complete: true,
			missing: [],
		});
	});

	it("reports missing required actions from a partial contract", () => {
		const repoRoot = makeRepo(tempDirs);
		writeContract(repoRoot, {
			toolingPolicy: {
				sharedStateActions: [{ name: "stage" }, { name: "commit" }],
			},
		});

		expect(readSharedStateActionPolicy(repoRoot)).toEqual({
			complete: false,
			missing: [
				"stage",
				"commit",
				"push",
				"merge",
				"deploy",
				"external_mutation",
			],
		});
	});

	it("reports actions with unknown authority values", () => {
		const repoRoot = makeRepo(tempDirs);
		writeContract(repoRoot, {
			toolingPolicy: {
				sharedStateActions: [
					{ name: "stage", authority: "user_or_explicit_request" },
					{ name: "commit", authority: "typo_or_guess" },
					{ name: "push", authority: "user_or_explicit_request" },
					{ name: "merge", authority: "pull_request_policy" },
					{ name: "deploy", authority: "release_policy" },
					{
						name: "external_mutation",
						authority: "explicit_credentialed_request",
					},
				],
			},
		});

		expect(readSharedStateActionPolicy(repoRoot)).toEqual({
			complete: false,
			missing: ["commit"],
		});
	});

	it("fails closed when the harness contract is malformed", () => {
		const repoRoot = makeRepo(tempDirs);
		writeFileSync(join(repoRoot, "harness.contract.json"), "{", "utf8");

		expect(readSharedStateActionPolicy(repoRoot)).toEqual({
			complete: false,
			missing: [
				"stage",
				"commit",
				"push",
				"merge",
				"deploy",
				"external_mutation",
			],
		});
	});
});

function makeRepo(tempDirs: string[]): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "shared-state-policy-"));
	tempDirs.push(repoRoot);
	return repoRoot;
}

function writeContract(repoRoot: string, contract: unknown): void {
	mkdirSync(repoRoot, { recursive: true });
	writeFileSync(
		join(repoRoot, "harness.contract.json"),
		JSON.stringify(contract),
		"utf8",
	);
}
