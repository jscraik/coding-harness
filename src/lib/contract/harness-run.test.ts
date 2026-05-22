import { describe, expect, it } from "vitest";

import {
	HARNESS_RUN_SCHEMA_VERSION,
	buildHarnessRunContract,
	validateHarnessRunContract,
} from "./harness-run.js";
import type { LoadedRunRecordBundle } from "./run-records-core.js";

describe("harness-run contract", () => {
	it("projects canonical run records into a lifecycle-visible harness run", () => {
		const contract = buildHarnessRunContract(bundle());

		expect(contract.schemaVersion).toBe(HARNESS_RUN_SCHEMA_VERSION);
		expect(contract.lifecycle.contextRefs).toEqual([
			".harness/plan/current.md",
		]);
		expect(contract.lifecycle.guardrailRefs).toEqual(["docs:steering:guard"]);
		expect(contract.lifecycle.verifierRefs).toEqual([
			"vitest:runtime-evidence-contract",
		]);
		expect(validateHarnessRunContract(contract)).toEqual({
			valid: true,
			findings: [],
		});
	});

	it("rejects run projections without verifier evidence", () => {
		const source = bundle();
		source.events = source.events.filter(
			(event) => event.eventType !== "policy_check",
		);

		const result = validateHarnessRunContract(buildHarnessRunContract(source));

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "verifier_refs_missing",
				path: "lifecycle.verifierRefs",
			}),
		);
	});
});

function bundle(): LoadedRunRecordBundle {
	return {
		manifest: {
			schemaVersion: "agent-run-manifest/v1",
			runId: "run-123",
			command: "harness runtime-card --json",
			startedAt: "2026-05-22T10:00:00.000Z",
			finishedAt: "2026-05-22T10:00:01.000Z",
			durationMs: 1000,
			repo: {
				repository: "coding-harness",
				branch: "codex/JSC-331-internal-agent-runtime-freshness",
				headSha: "abc123",
			},
			contract: { path: "harness.contract.json", hash: "hash" },
			policyContext: {
				mode: "required",
				safetyPosture: "canonical-only",
				effectivePolicySource: "AGENTS.md",
			},
			outcome: "success",
			exit: { code: 0, classification: "ok" },
			artifactRefs: [
				{
					type: "runtime-card",
					path: ".harness/runtime/card.json",
					checksum: "sha256",
				},
			],
			preconditions: {},
			provenance: {
				repoContractHash: "repo-hash",
				processPolicyHash: "policy-hash",
			},
		},
		events: [
			{
				schemaVersion: "agent-run-event/v1",
				runId: "run-123",
				eventId: "evt-1",
				timestamp: "2026-05-22T10:00:00.000Z",
				eventType: "precondition",
				status: "passed",
				severity: "info",
				payload: { contextRef: ".harness/plan/current.md", tool: "codex" },
			},
			{
				schemaVersion: "agent-run-event/v1",
				runId: "run-123",
				eventId: "evt-2",
				timestamp: "2026-05-22T10:00:01.000Z",
				eventType: "policy_check",
				status: "passed",
				severity: "info",
				payload: {
					guardrailRef: "docs:steering:guard",
					verifierRef: "vitest:runtime-evidence-contract",
				},
			},
		],
		source: {
			manifestPath: "artifacts/agent-runs/run-123/manifest.json",
			eventsPath: "artifacts/agent-runs/run-123/events.jsonl",
			usedLegacyManifest: false,
			usedLegacyEvents: false,
		},
	};
}
