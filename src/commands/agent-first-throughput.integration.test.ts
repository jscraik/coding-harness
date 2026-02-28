import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckRun } from "../lib/github/client.js";
import { runRemediate } from "./remediate.js";
import { runReviewGate } from "./review-gate.js";

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

// mock GitHub client so runReviewGate has deterministic, offline behavior
vi.mock("../lib/github/client.js", () => ({
	GitHubClient: vi.fn(),
}));

import { GitHubClient } from "../lib/github/client.js";

const mockGitHubClient = vi.mocked(GitHubClient);

function makeSha(value: string): string {
	return value.repeat(40);
}

function createSpawnResult(stdout: string): SpawnSyncReturns<string> {
	return {
		stdout,
		stderr: "",
		status: 0,
		output: [stdout, stdout],
		error: undefined as unknown as Error,
		signal: null,
		pid: 12345,
	} as SpawnSyncReturns<string>;
}

describe("agent-first throughput integration", () => {
	let tempDir: string;
	let findingsPath: string;
	let contractPath: string;
	const mockSpawn = vi.mocked(spawnSync);

	beforeEach(() => {
		vi.clearAllMocks();
		tempDir = `tmp-agent-first-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
		mkdirSync(tempDir, { recursive: true });
		findingsPath = join(tempDir, "findings.json");
		contractPath = join(tempDir, "harness.contract.json");
		mockSpawn.mockImplementation((..._args) => {
			return createSpawnResult(headShaForTests() ?? "");
		});
	});

	function headShaForTests(): string {
		return "a".repeat(40);
	}

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("verifies happy-path remediation and review-gate flow", async () => {
		const headSha = headShaForTests();
		const validFindings = [
			{
				id: "f-1",
				rule: { id: "rule-a", name: "Rule A" },
				location: { path: "src/example.ts", startLine: 10 },
				commitSha: headSha,
				severity: "warning" as const,
			},
			{
				id: "f-2",
				rule: { id: "rule-b", name: "Rule B" },
				location: { path: "src/example.ts", startLine: 20 },
				commitSha: headSha,
				severity: "warning" as const,
			},
		];

		writeFileSync(findingsPath, JSON.stringify(validFindings), "utf-8");
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 1,
					timeoutAction: "fail",
				},
			}),
			"utf-8",
		);

		const remediateResult = await runRemediate({
			findings: findingsPath,
			headSha,
			dryRun: false,
		});

		expect(remediateResult.exitCode).toBe(0);
		expect(remediateResult.outcome.ok).toBe(true);
		if (remediateResult.outcome.ok) {
			expect(remediateResult.outcome.output.actions).toHaveLength(2);
		}

		const checkRuns: CheckRun[] = [
			{
				id: 1001,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: headSha,
			},
		];

		const mockListCheckRuns = vi.fn().mockResolvedValue(checkRuns);
		mockGitHubClient.mockImplementation(
			() =>
				({
					listCheckRunsForRef: mockListCheckRuns,
				}) as unknown as GitHubClient,
		);

		const reviewResult = await runReviewGate({
			contractPath,
			token: "test-token",
			owner: "acme",
			repo: "repo",
			prNumber: 1,
			headSha,
			checkName: "review-check",
		});

		expect(reviewResult).toEqual({
			ok: true,
			output: {
				verified: true,
				headSha,
				checkStatus: "completed",
				checkConclusion: "success",
				needsRerun: false,
			},
		});
		expect(mockListCheckRuns).toHaveBeenCalledWith(headSha);
	});

	it("aborts mixed stale + race path with policy hold", async () => {
		const initialHead = makeSha("a");
		const staleHead = makeSha("1");
		const racedHead = makeSha("b");

		writeFileSync(
			findingsPath,
			JSON.stringify([
				{
					id: "stale",
					rule: { id: "rule-stale", name: "Stale finding" },
					location: { path: "src/example.ts", startLine: 5 },
					commitSha: staleHead,
					severity: "warning" as const,
				},
				{
					id: "live",
					rule: { id: "rule-live", name: "Live finding" },
					location: { path: "src/example.ts", startLine: 30 },
					commitSha: initialHead,
					severity: "warning" as const,
				},
			]),
			"utf-8",
		);

		const mockSpawn = vi.mocked(spawnSync);
		const getHeadSequence = [initialHead, initialHead, initialHead, racedHead];
		let callIndex = 0;
		mockSpawn.mockImplementation(() =>
			createSpawnResult(getHeadSequence[callIndex++] ?? racedHead),
		);

		const staleRaceResult = await runRemediate({
			findings: findingsPath,
			dryRun: false,
		});

		expect(staleRaceResult.exitCode).toBe(3);
		expect(staleRaceResult.outcome.ok).toBe(false);
		if (!staleRaceResult.outcome.ok) {
			expect(staleRaceResult.outcome.error.code).toBe("E_RACE_DETECTED");
		}
		expect(mockSpawn).toHaveBeenCalledTimes(4);
	});
});
