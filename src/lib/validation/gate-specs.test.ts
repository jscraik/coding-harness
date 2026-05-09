import { describe, expect, it } from "vitest";
import {
	VALIDATION_ARTIFACT_CONTRACT,
	VALIDATION_FAILURE_TAXONOMY,
	VALIDATION_GATE_SPEC_SOURCE,
	VALIDATION_GATE_SPECS,
	getValidationGateIdsForMode,
	getValidationGateSpec,
	getValidationGateSpecsForMode,
} from "./gate-specs.js";

describe("validation gate specs", () => {
	it("identifies the shell wrapper as the authority", () => {
		expect(VALIDATION_GATE_SPEC_SOURCE).toEqual({
			authority: "scripts/verify-work.sh",
			inventory:
				".harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md",
			status: "non-authoritative typed mirror",
		});
	});

	it("mirrors fast-mode gate order from the inventory", () => {
		expect(getValidationGateIdsForMode("fast")).toEqual([
			"preflight",
			"ci-check-alignment",
			"hook-governance-inventory",
			"hook-governance-rollout-check",
			"hook-governance-docstring-ratchet",
			"hook-governance-format-reports",
			"validate-codestyle-fast",
		]);
	});

	it("mirrors full-mode gate order from the inventory", () => {
		expect(getValidationGateIdsForMode("full")).toEqual([
			"preflight",
			"hook-governance-inventory",
			"hook-governance-rollout-check",
			"hook-governance-docstring-ratchet",
			"hook-governance-format-reports",
			"validate-codestyle",
		]);
	});

	it("keeps mode-specific gate membership explicit", () => {
		expect(getValidationGateSpec("preflight")?.modes).toEqual(["fast", "full"]);
		expect(getValidationGateSpec("ci-check-alignment")?.order).toEqual({
			fast: 2,
		});
		expect(getValidationGateSpec("ci-check-alignment")?.modes).toEqual([
			"fast",
		]);
		expect(getValidationGateSpec("validate-codestyle-fast")?.order).toEqual({
			fast: 7,
		});
		expect(getValidationGateSpec("validate-codestyle-fast")?.modes).toEqual([
			"fast",
		]);
		expect(getValidationGateSpec("validate-codestyle")?.order).toEqual({
			full: 6,
		});
		expect(getValidationGateSpec("validate-codestyle")?.modes).toEqual([
			"full",
		]);
	});

	it("mirrors execution and failure classes without consuming runtime behavior", () => {
		expect(
			VALIDATION_GATE_SPECS.map((gate) => [
				gate.gateId,
				gate.executionClass,
				gate.failureClassDefault,
			]),
		).toEqual([
			["preflight", "serial_guarded", "contract_policy"],
			["ci-check-alignment", "read_only_parallel", "contract_policy"],
			["hook-governance-inventory", "serial_guarded", "contract_policy"],
			[
				"hook-governance-rollout-check",
				"read_only_parallel",
				"contract_policy",
			],
			[
				"hook-governance-docstring-ratchet",
				"read_only_parallel",
				"contract_policy",
			],
			["hook-governance-format-reports", "serial_guarded", "contract_policy"],
			["validate-codestyle-fast", "read_only_parallel", "transient_infra"],
			["validate-codestyle", "serial_guarded", "internal_unknown"],
		]);
	});

	it("returns ordered specs without mutating the canonical mirror", () => {
		const fastSpecs = getValidationGateSpecsForMode("fast");

		expect(fastSpecs).not.toBe(VALIDATION_GATE_SPECS);
		expect(fastSpecs.map((gate) => gate.gateId)).toEqual(
			getValidationGateIdsForMode("fast"),
		);
		expect(VALIDATION_GATE_SPECS.map((gate) => gate.gateId)).toEqual([
			"preflight",
			"ci-check-alignment",
			"hook-governance-inventory",
			"hook-governance-rollout-check",
			"hook-governance-docstring-ratchet",
			"hook-governance-format-reports",
			"validate-codestyle-fast",
			"validate-codestyle",
		]);
	});

	it("freezes canonical validation metadata at runtime", () => {
		const firstGate = VALIDATION_GATE_SPECS[0];
		expect(Object.isFrozen(VALIDATION_ARTIFACT_CONTRACT)).toBe(true);
		expect(Object.isFrozen(VALIDATION_ARTIFACT_CONTRACT.runFields)).toBe(true);
		expect(Object.isFrozen(VALIDATION_ARTIFACT_CONTRACT.runFields[0])).toBe(
			true,
		);
		expect(Object.isFrozen(VALIDATION_FAILURE_TAXONOMY)).toBe(true);
		expect(Object.isFrozen(VALIDATION_FAILURE_TAXONOMY.failureClasses)).toBe(
			true,
		);
		expect(Object.isFrozen(VALIDATION_GATE_SPECS)).toBe(true);
		expect(Object.isFrozen(firstGate)).toBe(true);
		expect(Object.isFrozen(firstGate?.order)).toBe(true);
		expect(Object.isFrozen(firstGate?.modes)).toBe(true);
		expect(Reflect.set(firstGate?.order ?? {}, "fast", 99)).toBe(false);
		expect(getValidationGateSpec("preflight")?.order.fast).toBe(1);
	});

	it("mirrors retry policy and resume checkpoint expectations", () => {
		expect(
			VALIDATION_GATE_SPECS.map((gate) => [
				gate.gateId,
				gate.resumeCheckpoint,
				gate.retryPolicy,
			]),
		).toEqual([
			["preflight", true, "none"],
			["ci-check-alignment", true, "none"],
			["hook-governance-inventory", true, "none"],
			["hook-governance-rollout-check", true, "none"],
			["hook-governance-docstring-ratchet", true, "none"],
			["hook-governance-format-reports", true, "none"],
			["validate-codestyle-fast", true, "transient-infra-only"],
			["validate-codestyle", true, "none"],
		]);
	});

	it("mirrors the current run artifact expectations", () => {
		expect(VALIDATION_ARTIFACT_CONTRACT).toEqual({
			runFile: "run.json",
			gateFile: "gates/<gate-id>.json",
			summaryFile: "summary.json",
			runFields: [
				{ name: "runId", presence: "required" },
				{ name: "mode", presence: "required" },
				{ name: "sourceRunId", presence: "required" },
				{ name: "status", presence: "required" },
				{ name: "startedAt", presence: "required" },
				{ name: "resumeFromGateId", presence: "required" },
				{ name: "repoRoot", presence: "required" },
				{ name: "providerClass", presence: "required" },
				{ name: "schemaVersion", presence: "required" },
				{ name: "contractVersion", presence: "required" },
				{ name: "contractFingerprint", presence: "required" },
				{ name: "lane", presence: "required" },
				{ name: "finishedAt", presence: "terminal-only" },
			],
			gateFields: [
				{ name: "gateId", presence: "required" },
				{ name: "executionClass", presence: "required" },
				{ name: "attempt", presence: "required" },
				{ name: "status", presence: "required" },
				{ name: "failureClass", presence: "required" },
				{ name: "startedAt", presence: "required" },
				{ name: "finishedAt", presence: "required" },
				{ name: "nextAction", presence: "required" },
				{ name: "exitCode", presence: "required" },
			],
			summaryFields: [
				{ name: "runId", presence: "required" },
				{ name: "overallStatus", presence: "required" },
				{ name: "failedGateId", presence: "required" },
				{ name: "freshVsResumed", presence: "required" },
				{ name: "durationMs", presence: "required" },
			],
			reusedGateFields: [
				{ name: "reused", presence: "resume-only" },
				{ name: "sourceRunId", presence: "resume-only" },
			],
		});

		expect(
			VALIDATION_GATE_SPECS.every(
				(gate) => gate.artifactContract === VALIDATION_ARTIFACT_CONTRACT,
			),
		).toBe(true);
	});

	it("mirrors stable failure-class next actions without changing wording", () => {
		expect(VALIDATION_FAILURE_TAXONOMY).toEqual({
			status: "non-authoritative typed mirror",
			passedNextAction: "none",
			failureClasses: [
				{
					failureClass: "contract_policy",
					finalNextAction:
						"fix contract/policy mismatch, then rerun from this gate",
					retryNextAction: null,
					retryEligibleExecutionClass: null,
				},
				{
					failureClass: "transient_infra",
					finalNextAction:
						"retry budget exhausted; fix infrastructure blocker and resume",
					retryNextAction: "retry",
					retryEligibleExecutionClass: "read_only_parallel",
				},
				{
					failureClass: "internal_unknown",
					finalNextAction: "inspect gate output, fix root cause, and rerun",
					retryNextAction: null,
					retryEligibleExecutionClass: null,
				},
			],
		});
	});
});
