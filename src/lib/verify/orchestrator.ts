import type { NormalizedGateDefinition } from "../policy/required-checks.js";
import {
	DEFAULT_MAX_ATTEMPTS,
	type VerifyFailureSignal,
	adaptFailureClass,
	decideRetry,
} from "./retry-policy.js";
import type {
	VerifyGateExecutionClass,
	VerifyGateFailureClass,
	VerifyGateStatus,
} from "./run-state.js";

export type VerifyLifecycleState =
	| "S0_INIT"
	| "S1_CONTRACT_VALIDATED"
	| "S2_READ_ONLY_BATCH"
	| "S3_SERIAL_GUARDED"
	| "S4_BLOCKED"
	| "S5_DONE"
	| "S_FAIL";

export type VerifyLifecycleEvent =
	| "CONTRACT_OK"
	| "CONTRACT_FAIL"
	| "ENTER_READ_ONLY_BATCH"
	| "READ_ONLY_BATCH_PASSED"
	| "READ_ONLY_BATCH_FAILED"
	| "READ_ONLY_BATCH_BLOCKED"
	| "ENTER_SERIAL_GUARDED"
	| "SERIAL_GATE_PASSED"
	| "SERIAL_FINAL_GATE_PASSED"
	| "SERIAL_GATE_FAILED"
	| "SERIAL_GATE_BLOCKED"
	| "UNBLOCK_TO_READ_ONLY"
	| "UNBLOCK_TO_SERIAL"
	| "CONTRACT_CHANGED";

export interface VerifyLifecycleTransition {
	from: VerifyLifecycleState;
	to: VerifyLifecycleState;
	event: VerifyLifecycleEvent;
	gateId?: string;
	reason?: string;
}

export interface VerifyGateRunnerInput {
	gate: NormalizedGateDefinition;
	attempt: number;
}

export interface VerifyGateRunnerResult {
	status: VerifyGateStatus;
	exitCode?: number;
	nextAction?: string;
	failureClass?: VerifyGateFailureClass;
	signal?: VerifyFailureSignal;
}

export type VerifyGateRunner = (
	input: VerifyGateRunnerInput,
) => Promise<VerifyGateRunnerResult>;

export interface VerifyOrchestratorOptions {
	gates: NormalizedGateDefinition[];
	runner: VerifyGateRunner;
	maxParallelism?: number;
	maxAttempts?: number;
}

export interface VerifyGateExecutionRecord {
	gateId: string;
	executionClass: VerifyGateExecutionClass;
	status: VerifyGateStatus;
	attempts: number;
	exitCode: number;
	failureClass: VerifyGateFailureClass;
	nextAction: string;
}

export interface VerifyOrchestrationResult {
	finalState: VerifyLifecycleState;
	overallStatus: "passed" | "failed" | "blocked";
	resumeFromGateId: string | null;
	transitions: VerifyLifecycleTransition[];
	gateResults: VerifyGateExecutionRecord[];
}

const INITIAL_STATE: VerifyLifecycleState = "S0_INIT";

function sortEnabledGates(
	gates: NormalizedGateDefinition[],
): NormalizedGateDefinition[] {
	return [...gates]
		.filter((gate) => gate.enabled)
		.sort((left, right) => {
			if (left.order !== right.order) {
				return left.order - right.order;
			}
			return left.gateId.localeCompare(right.gateId);
		});
}

function toExecutionClass(value: string): VerifyGateExecutionClass {
	if (value === "read_only_parallel") {
		return "read_only_parallel";
	}
	return "serial_guarded";
}

function toFailureClass(value: string): VerifyGateFailureClass {
	if (value === "transient_infra") {
		return "transient_infra";
	}
	if (value === "contract_policy") {
		return "contract_policy";
	}
	return "internal_unknown";
}

function ensurePositiveInteger(name: string, value: number): void {
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`${name} must be a positive integer`);
	}
}

export function transitionLifecycle(
	state: VerifyLifecycleState,
	event: VerifyLifecycleEvent,
): VerifyLifecycleState {
	switch (state) {
		case "S0_INIT":
			if (event === "CONTRACT_OK") {
				return "S1_CONTRACT_VALIDATED";
			}
			if (event === "CONTRACT_FAIL") {
				return "S_FAIL";
			}
			break;
		case "S1_CONTRACT_VALIDATED":
			if (event === "ENTER_READ_ONLY_BATCH") {
				return "S2_READ_ONLY_BATCH";
			}
			if (event === "ENTER_SERIAL_GUARDED") {
				return "S3_SERIAL_GUARDED";
			}
			if (event === "CONTRACT_FAIL") {
				return "S_FAIL";
			}
			break;
		case "S2_READ_ONLY_BATCH":
			if (event === "READ_ONLY_BATCH_PASSED") {
				return "S3_SERIAL_GUARDED";
			}
			if (event === "SERIAL_FINAL_GATE_PASSED") {
				return "S5_DONE";
			}
			if (event === "READ_ONLY_BATCH_BLOCKED") {
				return "S4_BLOCKED";
			}
			if (event === "READ_ONLY_BATCH_FAILED") {
				return "S_FAIL";
			}
			break;
		case "S3_SERIAL_GUARDED":
			if (event === "SERIAL_GATE_PASSED") {
				return "S3_SERIAL_GUARDED";
			}
			if (event === "SERIAL_FINAL_GATE_PASSED") {
				return "S5_DONE";
			}
			if (event === "SERIAL_GATE_BLOCKED") {
				return "S4_BLOCKED";
			}
			if (event === "SERIAL_GATE_FAILED") {
				return "S_FAIL";
			}
			break;
		case "S4_BLOCKED":
			if (event === "UNBLOCK_TO_READ_ONLY") {
				return "S2_READ_ONLY_BATCH";
			}
			if (event === "UNBLOCK_TO_SERIAL") {
				return "S3_SERIAL_GUARDED";
			}
			if (event === "CONTRACT_CHANGED") {
				return "S_FAIL";
			}
			break;
		case "S5_DONE":
		case "S_FAIL":
			break;
		default: {
			const neverState: never = state;
			throw new Error(`Unhandled state: ${String(neverState)}`);
		}
	}

	throw new Error(`Invalid lifecycle transition: ${state} -> ${event}`);
}

async function executeGateWithRetry(
	gate: NormalizedGateDefinition,
	runner: VerifyGateRunner,
	maxAttempts: number,
): Promise<VerifyGateExecutionRecord> {
	const executionClass = toExecutionClass(gate.executionClass);
	const defaultFailureClass = toFailureClass(gate.failureClassDefault);
	let attempt = 1;

	while (true) {
		try {
			const result = await runner({ gate, attempt });
			if (result.status === "passed") {
				return {
					gateId: gate.gateId,
					executionClass,
					status: "passed",
					attempts: attempt,
					exitCode: result.exitCode ?? 0,
					failureClass: defaultFailureClass,
					nextAction: result.nextAction ?? "continue",
				};
			}

			if (result.status === "blocked") {
				return {
					gateId: gate.gateId,
					executionClass,
					status: "blocked",
					attempts: attempt,
					exitCode: result.exitCode ?? 1,
					failureClass:
						result.failureClass ??
						adaptFailureClass(defaultFailureClass, result.signal),
					nextAction:
						result.nextAction ??
						`Resolve blocker and rerun from ${gate.gateId}`,
				};
			}

			const failureClass =
				result.failureClass ??
				adaptFailureClass(
					defaultFailureClass,
					(() => {
						const signal: VerifyFailureSignal = result.signal
							? { ...result.signal }
							: {};
						if (result.exitCode !== undefined) {
							signal.exitCode = result.exitCode;
						}
						return signal;
					})(),
				);
			const decision = decideRetry({
				executionClass,
				failureClass,
				attempt,
				maxAttempts,
			});
			if (decision.shouldRetry && decision.nextAttempt) {
				attempt = decision.nextAttempt;
				continue;
			}

			return {
				gateId: gate.gateId,
				executionClass,
				status: "failed",
				attempts: attempt,
				exitCode: result.exitCode ?? 1,
				failureClass,
				nextAction: result.nextAction ?? "fix gate failure and resume",
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// Use internal failure class for thrown errors, not the gate's default
			const internalFailureClass: VerifyGateFailureClass = "internal_unknown";
			const failureClass = adaptFailureClass(internalFailureClass, {
				errorCode: "E_RUNNER_THROW",
				stderr: message,
			});
			const decision = decideRetry({
				executionClass,
				failureClass,
				attempt,
				maxAttempts,
			});
			if (decision.shouldRetry && decision.nextAttempt) {
				attempt = decision.nextAttempt;
				continue;
			}
			return {
				gateId: gate.gateId,
				executionClass,
				status: "failed",
				attempts: attempt,
				exitCode: 1,
				failureClass,
				nextAction: message,
			};
		}
	}
}

async function executeReadOnlyBatches(
	gates: NormalizedGateDefinition[],
	runner: VerifyGateRunner,
	maxParallelism: number,
	maxAttempts: number,
): Promise<VerifyGateExecutionRecord[]> {
	const results: VerifyGateExecutionRecord[] = [];

	for (let index = 0; index < gates.length; index += maxParallelism) {
		const batch = gates.slice(index, index + maxParallelism);
		const batchResults = await Promise.all(
			batch.map((gate) => executeGateWithRetry(gate, runner, maxAttempts)),
		);
		results.push(...batchResults);
	}

	return results;
}

export async function orchestrateVerifyLifecycle(
	options: VerifyOrchestratorOptions,
): Promise<VerifyOrchestrationResult> {
	const maxParallelism = options.maxParallelism ?? 4;
	const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
	ensurePositiveInteger("maxParallelism", maxParallelism);
	ensurePositiveInteger("maxAttempts", maxAttempts);

	const transitions: VerifyLifecycleTransition[] = [];
	const gateResults: VerifyGateExecutionRecord[] = [];
	const gates = sortEnabledGates(options.gates);

	let state: VerifyLifecycleState = INITIAL_STATE;
	const pushTransition = (
		event: VerifyLifecycleEvent,
		meta?: Pick<VerifyLifecycleTransition, "gateId" | "reason">,
	): void => {
		const from = state;
		const to = transitionLifecycle(from, event);
		transitions.push({
			from,
			to,
			event,
			...(meta?.gateId ? { gateId: meta.gateId } : {}),
			...(meta?.reason ? { reason: meta.reason } : {}),
		});
		state = to;
	};

	if (gates.length === 0) {
		pushTransition("CONTRACT_FAIL", { reason: "no_enabled_gates" });
		return {
			finalState: state,
			overallStatus: "failed",
			resumeFromGateId: null,
			transitions,
			gateResults,
		};
	}

	pushTransition("CONTRACT_OK");

	const readOnlyGates = gates.filter(
		(gate) => gate.executionClass === "read_only_parallel",
	);
	const serialGates = gates.filter(
		(gate) => gate.executionClass === "serial_guarded",
	);

	if (serialGates.length === 0) {
		pushTransition("CONTRACT_FAIL", { reason: "no_serial_guarded_gates" });
		return {
			finalState: state,
			overallStatus: "failed",
			resumeFromGateId: null,
			transitions,
			gateResults,
		};
	}

	if (readOnlyGates.length > 0) {
		pushTransition("ENTER_READ_ONLY_BATCH");
		const readOnlyResults = await executeReadOnlyBatches(
			readOnlyGates,
			options.runner,
			maxParallelism,
			maxAttempts,
		);
		gateResults.push(...readOnlyResults);

		const blockedGate = readOnlyResults.find(
			(result) => result.status === "blocked",
		);
		if (blockedGate) {
			pushTransition("READ_ONLY_BATCH_BLOCKED", {
				gateId: blockedGate.gateId,
				reason: blockedGate.nextAction,
			});
			return {
				finalState: state,
				overallStatus: "blocked",
				resumeFromGateId: blockedGate.gateId,
				transitions,
				gateResults,
			};
		}

		const failedGate = readOnlyResults.find(
			(result) => result.status === "failed",
		);
		if (failedGate) {
			pushTransition("READ_ONLY_BATCH_FAILED", {
				gateId: failedGate.gateId,
				reason: failedGate.nextAction,
			});
			return {
				finalState: state,
				overallStatus: "failed",
				resumeFromGateId: failedGate.gateId,
				transitions,
				gateResults,
			};
		}

		// If no serial gates remain, we're done; otherwise transition to serial execution
		if (serialGates.length === 0) {
			pushTransition("SERIAL_FINAL_GATE_PASSED");
		} else {
			pushTransition("READ_ONLY_BATCH_PASSED");
		}
	} else {
		pushTransition("ENTER_SERIAL_GUARDED");
	}

	if (state === "S3_SERIAL_GUARDED") {
		for (const [index, gate] of serialGates.entries()) {
			const result = await executeGateWithRetry(
				gate,
				options.runner,
				maxAttempts,
			);
			gateResults.push(result);

			if (result.status === "blocked") {
				pushTransition("SERIAL_GATE_BLOCKED", {
					gateId: gate.gateId,
					reason: result.nextAction,
				});
				return {
					finalState: state,
					overallStatus: "blocked",
					resumeFromGateId: gate.gateId,
					transitions,
					gateResults,
				};
			}

			if (result.status === "failed") {
				pushTransition("SERIAL_GATE_FAILED", {
					gateId: gate.gateId,
					reason: result.nextAction,
				});
				return {
					finalState: state,
					overallStatus: "failed",
					resumeFromGateId: gate.gateId,
					transitions,
					gateResults,
				};
			}

			const isLastGate = index === serialGates.length - 1;
			if (isLastGate) {
				pushTransition("SERIAL_FINAL_GATE_PASSED", { gateId: gate.gateId });
			} else {
				pushTransition("SERIAL_GATE_PASSED", { gateId: gate.gateId });
			}
		}
	}

	return {
		finalState: state,
		overallStatus: state === "S5_DONE" ? "passed" : "failed",
		resumeFromGateId: null,
		transitions,
		gateResults,
	};
}