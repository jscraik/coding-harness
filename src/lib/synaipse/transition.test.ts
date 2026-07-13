import { describe, expect, it } from "vitest";
import {
	decideSynaipseTransition,
	validateSynaipseTransition,
	type SynaipseTransitionInput,
} from "./transition.js";

const NOW = "2026-07-13T14:00:00Z";
const SHA = "63be2371437239c657d80b0a1b2709923bbb262d";

function validTransition(): SynaipseTransitionInput {
	return {
		schemaVersion: "synaipse-transition/v1",
		transitionId: "ch_transition_7K4M2P9QX3DR",
		fromStage: "verify",
		toStage: "review",
		repositorySha: SHA,
		evidence: {
			currentSha: SHA,
			refs: ["github:refs/heads/main", "collector:current"],
			observedAt: NOW,
			hostedMain: {
				remote: "https://github.com/jscraik/coding-harness.git",
				ref: "refs/heads/main",
				sha: SHA,
				observedAt: NOW,
			},
		},
		authority: {
			owner: "codex",
			standing: true,
			capabilities: ["transition:verify->review", "waiver:verify->review"],
		},
		vitalDecision: { required: false, question: null },
		waiver: null,
		recovery: null,
		decidedAt: NOW,
	};
}

function transitionWith(
	overrides: Partial<SynaipseTransitionInput>,
): SynaipseTransitionInput {
	return { ...validTransition(), ...overrides };
}

describe("synaipse-transition/v1", () => {
	it("accepts a current-SHA transition with standing authority", () => {
		const input = validTransition();
		expect(validateSynaipseTransition(input)).toEqual({
			valid: true,
			errors: [],
		});
		expect(
			decideSynaipseTransition(input, { expectedSha: SHA, now: NOW }),
		).toMatchObject({ status: "admitted", blockers: [], recovery: null });
	});

	it("blocks a stale SHA and supplies deterministic recovery", () => {
		const input = transitionWith({
			repositorySha: "old-sha",
			evidence: {
				...validTransition().evidence,
				currentSha: "old-sha",
				hostedMain: {
					...validTransition().evidence.hostedMain,
					sha: "old-sha",
				},
			},
		});
		const result = decideSynaipseTransition(input, {
			expectedSha: SHA,
			now: NOW,
		});
		expect(result).toMatchObject({
			status: "blocked",
			blockers: ["stale_sha"],
			recovery: "refresh_evidence",
		});
	});

	it("blocks integration without standing authority", () => {
		const input = transitionWith({
			authority: { ...validTransition().authority, standing: false },
		});
		const result = decideSynaipseTransition(input, {
			expectedSha: SHA,
			now: NOW,
		});
		expect(result).toMatchObject({
			status: "blocked",
			blockers: ["standing_authority_required"],
			recovery: "obtain_standing_authority",
		});
	});

	it("interrupts only when a Vital Decision is required", () => {
		const input = transitionWith({
			vitalDecision: {
				required: true,
				question: "May this transition mutate the hosted branch?",
			},
		});
		const result = decideSynaipseTransition(input, {
			expectedSha: SHA,
			now: NOW,
		});
		expect(result).toMatchObject({
			status: "interrupted",
			blockers: ["vital_decision_required"],
			recovery: "request_operator_decision",
		});
	});

	it("rejects an expired waiver before evaluating the transition", () => {
		const input = transitionWith({
			waiver: {
				id: "ch_waiver_7K4M2P9QX3DR",
				issuer: "codex",
				scope: "verify->review",
				reason: "temporary review exception",
				compensation: "fresh adversarial review before handoff",
				expiresAt: "2026-07-12T23:59:59Z",
				retirementCondition: "remove after this transition",
			},
		});
		const result = decideSynaipseTransition(input, {
			expectedSha: SHA,
			now: NOW,
		});
		expect(result).toMatchObject({
			status: "blocked",
			blockers: ["waiver_expired"],
			recovery: "renew_waiver_or_follow_policy",
		});
	});

	it("allows an explicitly scoped current waiver", () => {
		const input = transitionWith({
			waiver: {
				id: "ch_waiver_7K4M2P9QX3DR",
				issuer: "codex",
				scope: "verify->review",
				reason: "temporary review exception",
				compensation: "fresh adversarial review before handoff",
				expiresAt: "2026-07-14T23:59:59Z",
				retirementCondition: "remove after this transition",
			},
		});
		const result = decideSynaipseTransition(input, {
			expectedSha: SHA,
			now: NOW,
		});
		expect(result).toMatchObject({ status: "admitted", blockers: [] });
	});

	it("rejects a waiver that covers a different transition", () => {
		const input = transitionWith({
			waiver: {
				id: "ch_waiver_7K4M2P9QX3DR",
				issuer: "codex",
				scope: "review->handoff",
				reason: "temporary review exception",
				compensation: "fresh adversarial review before handoff",
				expiresAt: "2026-07-14T23:59:59Z",
				retirementCondition: "remove after this transition",
			},
		});
		const result = decideSynaipseTransition(input, {
			expectedSha: SHA,
			now: NOW,
		});
		expect(result).toMatchObject({
			status: "blocked",
			blockers: ["waiver_scope_or_authority_invalid"],
		});
	});

	it("rejects stage transitions outside the lifecycle graph", () => {
		const input = transitionWith({ fromStage: "orient", toStage: "handoff" });
		const result = decideSynaipseTransition(input, {
			expectedSha: SHA,
			now: NOW,
		});
		expect(result).toMatchObject({
			status: "blocked",
			blockers: ["stage_transition_not_allowed"],
			recovery: "return_to_previous_stage",
		});
	});

	it("accepts recovery after evidence is refreshed to the current SHA", () => {
		const input = transitionWith({
			recovery: {
				fromBlocker: "stale_sha",
				refreshedSha: SHA,
				evidenceRefs: ["recovery:stale_sha"],
			},
		});
		input.evidence.refs.push("recovery:stale_sha");
		const result = decideSynaipseTransition(input, {
			expectedSha: SHA,
			now: NOW,
		});
		expect(result).toMatchObject({
			status: "admitted",
			blockers: [],
			recovery: null,
		});
	});

	it("requires an operator receipt to recover from a Vital Decision", () => {
		const input = transitionWith({
			authority: {
				owner: "codex",
				standing: true,
				capabilities: ["transition:verify->review"],
			},
			recovery: {
				fromBlocker: "vital_decision_required",
				refreshedSha: SHA,
				evidenceRefs: ["recovery:vital_decision_required"],
			},
		});
		input.evidence.refs.push("recovery:vital_decision_required");
		expect(validateSynaipseTransition(input).valid).toBe(false);
		expect(
			decideSynaipseTransition(input, { expectedSha: SHA, now: NOW }),
		).toMatchObject({
			status: "blocked",
			blockers: ["invalid_transition_contract"],
		});
	});

	it("accepts operator-authorized recovery after a Vital Decision", () => {
		const input = transitionWith({
			authority: {
				owner: "operator",
				standing: true,
				capabilities: ["transition:verify->review"],
			},
			vitalDecision: { required: false, question: null },
			recovery: {
				fromBlocker: "vital_decision_required",
				refreshedSha: SHA,
				evidenceRefs: [
					"recovery:vital_decision_required",
					"operator-decision:ch_decision_7K4M2P9QX3DR",
				],
			},
		});
		input.evidence.refs.push(
			"recovery:vital_decision_required",
			"operator-decision:ch_decision_7K4M2P9QX3DR",
		);
		expect(validateSynaipseTransition(input)).toEqual({
			valid: true,
			errors: [],
		});
		expect(
			decideSynaipseTransition(input, { expectedSha: SHA, now: NOW }),
		).toMatchObject({ status: "admitted", blockers: [] });
	});

	it("rejects recovery claims that cite an unconstrained blocker", () => {
		const input = {
			...validTransition(),
			recovery: {
				fromBlocker: "invented-blocker" as SynaipseTransitionInput["recovery"] &
					never,
				refreshedSha: SHA,
				evidenceRefs: ["recovery:invented-blocker"],
			},
		} as unknown as SynaipseTransitionInput;
		input.evidence.refs.push("recovery:invented-blocker");
		expect(
			decideSynaipseTransition(input, { expectedSha: SHA, now: NOW }),
		).toMatchObject({
			status: "blocked",
			blockers: ["invalid_transition_contract"],
		});
	});

	it("requires canonical hosted-main provenance", () => {
		const input = {
			...validTransition(),
			evidence: {
				...validTransition().evidence,
				hostedMain: {
					...validTransition().evidence.hostedMain,
					remote: "https://example.invalid",
				},
			},
		};
		expect(validateSynaipseTransition(input).valid).toBe(false);
	});

	it("rejects a standing authority without the transition capability", () => {
		const input = transitionWith({
			authority: { owner: "codex", standing: true, capabilities: ["read"] },
		});
		expect(
			decideSynaipseTransition(input, { expectedSha: SHA, now: NOW }),
		).toMatchObject({
			status: "blocked",
			blockers: ["authority_capability_missing"],
		});
	});

	it("rejects a Vital Decision without a question", () => {
		const input = transitionWith({
			vitalDecision: { required: true, question: null },
		});
		expect(validateSynaipseTransition(input).valid).toBe(false);
	});

	it("rejects an invalid decision time", () => {
		const input = validTransition();
		expect(
			decideSynaipseTransition(input, { expectedSha: SHA, now: "tomorrow" }),
		).toMatchObject({
			status: "blocked",
			blockers: ["invalid_transition_options"],
		});
	});

	it("rejects an RFC3339 timestamp without seconds", () => {
		const input = transitionWith({ decidedAt: "2026-07-13T14:00Z" });
		expect(validateSynaipseTransition(input).valid).toBe(false);
	});
});
