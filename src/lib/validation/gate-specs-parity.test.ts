import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	type ValidationGateId,
	type ValidationRetryPolicy,
	getValidationGateSpecsForMode,
} from "./gate-specs.js";
import type {
	VerifyGateExecutionClass,
	VerifyGateFailureClass,
} from "../verify/run-state.js";

interface ShellGateSpec {
	gateId: ValidationGateId;
	executionClass: VerifyGateExecutionClass;
	failureClassDefault: VerifyGateFailureClass;
}

interface ShellGatePlan {
	fast: readonly ShellGateSpec[];
	full: readonly ShellGateSpec[];
}

interface GateParityMismatch {
	mode: "fast" | "full";
	index: number;
	field: "gateId" | "executionClass" | "failureClassDefault";
	expected: string | undefined;
	actual: string | undefined;
}

const shellSource = readFileSync("scripts/verify-work.sh", "utf8");

function extractBuildGatePlan(source: string): string {
	const match = source.match(/build_gate_plan\(\) \{(?<body>[\s\S]*?)\n\}/);
	if (!match?.groups?.body) {
		throw new Error("Could not find build_gate_plan in scripts/verify-work.sh");
	}
	return match.groups.body;
}

function parseShellGatePlan(source: string): ShellGatePlan {
	const body = extractBuildGatePlan(source);
	const fastModeMatch = body.match(
		/(?<prefix>[\s\S]*?)\r?\n[ \t]*if \[\[ "\$fast_mode" -eq 1 \]\]; then\r?\n(?<fast>[\s\S]*?)\r?\n[ \t]*else\r?\n(?<full>[\s\S]*?)\r?\n[ \t]*fi(?:\r?\n|$)/,
	);
	if (
		!fastModeMatch?.groups?.prefix ||
		!fastModeMatch.groups.fast ||
		!fastModeMatch.groups.full
	) {
		throw new Error("Could not parse fast/full split in build_gate_plan");
	}

	const preflightGates = parseAddGateCalls(fastModeMatch.groups.prefix.trim());
	const fastGates = parseAddGateCalls(fastModeMatch.groups.fast.trim());
	const fullGates = parseAddGateCalls(fastModeMatch.groups.full.trim());

	return {
		fast: [...preflightGates, ...fastGates],
		full: [...preflightGates, ...fullGates],
	};
}

function parseAddGateCalls(source: string): readonly ShellGateSpec[] {
	return [
		...source.matchAll(/add_gate\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"/g),
	].map((match) => ({
		gateId: match[1] as ValidationGateId,
		executionClass: match[2] as VerifyGateExecutionClass,
		failureClassDefault: match[3] as VerifyGateFailureClass,
	}));
}

function expectedRetryPolicy(shellGate: ShellGateSpec): ValidationRetryPolicy {
	if (
		shellGate.executionClass === "read_only_parallel" &&
		shellGate.failureClassDefault === "transient_infra"
	) {
		return "transient-infra-only";
	}
	return "none";
}

function findParityMismatches(
	shellPlan: ShellGatePlan,
): readonly GateParityMismatch[] {
	const mismatches: GateParityMismatch[] = [];
	for (const mode of ["fast", "full"] as const) {
		const typedGates = getValidationGateSpecsForMode(mode);
		const shellGates = shellPlan[mode];
		const gateCount = Math.max(typedGates.length, shellGates.length);

		for (let index = 0; index < gateCount; index += 1) {
			const typedGate = typedGates[index];
			const shellGate = shellGates[index];
			for (const field of [
				"gateId",
				"executionClass",
				"failureClassDefault",
			] as const) {
				if (typedGate?.[field] !== shellGate?.[field]) {
					mismatches.push({
						mode,
						index,
						field,
						expected: shellGate?.[field],
						actual: typedGate?.[field],
					});
				}
			}
		}
	}
	return mismatches;
}

describe("validation gate shell parity", () => {
	const shellPlan = parseShellGatePlan(shellSource);

	it("keeps typed fast and full gate plans aligned with build_gate_plan", () => {
		expect(findParityMismatches(shellPlan)).toEqual([]);
	});

	it("keeps retry policy derived from shell execution and failure classes", () => {
		for (const mode of ["fast", "full"] as const) {
			const shellGatesById = new Map(
				shellPlan[mode].map((gate) => [gate.gateId, gate]),
			);

			for (const typedGate of getValidationGateSpecsForMode(mode)) {
				const shellGate = shellGatesById.get(typedGate.gateId);
				if (!shellGate) {
					throw new Error(
						`${typedGate.gateId} missing from ${mode} shell plan`,
					);
				}
				expect(typedGate.retryPolicy).toBe(expectedRetryPolicy(shellGate));
			}
		}
	});

	it("keeps resume checkpoint coverage for every shell gate", () => {
		for (const mode of ["fast", "full"] as const) {
			const typedGatesById = new Map(
				getValidationGateSpecsForMode(mode).map((gate) => [gate.gateId, gate]),
			);

			for (const shellGate of shellPlan[mode]) {
				expect(typedGatesById.get(shellGate.gateId)?.resumeCheckpoint).toBe(
					true,
				);
			}
		}
	});

	it("proves the parity check catches an intentional mismatch", () => {
		const mismatchedPlan: ShellGatePlan = {
			...shellPlan,
			fast: shellPlan.fast.map((gate) =>
				gate.gateId === "ci-check-alignment"
					? { ...gate, executionClass: "serial_guarded" }
					: gate,
			),
		};

		expect(findParityMismatches(mismatchedPlan)).toContainEqual(
			expect.objectContaining({
				mode: "fast",
				field: "executionClass",
				expected: "serial_guarded",
				actual: "read_only_parallel",
			}),
		);
	});
});
