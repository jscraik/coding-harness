import { describe, expect, it } from "vitest";
import { checkWorkflowContract } from "./checker.js";
import type { CheckFinding, WorkflowContract } from "./types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Minimal valid contract for use as a baseline in tests. */
function validContract(): WorkflowContract {
	return {
		metadata: {
			owner: "coding-harness-maintainers",
			max_duration: "30m",
			escalation: "escalate to team lead",
			change_class: "behavior",
		},
		validation_contract: {
			test_mode: "tdd-required",
			test_tier: "integration",
			tracer_bullet_first: "yes",
			red_evidence_required: "yes",
		},
		transitions: [
			{
				S: "S0",
				E: "start",
				G: "preflight passes",
				A: "initialize workflow context",
				N: "S1",
			},
			{
				S: "S1",
				E: "advance",
				G: "policy and validation pass",
				A: "execute deterministic action",
				N: "DONE",
			},
			{
				S: "S1",
				E: "blocked",
				G: "dependency unavailable",
				A: "emit unblock payload",
				N: "BLOCKED",
			},
			{
				S: "S1",
				E: "error",
				G: "unrecoverable runtime/policy issue",
				A: "record failure artifact",
				N: "FAIL",
			},
		],
		error_codes: [
			"VALIDATION_ERROR",
			"BLOCKED_DEPENDENCY",
			"POLICY_FAIL",
			"SYSTEM_ERROR",
		],
		execution_modes: ["STRICT", "ADVISORY"],
		dry_run: {
			no_side_effects: true,
			deterministic_trace: true,
		},
		log_fields: [
			"workflow_id",
			"transition_code",
			"from_state",
			"to_state",
			"correlation_id",
			"result",
		],
	};
}

/** Helper to check if a finding with a given code exists. */
function hasFinding(findings: CheckFinding[], code: string): boolean {
	return findings.some((f: CheckFinding) => f.code === code);
}

/** Helper to check if a finding with a given code and message substring exists. */
function hasFindingWithMessage(
	findings: CheckFinding[],
	code: string,
	messagePart: string,
): boolean {
	return findings.some(
		(f: CheckFinding) => f.code === code && f.message.includes(messagePart),
	);
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("checkWorkflowContract", () => {
	// ── Happy path ──────────────────────────────────────────────────────────

	it("passes a fully valid contract", () => {
		const result = checkWorkflowContract(validContract());
		expect(result.pass).toBe(true);
		expect(result.summary.errors).toBe(0);
		expect(result.findings).toEqual([]);
	});

	it("returns 7 checks_run for a fully valid contract", () => {
		const result = checkWorkflowContract(validContract());
		expect(result.summary.checks_run).toBe(7);
	});

	// ── Metadata checks ─────────────────────────────────────────────────────

	describe("metadata", () => {
		it("fails when metadata is missing", () => {
			const contract = validContract();
			(contract as unknown as Record<string, unknown>).metadata = undefined;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_METADATA")).toBe(true);
		});

		it("fails when owner is missing", () => {
			const contract = validContract();
			(contract.metadata as unknown as Record<string, unknown>).owner = "";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_OWNER")).toBe(true);
		});

		it("fails when max_duration is missing", () => {
			const contract = validContract();
			(contract.metadata as unknown as Record<string, unknown>).max_duration =
				"";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_MAX_DURATION")).toBe(true);
		});

		it("fails when escalation is missing", () => {
			const contract = validContract();
			(contract.metadata as unknown as Record<string, unknown>).escalation = "";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_ESCALATION")).toBe(true);
		});

		it("fails when change_class is invalid", () => {
			const contract = validContract();
			(contract.metadata as unknown as Record<string, unknown>).change_class =
				"breaking";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "INVALID_CHANGE_CLASS")).toBe(true);
		});

		it("accepts all valid change_class values", () => {
			for (const cc of ["behavior", "validation-only", "docs-only"] as const) {
				const contract = validContract();
				contract.metadata.change_class = cc;
				// Adjust validation contract for non-behavior changes
				if (cc !== "behavior") {
					contract.validation_contract.test_mode = "validation-required";
					contract.validation_contract.red_evidence_required = "no";
				}

				const result = checkWorkflowContract(contract);
				expect(result.summary.errors).toBe(0);
			}
		});
	});

	// ── Validation contract checks ──────────────────────────────────────────

	describe("validation_contract", () => {
		it("fails when behavior change_class has no validation_contract", () => {
			const contract = validContract();
			(contract as unknown as Record<string, unknown>).validation_contract =
				undefined;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_VALIDATION_CONTRACT")).toBe(
				true,
			);
		});

		it("does not fail when non-behavior change_class has no validation_contract", () => {
			const contract = validContract();
			contract.metadata.change_class = "docs-only";
			(contract as unknown as Record<string, unknown>).validation_contract =
				undefined;

			const result = checkWorkflowContract(contract);
			expect(hasFinding(result.findings, "MISSING_VALIDATION_CONTRACT")).toBe(
				false,
			);
		});

		it("fails when test_mode is invalid", () => {
			const contract = validContract();
			(
				contract.validation_contract as unknown as Record<string, unknown>
			).test_mode = "yolo";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "INVALID_TEST_MODE")).toBe(true);
		});

		it("fails when test_tier is invalid", () => {
			const contract = validContract();
			(
				contract.validation_contract as unknown as Record<string, unknown>
			).test_tier = "smoke";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "INVALID_TEST_TIER")).toBe(true);
		});

		it("fails when tracer_bullet_first is invalid", () => {
			const contract = validContract();
			(
				contract.validation_contract as unknown as Record<string, unknown>
			).tracer_bullet_first = "true";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "INVALID_TRACER_BULLET_FIRST")).toBe(
				true,
			);
		});

		it("fails when red_evidence_required is invalid", () => {
			const contract = validContract();
			(
				contract.validation_contract as unknown as Record<string, unknown>
			).red_evidence_required = "true";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "INVALID_RED_EVIDENCE_REQUIRED")).toBe(
				true,
			);
		});

		it("fails when behavior + n/a test_mode", () => {
			const contract = validContract();
			contract.validation_contract.test_mode = "n/a";
			contract.validation_contract.red_evidence_required = "no";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "BEHAVIOR_REQUIRES_VALIDATION")).toBe(
				true,
			);
		});

		it("fails when tdd-required but red_evidence_required != yes", () => {
			const contract = validContract();
			contract.validation_contract.test_mode = "tdd-required";
			contract.validation_contract.red_evidence_required = "no";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "TDD_REQUIRES_RED_EVIDENCE")).toBe(
				true,
			);
		});

		it("fails when behavior + validation-required but no exemption_reason", () => {
			const contract = validContract();
			contract.validation_contract.test_mode = "validation-required";
			contract.validation_contract.red_evidence_required = "no";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_EXEMPTION_REASON")).toBe(
				true,
			);
		});

		it("fails when exemption_reason is set but reviewed_by is missing", () => {
			const contract = validContract();
			contract.validation_contract.test_mode = "validation-required";
			contract.validation_contract.red_evidence_required = "no";
			contract.validation_contract.exemption_reason = "legacy migration path";

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_REVIEWED_BY")).toBe(true);
		});

		it("passes when behavior + validation-required with exemption and reviewer", () => {
			const contract = validContract();
			contract.validation_contract.test_mode = "validation-required";
			contract.validation_contract.red_evidence_required = "no";
			contract.validation_contract.exemption_reason = "legacy migration path";
			contract.validation_contract.reviewed_by = "jamie";

			const result = checkWorkflowContract(contract);
			expect(result.summary.errors).toBe(0);
		});

		it("warns when validation-only has n/a test_mode and n/a test_tier", () => {
			const contract = validContract();
			contract.metadata.change_class = "validation-only";
			contract.validation_contract.test_mode = "n/a";
			contract.validation_contract.test_tier = "n/a";
			contract.validation_contract.red_evidence_required = "no";

			const result = checkWorkflowContract(contract);
			// Should be a warning, not an error
			const finding = result.findings.find(
				(f: CheckFinding) => f.code === "VALIDATION_ONLY_NEEDS_STRATEGY",
			);
			expect(finding).toBeDefined();
			expect(finding?.severity).toBe("warning");
		});
	});

	// ── Transition table checks ─────────────────────────────────────────────

	describe("transitions", () => {
		it("fails when transitions is missing", () => {
			const contract = validContract();
			(contract as unknown as Record<string, unknown>).transitions = undefined;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_TRANSITIONS")).toBe(true);
		});

		it("fails when transitions is empty", () => {
			const contract = validContract();
			contract.transitions = [];

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "EMPTY_TRANSITIONS")).toBe(true);
		});

		it("fails when a transition row has an empty field", () => {
			const contract = validContract();
			contract.transitions = [
				{ S: "S0", E: "start", G: "", A: "do thing", N: "S1" },
			];

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "INCOMPLETE_TRANSITION_ROW")).toBe(
				true,
			);
		});

		it("fails when terminal state has outbound transition", () => {
			const contract = validContract();
			contract.transitions.push({
				S: "DONE",
				E: "restart",
				G: "always",
				A: "re-run",
				N: "S0",
			});

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "TERMINAL_HAS_OUTBOUND")).toBe(true);
		});

		it("fails when (S,E) pair has duplicate guards (non-deterministic)", () => {
			const contract = validContract();
			contract.transitions = [
				{
					S: "S0",
					E: "start",
					G: "preflight passes",
					A: "init",
					N: "S1",
				},
				{
					S: "S0",
					E: "start",
					G: "preflight passes",
					A: "init-again",
					N: "S2",
				},
				{
					S: "S1",
					E: "advance",
					G: "all clear",
					A: "finish",
					N: "DONE",
				},
				{
					S: "S1",
					E: "error",
					G: "problem",
					A: "record",
					N: "FAIL",
				},
			];

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "NON_DETERMINISTIC_TRANSITION")).toBe(
				true,
			);
		});

		it("passes when (S,E) pair has distinct guards", () => {
			const contract = validContract();
			// Existing transitions already have distinct guards for S1|error vs S1|advance
			const result = checkWorkflowContract(contract);
			expect(hasFinding(result.findings, "NON_DETERMINISTIC_TRANSITION")).toBe(
				false,
			);
		});

		it("detects dead states with no outbound transitions", () => {
			const contract = validContract();
			// Add a transition pointing to a state that never appears as S
			contract.transitions.push({
				S: "S0",
				E: "detour",
				G: "go sideways",
				A: "diverge",
				N: "ORPHAN",
			});

			const result = checkWorkflowContract(contract);
			expect(
				hasFindingWithMessage(result.findings, "DEAD_STATE", "ORPHAN"),
			).toBe(true);
		});

		it("warns when no transitions to FAIL or BLOCKED", () => {
			const contract = validContract();
			contract.transitions = [
				{
					S: "S0",
					E: "start",
					G: "passes",
					A: "init",
					N: "DONE",
				},
			];

			const result = checkWorkflowContract(contract);
			expect(hasFinding(result.findings, "NO_FAILURE_PATH")).toBe(true);
		});
	});

	// ── Error code checks ───────────────────────────────────────────────────

	describe("error_codes", () => {
		it("fails when error_codes is missing", () => {
			const contract = validContract();
			(contract as unknown as Record<string, unknown>).error_codes = undefined;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_ERROR_CODES")).toBe(true);
		});

		it("fails when a required error code is missing", () => {
			const contract = validContract();
			contract.error_codes = ["VALIDATION_ERROR", "POLICY_FAIL"];

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(
				result.findings.filter(
					(f: CheckFinding) => f.code === "MISSING_ERROR_CODE",
				).length,
			).toBe(2); // BLOCKED_DEPENDENCY and SYSTEM_ERROR
		});
	});

	// ── Execution mode checks ───────────────────────────────────────────────

	describe("execution_modes", () => {
		it("fails when execution_modes is missing", () => {
			const contract = validContract();
			(contract as unknown as Record<string, unknown>).execution_modes =
				undefined;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_EXECUTION_MODES")).toBe(true);
		});

		it("fails when STRICT is missing", () => {
			const contract = validContract();
			contract.execution_modes = ["ADVISORY"];

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(
				hasFindingWithMessage(
					result.findings,
					"MISSING_EXECUTION_MODE",
					"STRICT",
				),
			).toBe(true);
		});

		it("fails when ADVISORY is missing", () => {
			const contract = validContract();
			contract.execution_modes = ["STRICT"];

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(
				hasFindingWithMessage(
					result.findings,
					"MISSING_EXECUTION_MODE",
					"ADVISORY",
				),
			).toBe(true);
		});
	});

	// ── Dry-run checks ──────────────────────────────────────────────────────

	describe("dry_run", () => {
		it("fails when dry_run is missing", () => {
			const contract = validContract();
			(contract as unknown as Record<string, unknown>).dry_run = undefined;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_DRY_RUN")).toBe(true);
		});

		it("fails when no_side_effects is false", () => {
			const contract = validContract();
			contract.dry_run.no_side_effects = false;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "DRY_RUN_SIDE_EFFECTS")).toBe(true);
		});

		it("fails when deterministic_trace is false", () => {
			const contract = validContract();
			contract.dry_run.deterministic_trace = false;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "DRY_RUN_NON_DETERMINISTIC")).toBe(
				true,
			);
		});
	});

	// ── Log field checks ────────────────────────────────────────────────────

	describe("log_fields", () => {
		it("fails when log_fields is missing", () => {
			const contract = validContract();
			(contract as unknown as Record<string, unknown>).log_fields = undefined;

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(hasFinding(result.findings, "MISSING_LOG_FIELDS")).toBe(true);
		});

		it("fails when a required log field is missing", () => {
			const contract = validContract();
			contract.log_fields = ["workflow_id", "from_state"];

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			expect(
				result.findings.filter(
					(f: CheckFinding) => f.code === "MISSING_LOG_FIELD",
				).length,
			).toBe(4); // transition_code, to_state, correlation_id, result
		});
	});

	// ── Error accumulation ──────────────────────────────────────────────────

	describe("error accumulation", () => {
		it("accumulates multiple errors from different checks", () => {
			const contract = validContract();
			(contract.metadata as unknown as Record<string, unknown>).owner = "";
			contract.error_codes = [];
			contract.log_fields = [];

			const result = checkWorkflowContract(contract);
			expect(result.pass).toBe(false);
			// At least owner + 4 error codes + 6 log fields = 11
			expect(result.summary.errors).toBeGreaterThanOrEqual(11);
		});

		it("provides fix suggestions for all errors", () => {
			const contract = validContract();
			(contract.metadata as unknown as Record<string, unknown>).owner = "";

			const result = checkWorkflowContract(contract);
			const ownerFinding = result.findings.find(
				(f: CheckFinding) => f.code === "MISSING_OWNER",
			);
			expect(ownerFinding?.fix).toBeDefined();
			expect(ownerFinding?.fix).toContain("owner");
		});
	});
});
