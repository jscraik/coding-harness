import { describe, expect, it } from "vitest";
import type { NormalizedGateDefinition } from "../policy/required-checks.js";
import {
	type VerifyGateRunner,
	type VerifyGateRunnerResult,
	orchestrateVerifyLifecycle,
	transitionLifecycle,
} from "./orchestrator.js";
import type { VerifyGateFailureClass } from "./run-state.js";

function gateFixture(
	overrides: Partial<NormalizedGateDefinition>,
): NormalizedGateDefinition {
	return {
		policyId: overrides.policyId ?? `policy-${overrides.gateId ?? "gate"}`,
		gateId: overrides.gateId ?? "gate",
		displayName: overrides.displayName ?? `Gate ${overrides.gateId ?? "gate"}`,
		provider: overrides.provider ?? "circleci",
		sourceAppSlug: overrides.sourceAppSlug ?? "circleci",
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

	it("fails when there are no enabled gates", async () => {
		const result = await orchestrateVerifyLifecycle({
			gates: [],
			runner: createRunner({}),
		});
		expect(result.finalState).toBe("S_FAIL");
		expect(result.overallStatus).toBe("failed");
		expect(result.resumeFromGateId).toBeNull();
		expect(result.transitions[0]?.event).toBe("CONTRACT_FAIL");
		expect(result.transitions[0]?.reason).toBe("no_enabled_gates");
	});

	it("fails when all gates are disabled", async () => {
		const result = await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({ gateId: "lint", enabled: false }),
				gateFixture({ gateId: "typecheck", enabled: false }),
			],
			runner: createRunner({}),
		});
		expect(result.finalState).toBe("S_FAIL");
		expect(result.overallStatus).toBe("failed");
	});

	it("passes when all enabled gates are read-only", async () => {
		const result = await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({
					gateId: "lint",
					executionClass: "read_only_parallel",
					order: 1,
				}),
			],
			runner: createRunner({
				lint: [{ status: "passed", exitCode: 0, nextAction: "continue" }],
			}),
		});
		expect(result.finalState).toBe("S5_DONE");
		expect(result.overallStatus).toBe("passed");
		expect(result.transitions.map((transition) => transition.event)).toEqual([
			"CONTRACT_OK",
			"ENTER_READ_ONLY_BATCH",
			"SERIAL_FINAL_GATE_PASSED",
		]);
	});

	it("returns failed with resumeFromGateId when a read-only gate fails", async () => {
		const result = await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({
					gateId: "lint",
					executionClass: "read_only_parallel",
					failureClassDefault: "contract_policy",
					order: 1,
				}),
				gateFixture({
					gateId: "policy-gate",
					executionClass: "serial_guarded",
					order: 2,
				}),
			],
			runner: createRunner({
				lint: [
					{
						status: "failed",
						exitCode: 1,
						nextAction: "fix lint",
						failureClass: "contract_policy" as VerifyGateFailureClass,
					},
				],
			}),
		});
		expect(result.finalState).toBe("S_FAIL");
		expect(result.overallStatus).toBe("failed");
		expect(result.resumeFromGateId).toBe("lint");
		expect(result.transitions.map((t) => t.event)).toContain(
			"READ_ONLY_BATCH_FAILED",
		);
	});

	it("returns failed with resumeFromGateId when a serial gate fails", async () => {
		const result = await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({
					gateId: "policy-gate",
					executionClass: "serial_guarded",
					failureClassDefault: "contract_policy",
					order: 1,
				}),
				gateFixture({
					gateId: "linear-gate",
					executionClass: "serial_guarded",
					failureClassDefault: "contract_policy",
					order: 2,
				}),
			],
			runner: createRunner({
				"policy-gate": [
					{ status: "passed", exitCode: 0, nextAction: "continue" },
				],
				"linear-gate": [
					{
						status: "failed",
						exitCode: 1,
						nextAction: "fix linear policy",
						failureClass: "contract_policy" as VerifyGateFailureClass,
					},
				],
			}),
		});
		expect(result.finalState).toBe("S_FAIL");
		expect(result.overallStatus).toBe("failed");
		expect(result.resumeFromGateId).toBe("linear-gate");
		expect(result.transitions.map((t) => t.event)).toContain(
			"SERIAL_GATE_FAILED",
		);
	});

	it("returns blocked with resumeFromGateId when a serial gate is blocked", async () => {
		const result = await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({
					gateId: "policy-gate",
					executionClass: "serial_guarded",
					order: 1,
				}),
			],
			runner: createRunner({
				"policy-gate": [
					{
						status: "blocked",
						exitCode: 1,
						nextAction: "waiting for approval",
					},
				],
			}),
		});
		expect(result.finalState).toBe("S4_BLOCKED");
		expect(result.overallStatus).toBe("blocked");
		expect(result.resumeFromGateId).toBe("policy-gate");
		expect(result.transitions.map((t) => t.event)).toContain(
			"SERIAL_GATE_BLOCKED",
		);
	});

	it("throws when maxParallelism is zero", async () => {
		await expect(
			orchestrateVerifyLifecycle({
				gates: [
					gateFixture({ gateId: "lint", executionClass: "serial_guarded" }),
				],
				runner: createRunner({}),
				maxParallelism: 0,
			}),
		).rejects.toThrow("maxParallelism must be a positive integer");
	});

	it("throws when maxAttempts is zero", async () => {
		await expect(
			orchestrateVerifyLifecycle({
				gates: [
					gateFixture({ gateId: "lint", executionClass: "serial_guarded" }),
				],
				runner: createRunner({}),
				maxAttempts: 0,
			}),
		).rejects.toThrow("maxAttempts must be a positive integer");
	});

	it("handles runner throwing an error and returns failed with internal_unknown", async () => {
		let calls = 0;
		const throwingRunner: VerifyGateRunner = async () => {
			calls++;
			throw new Error("Runner crashed unexpectedly");
		};
		const result = await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({
					gateId: "policy-gate",
					executionClass: "serial_guarded",
					failureClassDefault: "contract_policy",
					order: 1,
				}),
			],
			runner: throwingRunner,
			maxAttempts: 1,
		});
		expect(result.finalState).toBe("S_FAIL");
		expect(result.overallStatus).toBe("failed");
		expect(result.gateResults[0]?.failureClass).toBe("internal_unknown");
		expect(result.gateResults[0]?.status).toBe("failed");
		expect(calls).toBe(1);
	});

	it("filters disabled gates and only runs enabled gates", async () => {
		let lintRan = false;
		const trackingRunner: VerifyGateRunner = async ({ gate }) => {
			if (gate.gateId === "lint") lintRan = true;
			return { status: "passed", exitCode: 0, nextAction: "continue" };
		};
		const result = await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({
					gateId: "lint",
					enabled: false,
					executionClass: "read_only_parallel",
					order: 1,
				}),
				gateFixture({
					gateId: "policy-gate",
					enabled: true,
					executionClass: "serial_guarded",
					order: 2,
				}),
			],
			runner: trackingRunner,
		});
		expect(lintRan).toBe(false);
		expect(result.finalState).toBe("S5_DONE");
		expect(result.gateResults).toHaveLength(1);
		expect(result.gateResults[0]?.gateId).toBe("policy-gate");
	});

	it("sorts gates by order and then by gateId when order ties", async () => {
		const runOrder: string[] = [];
		const trackingRunner: VerifyGateRunner = async ({ gate }) => {
			runOrder.push(gate.gateId);
			return { status: "passed", exitCode: 0, nextAction: "continue" };
		};
		await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({
					gateId: "z-gate",
					executionClass: "serial_guarded",
					order: 2,
				}),
				gateFixture({
					gateId: "a-gate",
					executionClass: "serial_guarded",
					order: 1,
				}),
				gateFixture({
					gateId: "b-gate",
					executionClass: "serial_guarded",
					order: 2,
				}),
			],
			runner: trackingRunner,
		});
		expect(runOrder[0]).toBe("a-gate");
		expect(runOrder[1]).toBe("b-gate");
		expect(runOrder[2]).toBe("z-gate");
	});

	it("records resumeFromGateId as null when all gates pass", async () => {
		const result = await orchestrateVerifyLifecycle({
			gates: [
				gateFixture({
					gateId: "policy-gate",
					executionClass: "serial_guarded",
					order: 1,
				}),
			],
			runner: createRunner({
				"policy-gate": [
					{ status: "passed", exitCode: 0, nextAction: "continue" },
				],
			}),
		});
		expect(result.resumeFromGateId).toBeNull();
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

		// self-affirming-ok: this assertion verifies deterministic lifecycle replay; following assertions pin the required attempts and final state.
		expect(first).toEqual(second);
		expect(
			first.gateResults.find((gate) => gate.gateId === "lint")?.attempts,
		).toBe(2);
		expect(first.finalState).toBe("S5_DONE");
	});
});

describe("transitionLifecycle state machine", () => {
	it("throws on invalid transition from S0_INIT with wrong event", () => {
		expect(() => transitionLifecycle("S0_INIT", "SERIAL_GATE_PASSED")).toThrow(
			"Invalid lifecycle transition",
		);
	});

	it("throws on invalid transition from S1_CONTRACT_VALIDATED with wrong event", () => {
		expect(() =>
			transitionLifecycle("S1_CONTRACT_VALIDATED", "READ_ONLY_BATCH_FAILED"),
		).toThrow("Invalid lifecycle transition");
	});

	it("throws on invalid transition from S2_READ_ONLY_BATCH with wrong event", () => {
		expect(() =>
			transitionLifecycle("S2_READ_ONLY_BATCH", "CONTRACT_OK"),
		).toThrow("Invalid lifecycle transition");
	});

	it("throws on invalid transition from S3_SERIAL_GUARDED with wrong event", () => {
		expect(() =>
			transitionLifecycle("S3_SERIAL_GUARDED", "READ_ONLY_BATCH_PASSED"),
		).toThrow("Invalid lifecycle transition");
	});

	it("throws on invalid transition from S4_BLOCKED with wrong event", () => {
		expect(() =>
			transitionLifecycle("S4_BLOCKED", "SERIAL_GATE_PASSED"),
		).toThrow("Invalid lifecycle transition");
	});

	it("returns S_FAIL on invalid transition from S4_BLOCKED with CONTRACT_CHANGED", () => {
		expect(transitionLifecycle("S4_BLOCKED", "CONTRACT_CHANGED")).toBe(
			"S_FAIL",
		);
	});

	it("throws on any event from terminal state S5_DONE", () => {
		expect(() => transitionLifecycle("S5_DONE", "CONTRACT_OK")).toThrow(
			"Invalid lifecycle transition",
		);
	});

	it("throws on any event from terminal state S_FAIL", () => {
		expect(() => transitionLifecycle("S_FAIL", "CONTRACT_OK")).toThrow(
			"Invalid lifecycle transition",
		);
	});

	it("maps S0_INIT + CONTRACT_OK to S1_CONTRACT_VALIDATED", () => {
		expect(transitionLifecycle("S0_INIT", "CONTRACT_OK")).toBe(
			"S1_CONTRACT_VALIDATED",
		);
	});

	it("maps S0_INIT + CONTRACT_FAIL to S_FAIL", () => {
		expect(transitionLifecycle("S0_INIT", "CONTRACT_FAIL")).toBe("S_FAIL");
	});

	it("maps S1_CONTRACT_VALIDATED + ENTER_READ_ONLY_BATCH to S2_READ_ONLY_BATCH", () => {
		expect(
			transitionLifecycle("S1_CONTRACT_VALIDATED", "ENTER_READ_ONLY_BATCH"),
		).toBe("S2_READ_ONLY_BATCH");
	});

	it("maps S1_CONTRACT_VALIDATED + ENTER_SERIAL_GUARDED to S3_SERIAL_GUARDED", () => {
		expect(
			transitionLifecycle("S1_CONTRACT_VALIDATED", "ENTER_SERIAL_GUARDED"),
		).toBe("S3_SERIAL_GUARDED");
	});

	it("maps S2_READ_ONLY_BATCH + READ_ONLY_BATCH_FAILED to S_FAIL", () => {
		expect(
			transitionLifecycle("S2_READ_ONLY_BATCH", "READ_ONLY_BATCH_FAILED"),
		).toBe("S_FAIL");
	});

	it("maps S3_SERIAL_GUARDED + SERIAL_GATE_PASSED stays in S3_SERIAL_GUARDED", () => {
		expect(transitionLifecycle("S3_SERIAL_GUARDED", "SERIAL_GATE_PASSED")).toBe(
			"S3_SERIAL_GUARDED",
		);
	});

	it("maps S3_SERIAL_GUARDED + SERIAL_FINAL_GATE_PASSED to S5_DONE", () => {
		expect(
			transitionLifecycle("S3_SERIAL_GUARDED", "SERIAL_FINAL_GATE_PASSED"),
		).toBe("S5_DONE");
	});
});
