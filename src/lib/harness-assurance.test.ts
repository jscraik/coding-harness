import { describe, expect, it } from "vitest";

import {
	type HarnessAssuranceEntry,
	type HarnessAssuranceLayer,
	validateHarnessAssuranceEntries,
} from "./harness-assurance.js";

const completeLifecycleState = {
	automationState:
		"heartbeat continue-pr-260-closeout deleted after user stop request",
	branchWorktreeState:
		"branch codex/meta-steering-feedback-contract has expected dirty plan artifacts",
	linearState: "JSC-328 linked in active plan artifact",
	mergeState: "PR not merged; implementation lane remains local",
	nextLaneRouting: "continue PU-002/PU-006 implementation before closeout",
	prState: "PR #261 open",
	reviewThreadState: "CodeRabbit thread state must be checked before merge",
};

const completeMatrixByLayer: Record<
	HarnessAssuranceLayer,
	HarnessAssuranceEntry
> = {
	boundary: {
		evidence: [
			"missing evidence and blocked-state boundaries return named blockers",
		],
		layer: "boundary",
		status: "pass",
	},
	e2e: {
		evidence: [
			"runner-owned E2E artifacts are distinct from wrapper-owned smoke evidence",
		],
		layer: "e2e",
		status: "pass",
	},
	lifecycle_closeout: {
		evidence: [
			"closeout proof names PR, merge, branch, Linear, review, automation, and routing state",
		],
		layer: "lifecycle_closeout",
		lifecycleState: completeLifecycleState,
		status: "pass",
	},
	load_stress: {
		evidence: ["load/stress claims include a numeric acceptance threshold"],
		layer: "load_stress",
		status: "pass",
		threshold: {
			metric: "validated assurance layers",
			operator: ">=",
			unit: "layers",
			value: 7,
		},
	},
	mock_integration: {
		evidence: [
			"fixture-backed adapters may be recorded without touching live external systems",
		],
		layer: "mock_integration",
		status: "pass",
	},
	security: {
		evidence: [
			"misuse and unauthorized-command checks must cite a policy reason",
		],
		layer: "security",
		status: "pass",
	},
	unit: {
		evidence: ["src/lib/harness-assurance.test.ts validates unit behavior"],
		layer: "unit",
		status: "pass",
	},
};

function completeMatrix(
	overrides: Partial<Record<HarnessAssuranceLayer, HarnessAssuranceEntry>> = {},
	extras: HarnessAssuranceEntry[] = [],
): HarnessAssuranceEntry[] {
	return [
		overrides.unit ?? completeMatrixByLayer.unit,
		overrides.boundary ?? completeMatrixByLayer.boundary,
		overrides.mock_integration ?? completeMatrixByLayer.mock_integration,
		overrides.e2e ?? completeMatrixByLayer.e2e,
		overrides.security ?? completeMatrixByLayer.security,
		overrides.load_stress ?? completeMatrixByLayer.load_stress,
		overrides.lifecycle_closeout ?? completeMatrixByLayer.lifecycle_closeout,
		...extras,
	];
}

describe("validateHarnessAssuranceEntries", () => {
	it("accepts a complete seven-layer harness assurance matrix", () => {
		expect(validateHarnessAssuranceEntries(completeMatrix())).toEqual({
			findings: [],
			valid: true,
		});
	});

	it("rejects a matrix that omits a required assurance layer", () => {
		const withoutSecurity = completeMatrix().filter(
			(entry) => entry.layer !== "security",
		);

		expect(validateHarnessAssuranceEntries(withoutSecurity)).toEqual({
			findings: [
				{
					blockerClass: "missing_layer",
					layer: "security",
					message:
						"security assurance entries must be present in the seven-layer matrix.",
				},
			],
			valid: false,
		});
	});

	it("rejects passing boundary evidence when the evidence reference is missing", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					boundary: {
						evidence: [" "],
						layer: "boundary",
						status: "pass",
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "missing_evidence",
					layer: "boundary",
					message:
						"boundary assurance entries require at least one evidence reference.",
				},
			],
			valid: false,
		});
	});

	it("rejects duplicate assurance layers", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({}, [
					{
						evidence: ["second unit proof"],
						layer: "unit",
						status: "pass",
					},
				]),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "duplicate_layer",
					layer: "unit",
					message: "unit assurance entries must appear at most once.",
				},
			],
			valid: false,
		});
	});

	it("rejects blocked mock integration evidence without both reason and follow-up", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					mock_integration: {
						evidence: ["mock adapter credential blocker"],
						layer: "mock_integration",
						status: "blocked",
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "missing_reason",
					layer: "mock_integration",
					message:
						"mock_integration assurance entries marked blocked require a concrete reason.",
				},
				{
					blockerClass: "missing_follow_up",
					layer: "mock_integration",
					message:
						"mock_integration assurance entries marked blocked require a named follow-up owner or action.",
				},
			],
			valid: false,
		});
	});

	it("rejects partial assurance evidence without a reason", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					mock_integration: {
						evidence: ["mock integration proof is incomplete"],
						layer: "mock_integration",
						status: "partial",
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "missing_reason",
					layer: "mock_integration",
					message:
						"mock_integration assurance entries marked partial require a concrete reason.",
				},
			],
			valid: false,
		});
	});

	it("rejects n.a. assurance evidence without a reason", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					e2e: {
						evidence: ["e2e layer not applicable for docs-only change"],
						layer: "e2e",
						status: "n.a.",
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "missing_reason",
					layer: "e2e",
					message:
						"e2e assurance entries marked n.a. require a concrete reason.",
				},
			],
			valid: false,
		});
	});

	it("rejects partial assurance evidence when the evidence reference is missing", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					security: {
						evidence: [" "],
						layer: "security",
						reason: "Credentials unavailable for live security lane",
						status: "partial",
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "missing_evidence",
					layer: "security",
					message:
						"security assurance entries require at least one evidence reference.",
				},
			],
			valid: false,
		});
	});

	it("rejects load/stress pass claims without a finite numeric threshold", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					load_stress: {
						evidence: [
							"pnpm vitest run src/lib/preflight/performance-overload.test.ts",
						],
						layer: "load_stress",
						status: "pass",
						threshold: {
							metric: "overload guard checks",
							operator: ">=",
							unit: "checks",
							value: Number.NaN,
						},
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "missing_threshold",
					layer: "load_stress",
					message:
						"load_stress assurance entries marked pass require a finite numeric threshold.",
				},
			],
			valid: false,
		});
	});

	it("rejects load/stress pass claims with incomplete threshold metadata", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					load_stress: {
						evidence: [
							"pnpm vitest run src/lib/preflight/performance-overload.test.ts",
						],
						layer: "load_stress",
						status: "pass",
						threshold: {
							metric: "",
							operator: ">" as unknown as ">=",
							unit: "",
							value: 100,
						},
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "missing_threshold",
					layer: "load_stress",
					message:
						"load_stress assurance entries marked pass require a finite numeric threshold.",
				},
			],
			valid: false,
		});
	});

	it("rejects lifecycle closeout pass claims with missing live-state proof", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					lifecycle_closeout: {
						evidence: ["pr-closeout artifact"],
						layer: "lifecycle_closeout",
						lifecycleState: {
							...completeLifecycleState,
							automationState: "",
						},
						status: "pass",
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "missing_lifecycle_state",
					layer: "lifecycle_closeout",
					message:
						"lifecycle_closeout assurance entries marked pass require PR, merge, branch/worktree, Linear, review-thread, automation, and next-lane state.",
				},
			],
			valid: false,
		});
	});

	it("rejects lifecycle closeout pass claims that admit an unobserved horizon", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					lifecycle_closeout: {
						evidence: ["pr-closeout artifact"],
						layer: "lifecycle_closeout",
						lifecycleState: {
							...completeLifecycleState,
							unobservedHorizon:
								"CodeRabbit unresolved threads were not observable",
						},
						status: "pass",
					},
				}),
			),
		).toEqual({
			findings: [
				{
					blockerClass: "unobserved_horizon",
					layer: "lifecycle_closeout",
					message:
						"lifecycle_closeout assurance entries with an unobserved horizon cannot be marked pass.",
				},
			],
			valid: false,
		});
	});

	it("accepts blocked lifecycle closeout evidence when the blocker and next action are explicit", () => {
		expect(
			validateHarnessAssuranceEntries(
				completeMatrix({
					lifecycle_closeout: {
						evidence: ["network blocker captured in closeout report"],
						followUp:
							"owner: closeout agent must refresh GitHub and Linear state",
						layer: "lifecycle_closeout",
						reason:
							"Unobserved Horizon: network access unavailable for live PR state",
						status: "blocked",
					},
				}),
			),
		).toEqual({
			findings: [],
			valid: true,
		});
	});
});
