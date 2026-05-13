import { describe, expect, it } from "vitest";

import {
	OUTCOME_CLOSEOUT_SCHEMA_VERSION,
	isOutcomeCloseout,
	type OutcomeCloseout,
	validateOutcomeCloseout,
} from "./outcome-closeout.js";

function validCloseout(
	overrides: Partial<OutcomeCloseout> = {},
): OutcomeCloseout {
	return {
		schemaVersion: OUTCOME_CLOSEOUT_SCHEMA_VERSION,
		taskId: "JSC-198/outcome-closeout",
		outcome: "complete",
		sourceEvents: [
			{
				kind: "pr_readiness",
				ref: "green-sweep:pr-153",
				status: "pass",
				summary: "Required checks match the current PR head.",
			},
			{
				kind: "evidence_artifact",
				ref: ".harness/evals/jsc-198.md",
				status: "pass",
				summary: "Closure evidence artifact exists and validates.",
			},
			{
				kind: "validation_failure",
				ref: "validation:pnpm-typecheck",
				status: "pass",
				summary: "Typecheck completed successfully.",
			},
		],
		changed: [
			{
				summary: "Added outcome closeout contract.",
				path: "src/lib/flow-ops/outcome-closeout.ts",
				sourceRefs: ["green-sweep:pr-153", ".harness/evals/jsc-198.md"],
			},
		],
		provedBy: [
			{
				summary: "Focused closeout schema tests passed.",
				command: "pnpm vitest run src/lib/flow-ops/outcome-closeout.test.ts",
				status: "pass",
				sourceRefs: ["validation:pnpm-typecheck"],
				artifactRefs: ["src/lib/flow-ops/outcome-closeout.test.ts"],
			},
		],
		blockers: [],
		handedOff: [],
		claimBoundaries: [
			{
				claim: "The PR is merged.",
				reason: "PR readiness is proof of readiness only, not merge authority.",
				sourceRefs: ["green-sweep:pr-153"],
			},
		],
		nextAction: "Attach the closeout packet to the Flow Ops handoff.",
		...overrides,
	};
}

describe("validateOutcomeCloseout", () => {
	it("accepts a complete closeout built from structured source events", () => {
		const result = validateOutcomeCloseout(validCloseout());

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("narrows a valid closeout with the type guard", () => {
		const candidate: unknown = validCloseout();

		expect(isOutcomeCloseout(candidate)).toBe(true);
		if (isOutcomeCloseout(candidate)) {
			expect(candidate.sourceEvents.map((event) => event.kind)).toEqual([
				"pr_readiness",
				"evidence_artifact",
				"validation_failure",
			]);
		}
	});

	it("rejects invalid candidates with the type guard", () => {
		expect(isOutcomeCloseout({})).toBe(false);
	});

	it("rejects non-object closeout candidates", () => {
		const result = validateOutcomeCloseout("done");

		expect(result).toEqual({
			valid: false,
			errors: ["closeout must be an object"],
		});
	});

	it("requires source events so the schema cannot wrap prose-only closeout", () => {
		const result = validateOutcomeCloseout(validCloseout({ sourceEvents: [] }));

		expect(result.errors).toContain(
			"sourceEvents must include at least one structured source event",
		);
	});

	it("rejects manual-only source events", () => {
		const result = validateOutcomeCloseout(
			validCloseout({
				sourceEvents: [
					{
						kind: "manual",
						ref: "manual:human-note",
						status: "unknown",
						summary: "Human note without classifier evidence.",
					},
				],
				changed: [
					{
						summary: "Changed item backed only by a manual note.",
						sourceRefs: ["manual:human-note"],
					},
				],
				provedBy: [
					{
						summary: "Manual note says this passed.",
						status: "pass",
						sourceRefs: ["manual:human-note"],
					},
				],
				claimBoundaries: [
					{
						claim: "This is machine-proven.",
						reason: "Only manual source evidence was provided.",
						sourceRefs: ["manual:human-note"],
					},
				],
			}),
		);

		expect(result.errors).toContain(
			"sourceEvents must include at least one non-manual source event",
		);
	});

	it("requires complete outcomes to include changed work and proof", () => {
		const result = validateOutcomeCloseout(
			validCloseout({ changed: [], provedBy: [] }),
		);

		expect(result.errors).toEqual(
			expect.arrayContaining([
				"complete outcome requires at least one changed item",
				"complete outcome requires at least one proof item",
			]),
		);
	});

	it("rejects complete outcomes with completion-blocking blockers", () => {
		const result = validateOutcomeCloseout(
			validCloseout({
				blockers: [
					{
						classification: "introduced_regression",
						summary: "Focused tests fail on the current patch.",
						blocksCompletion: true,
						sourceRefs: ["validation:pnpm-typecheck"],
					},
				],
			}),
		);

		expect(result.errors).toContain(
			"complete outcome cannot include completion-blocking blockers",
		);
	});

	it("accepts complete outcomes with non-blocking blockers", () => {
		const result = validateOutcomeCloseout(
			validCloseout({
				blockers: [
					{
						classification: "pre_existing_drift",
						summary: "Known warning does not block this closeout.",
						blocksCompletion: false,
						sourceRefs: ["validation:pnpm-typecheck"],
					},
				],
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects complete outcomes with failed or blocked proof", () => {
		const result = validateOutcomeCloseout(
			validCloseout({
				provedBy: [
					{
						summary: "Focused closeout schema tests failed.",
						command:
							"pnpm vitest run src/lib/flow-ops/outcome-closeout.test.ts",
						status: "fail",
						sourceRefs: ["validation:pnpm-typecheck"],
					},
				],
			}),
		);

		expect(result.errors).toEqual(
			expect.arrayContaining([
				"complete outcome requires at least one passing proof item",
				"complete outcome cannot include failed or blocked proof",
			]),
		);
	});

	it("accepts blocked outcomes with validation classifier blocker context", () => {
		const result = validateOutcomeCloseout(
			validCloseout({
				outcome: "blocked",
				sourceEvents: [
					{
						kind: "validation_failure",
						ref: "validation:codestyle-fast",
						status: "fail",
						summary: "Codestyle parity mismatch predates this patch.",
					},
				],
				changed: [],
				provedBy: [],
				blockers: [
					{
						classification: "pre_existing_drift",
						summary: "Codestyle parity mismatch predates this patch.",
						blocksCompletion: true,
						sourceRefs: ["validation:codestyle-fast"],
					},
				],
				claimBoundaries: [],
				nextAction:
					"Keep the blocker classified and repair the drift separately.",
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("requires blocked outcomes to include at least one blocker", () => {
		const result = validateOutcomeCloseout(
			validCloseout({ outcome: "blocked", blockers: [] }),
		);

		expect(result.errors).toContain(
			"blocked outcome requires at least one blocker",
		);
	});

	it("accepts handoff outcomes with an explicit owner and claim boundary", () => {
		const result = validateOutcomeCloseout(
			validCloseout({
				outcome: "handoff",
				changed: [],
				provedBy: [],
				handedOff: [
					{
						owner: "human",
						summary: "Human merge approval is still required.",
						nextAction: "Review the structured closeout before merging.",
						sourceRefs: ["green-sweep:pr-153"],
					},
				],
				claimBoundaries: [
					{
						claim: "This is self-approved.",
						reason:
							"The closeout only records evidence and cannot approve itself.",
						sourceRefs: ["green-sweep:pr-153"],
					},
				],
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("requires handoff outcomes to include at least one handoff", () => {
		const result = validateOutcomeCloseout(
			validCloseout({ outcome: "handoff", handedOff: [] }),
		);

		expect(result.errors).toContain(
			"handoff outcome requires at least one handoff",
		);
	});

	it("requires all closeout facts to cite source references", () => {
		const result = validateOutcomeCloseout(
			validCloseout({
				changed: [
					{
						summary: "Changed without evidence.",
						sourceRefs: [],
					},
				],
				provedBy: [
					{
						summary: "Proof without evidence.",
						status: "pass",
						sourceRefs: [],
					},
				],
				blockers: [
					{
						classification: "missing_artifact",
						summary: "Blocker without evidence.",
						blocksCompletion: true,
						sourceRefs: [],
					},
				],
				handedOff: [
					{
						owner: "agent",
						summary: "Handoff without evidence.",
						nextAction: "Retry.",
						sourceRefs: [],
					},
				],
				claimBoundaries: [
					{
						claim: "Boundary without evidence.",
						reason: "No source was attached.",
						sourceRefs: [],
					},
				],
			}),
		);

		expect(result.errors).toEqual(
			expect.arrayContaining([
				"changed[0].sourceRefs must include at least one source reference",
				"provedBy[0].sourceRefs must include at least one source reference",
				"blockers[0].sourceRefs must include at least one source reference",
				"handedOff[0].sourceRefs must include at least one source reference",
				"claimBoundaries[0].sourceRefs must include at least one source reference",
			]),
		);
	});

	it("requires source references to resolve to source events", () => {
		const result = validateOutcomeCloseout(
			validCloseout({
				changed: [
					{
						summary: "Changed item cites missing evidence.",
						sourceRefs: ["validation:not-recorded"],
					},
				],
			}),
		);

		expect(result.errors).toContain(
			"changed[0].sourceRefs contains unknown source reference validation:not-recorded",
		);
	});

	it("rejects invalid enum values and malformed nested fields", () => {
		const result = validateOutcomeCloseout({
			...validCloseout(),
			outcome: "done",
			sourceEvents: [
				{
					kind: "comment",
					ref: "",
					status: "green",
					summary: "",
				},
			],
			provedBy: [
				{
					summary: "Invalid proof status.",
					status: "ok",
					sourceRefs: ["manual:proof"],
				},
			],
		});

		expect(result.errors).toEqual(
			expect.arrayContaining([
				"outcome must be one of complete, partial, blocked, handoff, advisory_only",
				"sourceEvents[0].kind must be one of pr_readiness, evidence_artifact, validation_failure, manual",
				"sourceEvents[0].ref must be a non-empty string",
				"sourceEvents[0].status must be one of pass, fail, blocked, missing, unknown",
				"sourceEvents[0].summary must be a non-empty string",
				"provedBy[0].status must be one of pass, fail, blocked",
			]),
		);
	});
});
