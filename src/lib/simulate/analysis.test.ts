import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { HarnessContract } from "../contract/types.js";
import {
	computeContractHash,
	computeDeltas,
	computeMetrics,
} from "./analysis.js";
import type { DataQualityAssessment } from "./types.js";

const testRoots: string[] = [];

function makeTestRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "harness-simulate-analysis-"));
	testRoots.push(root);
	return root;
}

async function loadRepoContract(): Promise<HarnessContract> {
	return JSON.parse(
		await readFile(join(process.cwd(), "harness.contract.json"), "utf-8"),
	) as HarnessContract;
}

function cloneContract(contract: HarnessContract): HarnessContract {
	return JSON.parse(JSON.stringify(contract)) as HarnessContract;
}

function writeManifest(params: {
	artifactsDir: string;
	runId: string;
	contractHash: string;
	command?: string;
	outcome: string;
	durationMs?: number;
	events?: Array<Record<string, unknown>>;
}): void {
	const runDir = join(params.artifactsDir, params.runId);
	mkdirSync(runDir, { recursive: true });
	writeFileSync(
		join(runDir, "manifest.json"),
		JSON.stringify({
			schemaVersion: "agent-run-manifest/v1",
			runId: params.runId,
			command: params.command ?? "remediate",
			startedAt: "2026-05-22T00:00:00Z",
			durationMs: params.durationMs ?? 0,
			contract: { hash: params.contractHash },
			outcome: params.outcome,
		}),
		"utf-8",
	);
	if (params.events) {
		writeFileSync(
			join(runDir, "events.jsonl"),
			params.events.map((event) => JSON.stringify(event)).join("\n"),
			"utf-8",
		);
	}
}

function adequateDataQuality(): DataQualityAssessment {
	return {
		sampleSize: "adequate",
		traceCoverage: 100,
		artifactCompleteness: 100,
		effectiveSampleSize: 20,
	};
}

afterEach(() => {
	for (const root of testRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("simulate analysis", () => {
	it("hashes nested contract fields while preserving key-order stability", async () => {
		const contract = await loadRepoContract();
		const reordered = cloneContract(contract);
		reordered.northStar = Object.fromEntries(
			Object.entries(
				contract.northStar as unknown as Record<string, unknown>,
			).reverse(),
		) as unknown as HarnessContract["northStar"];
		const changed = cloneContract(contract);
		changed.northStar = {
			...(changed.northStar as unknown as Record<string, unknown>),
			mission: "changed nested mission",
		} as HarnessContract["northStar"];

		expect(computeContractHash(reordered)).toBe(computeContractHash(contract));
		expect(computeContractHash(changed)).not.toBe(
			computeContractHash(contract),
		);
	});

	it("computes metrics from the provided artifacts directory", async () => {
		const artifactsDir = join(makeTestRoot(), "artifacts");
		const baseline = await loadRepoContract();
		const candidate = cloneContract(baseline);
		candidate.version = `${baseline.version}-candidate`;

		writeManifest({
			artifactsDir,
			runId: "baseline-run",
			contractHash: computeContractHash(baseline),
			outcome: "success",
			durationMs: 3_600_000,
		});
		writeManifest({
			artifactsDir,
			runId: "candidate-run",
			contractHash: computeContractHash(candidate),
			outcome: "failed",
			durationMs: 7_200_000,
		});

		const metrics = computeMetrics(
			baseline,
			candidate,
			adequateDataQuality(),
			artifactsDir,
		);

		expect(metrics.preventedRisk.baseline).toBe(1);
		expect(metrics.preventedRisk.candidate).toBe(0);
		expect(metrics.leadTimeDelta.baseline).toBe(1);
		expect(metrics.leadTimeDelta.candidate).toBe(2);
	});

	it("matches decision deltas only against candidate contract artifacts", async () => {
		const artifactsDir = join(makeTestRoot(), "artifacts");
		const baseline = await loadRepoContract();
		const candidate = cloneContract(baseline);
		candidate.version = `${baseline.version}-candidate`;
		const unrelated = cloneContract(baseline);
		unrelated.version = `${baseline.version}-unrelated`;

		writeManifest({
			artifactsDir,
			runId: "mmm-baseline",
			contractHash: computeContractHash(baseline),
			outcome: "failed",
			events: [
				{
					schemaVersion: "agent-run-event/v1",
					eventType: "decision",
					status: "completed",
					payload: { outcome: "failed" },
				},
			],
		});
		writeManifest({
			artifactsDir,
			runId: "aaa-unrelated",
			contractHash: computeContractHash(unrelated),
			outcome: "failed",
		});
		writeManifest({
			artifactsDir,
			runId: "zzz-candidate",
			contractHash: computeContractHash(candidate),
			outcome: "success",
		});

		const deltas = computeDeltas(baseline, candidate, artifactsDir);

		expect(deltas.summary.blockedToAllowed).toBe(1);
		expect(deltas.topDeltas[0]?.candidate.reason).toContain("success");
	});

	it("does not compare runs when contract hashes are identical", async () => {
		const artifactsDir = join(makeTestRoot(), "artifacts");
		const contract = await loadRepoContract();
		const contractHash = computeContractHash(contract);

		writeManifest({
			artifactsDir,
			runId: "baseline-run",
			contractHash,
			outcome: "failed",
			events: [
				{
					schemaVersion: "agent-run-event/v1",
					eventType: "decision",
					status: "completed",
					payload: { outcome: "failed" },
				},
			],
		});
		writeManifest({
			artifactsDir,
			runId: "candidate-looking-run",
			contractHash,
			outcome: "success",
		});

		const deltas = computeDeltas(
			contract,
			cloneContract(contract),
			artifactsDir,
		);

		expect(deltas.summary.total).toBe(0);
		expect(deltas.topDeltas).toEqual([]);
	});
});
