import { describe, expect, it } from "vitest";
import type { NormalizedGateDefinition } from "../policy/required-checks.js";
import {
	type VerifyGateRunner,
	type VerifyGateRunnerResult,
	orchestrateVerifyLifecycle,
	transitionLifecycle,
} from "./orchestrator.js";

function gateFixture(
	overrides: Partial<NormalizedGateDefinition>,
): NormalizedGateDefinition {
	return {
		policyId: overrides.policyId ?? `policy-${overrides.gateId ?? "gate"}`,
		gateId: overrides.gateId ?? "gate",
		displayName: overrides.displayName ?? `Gate ${overrides.gateId ?? "gate"}`,
		provider: overrides.provider ?? "circleci",
		sourceAppId: overrides.sourceAppId ?? "app-circleci",
		externalIdPattern:
			overrides.externalIdPattern ?? `^${overrides.gateId ?? "gate"}$`,
		githubCheckName: overrides.githubCheckName ?? null,
		requiredOnEvents: overrides.requiredOnEvents ?? [
			"pull_request",
			"merge_group",
		],
		freshnessWindowDays: overrides.freshnessWindowDays ?? 7,
		class: overrides.class ?? "required",
		executionClass: overrides.executionClass ?? "serial_guarded",
		failureClassDefault: overrides.failureClassDefault ?? "contract_policy",
		order: overrides.order ?? 1,
		enabled: overrides.enabled ?? true,
	};
}

function createRunner(
	sequences: Record<string, VerifyGateRunnerResult[]>,
): VerifyGateRunner {
	const callCount = new Map<string, number>();
	return async ({ gate }) => {
		const count = callCount.get(gate.gateId) ?? 0;
		const current = sequences[gate.gateId] ?? [];
		const fallback: VerifyGateRunnerResult = {
			status: "passed",
			exitCode: 0,
			nextAction: "continue",
			failureClass: gate.failureClassDefault,
		};
		const result =
			current[Math.min(count, Math.max(current.length - 1, 0))] ?? fallback;
		callCount.set(gate.gateId, count + 1);
		return result;
	};
}

describe("verify orchestrator", () => {
	it("advances from read-only batch success into serial guarded lane", async () => {
		const gates: NormalizedGateDefinition[] = [
			gateFixture({
				gateId: "lint",
				executionClass: "read_only_parallel",
				failureClassDefault: "transient_infra",
				order: 1,
			}),
			gateFixture({
				gateId: "typecheck",
				executionClass: "read_only_parallel",
				failureClassDefault: "transient_infra",
				order: 2,
			}),
			gateFixture({
				gateId: "policy-gate",
				executionClass: "serial_guarded",
				failureClassDefault: "contract_policy",
				order: 3,
			}),
		];

		const runner = createRunner({
			lint: [{ status: "passed", exitCode: 0, nextAction: "continue" }],
			typecheck: [{ status: "passed", exitCode: 0, nextAction: "continue" }],
			"policy-gate": [
				{ status: "passed", exitCode: 0, nextAction: "continue" },
			],
		});

		const result = await orchestrateVerifyLifecycle({ gates, runner });

		expect(result.finalState).toBe("S5_DONE");
		expect(result.overallStatus).toBe("passed");
		expect(result.transitions.map((transition) => transition.event)).toEqual([
			"CONTRACT_OK",
			"ENTER_READ_ONLY_BATCH",
			"READ_ONLY_BATCH_PASSED",
			"SERIAL_FINAL_GATE_PASSED",
		]);
	});

	it("only completes guarded lane after final guarded gate passes", async () => {
		const gates: NormalizedGateDefinition[] = [
			gateFixture({
				gateId: "policy-gate",
				executionClass: "serial_guarded",
				order: 1,
			}),
			gateFixture({
				gateId: "linear-gate",
				executionClass: "serial_guarded",
				order: 2,
			}),
		];

		const result = await orchestrateVerifyLifecycle({
			gates,
			runner: createRunner({
				"policy-gate": [
					{ status: "passed", exitCode: 0, nextAction: "continue" },
				],
				"linear-gate": [
					{ status: "passed", exitCode: 0, nextAction: "continue" },
				],
			}),
		});

		expect(result.transitions.map((transition) => transition.event)).toEqual([
			"CONTRACT_OK",
			"ENTER_SERIAL_GUARDED",
			"SERIAL_GATE_PASSED",
			"SERIAL_FINAL_GATE_PASSED",
		]);
		expect(result.finalState).toBe("S5_DONE");
	});

	it("supports blocked-state unblocking transitions back to prior active lanes", () => {
		const readOnlyBlocked = transitionLifecycle(
			"S2_READ_ONLY_BATCH",
			"READ_ONLY_BATCH_BLOCKED",
		);
		expect(readOnlyBlocked).toBe("S4_BLOCKED");
		expect(transitionLifecycle(readOnlyBlocked, "UNBLOCK_TO_READ_ONLY")).toBe(
			"S2_READ_ONLY_BATCH",
		);

		const serialBlocked = transitionLifecycle(
			"S3_SERIAL_GUARDED",
			"SERIAL_GATE_BLOCKED",
		);
		expect(serialBlocked).toBe("S4_BLOCKED");
		expect(transitionLifecycle(serialBlocked, "UNBLOCK_TO_SERIAL")).toBe(
			"S3_SERIAL_GUARDED",
		);
	});

	it("is deterministic across repeated fresh-mode executions", async () => {
		const gates: NormalizedGateDefinition[] = [
			gateFixture({
				gateId: "lint",
				executionClass: "read_only_parallel",
				failureClassDefault: "transient_infra",
				order: 1,
			}),
			gateFixture({
				gateId: "policy-gate",
				executionClass: "serial_guarded",
				failureClassDefault: "contract_policy",
				order: 2,
			}),
		];

		const sequences = {
			lint: [
				{
					status: "failed" as const,
					exitCode: 124,
					nextAction: "retry lint",
					signal: { exitCode: 124 },
				},
				{
					status: "passed" as const,
					exitCode: 0,
					nextAction: "continue",
				},
			],
			"policy-gate": [
				{ status: "passed" as const, exitCode: 0, nextAction: "continue" },
			],
		};

		const first = await orchestrateVerifyLifecycle({
			gates,
			runner: createRunner(sequences),
		});
		const second = await orchestrateVerifyLifecycle({
			gates,
			runner: createRunner(sequences),
		});

		expect(first).toEqual(second);
		expect(
			first.gateResults.find((gate) => gate.gateId === "lint")?.attempts,
		).toBe(2);
		expect(first.finalState).toBe("S5_DONE");
	});
});
