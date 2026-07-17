import { describe, expect, it } from "vitest";
import {
	buildSynaipseTransition,
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
		fromStage: "build",
		toStage: "prove",
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
			capabilities: ["transition:build->prove", "waiver:build->prove"],
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
	it("transports explicit authority and Vital Decision inputs without defaults", () => {
		const record = buildSynaipseTransition({
			transitionId: "ch_transition_explicit_authority",
			fromStage: "build",
			toStage: "prove",
			repositorySha: SHA,
			hostedMainSha: SHA,
			evidenceRefs: ["authority:validated"],
			observedAt: NOW,
			authority: {
				owner: "operator",
				standing: false,
				capabilities: ["read"],
			},
			vitalDecision: {
				required: true,
				question: "May this transition proceed?",
			},
		});

		expect(record.authority).toEqual({
			owner: "operator",
			standing: false,
			capabilities: ["read"],
		});
		expect(record.vitalDecision).toEqual({
			required: true,
			question: "May this transition proceed?",
		});
	});

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
		const oldSha = "a".repeat(40);
		const input = transitionWith({
			repositorySha: oldSha,
			evidence: {
				...validTransition().evidence,
				currentSha: oldSha,
				hostedMain: {
					...validTransition().evidence.hostedMain,
					sha: oldSha,
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
				scope: "build->prove",
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
				scope: "build->prove",
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
				scope: "review->integrate",
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
		const input = transitionWith({ fromStage: "shape", toStage: "integrate" });
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

	it("accepts a checkout SHA that is newer than the observed hosted main", () => {
		const input = validTransition();
		input.evidence.hostedMain.sha = "4b9c2abe870d38bfadd5b8836c73cf7ea8af2abe";

		expect(validateSynaipseTransition(input)).toEqual({
			valid: true,
			errors: [],
		});
		expect(
			decideSynaipseTransition(input, { expectedSha: SHA, now: NOW }),
		).toMatchObject({ status: "admitted", blockers: [] });
	});

	it("rejects a malformed hosted-main SHA independently from checkout HEAD", () => {
		const input = validTransition();
		input.evidence.hostedMain.sha = "not-a-sha";

		expect(validateSynaipseTransition(input)).toMatchObject({
			valid: false,
			errors: [
				{
					path: "evidence.hostedMain.sha",
					message: "must be a full lowercase git SHA",
				},
			],
		});
	});

	it("rejects malformed checkout and recovery SHA identities", () => {
		const input = transitionWith({
			recovery: {
				fromBlocker: "stale_sha",
				refreshedSha: "not-a-sha",
				evidenceRefs: ["recovery:stale_sha"],
			},
		});
		input.repositorySha = "not-a-sha";
		input.evidence.currentSha = "not-a-sha";
		input.evidence.refs.push("recovery:stale_sha");

		const result = validateSynaipseTransition(input);

		expect(result.valid).toBe(false);
		for (const path of [
			"repositorySha",
			"evidence.currentSha",
			"recovery.refreshedSha",
		])
			expect(result.errors).toContainEqual({
				path,
				message: "must be a full lowercase git SHA",
			});
	});

	it("rejects recovery with a refreshed SHA different from checkout HEAD", () => {
		const input = transitionWith({
			recovery: {
				fromBlocker: "stale_sha",
				refreshedSha: "different-sha",
				evidenceRefs: ["recovery:stale_sha"],
			},
		});
		input.evidence.refs.push("recovery:stale_sha");
		const result = validateSynaipseTransition(input);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "recovery.refreshedSha",
			message: "must match evidence.currentSha",
		});
	});

	it("rejects recovery when the blocker ref is absent from recovery evidence", () => {
		const input = transitionWith({
			recovery: {
				fromBlocker: "stale_sha",
				refreshedSha: SHA,
				evidenceRefs: ["collector:current"],
			},
		});
		input.evidence.refs.push("recovery:stale_sha");
		expect(validateSynaipseTransition(input).valid).toBe(false);
	});

	it("requires an operator receipt to recover from a Vital Decision", () => {
		const input = transitionWith({
			authority: {
				owner: "codex",
				standing: true,
				capabilities: ["transition:build->prove"],
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
			blockers: ["recovery_reference_invalid"],
		});
	});

	it("accepts operator-authorized recovery after a Vital Decision", () => {
		const input = transitionWith({
			authority: {
				owner: "operator",
				standing: true,
				capabilities: ["transition:build->prove"],
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

	it("rejects capability recovery while the capability is still missing", () => {
		const input = transitionWith({
			authority: { owner: "codex", standing: true, capabilities: ["read"] },
			recovery: {
				fromBlocker: "authority_capability_missing",
				refreshedSha: SHA,
				evidenceRefs: ["recovery:authority_capability_missing"],
			},
		});
		input.evidence.refs.push("recovery:authority_capability_missing");
		expect(validateSynaipseTransition(input)).toMatchObject({
			valid: false,
			errors: [
				{
					path: "authority.capabilities",
					message: "must include the recovered transition capability",
				},
			],
		});
	});

	it("rejects standing-authority recovery while authority is not standing", () => {
		const input = transitionWith({
			authority: { ...validTransition().authority, standing: false },
			recovery: {
				fromBlocker: "standing_authority_required",
				refreshedSha: SHA,
				evidenceRefs: ["recovery:standing_authority_required"],
			},
		});
		input.evidence.refs.push("recovery:standing_authority_required");
		expect(validateSynaipseTransition(input)).toMatchObject({
			valid: false,
			errors: [
				{
					path: "authority.standing",
					message: "must be true after standing-authority recovery",
				},
			],
		});
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
			blockers: ["recovery_reference_invalid"],
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

	it.each([
		["evidence.observedAt", "evidence"],
		["evidence.hostedMain.observedAt", "hosted main"],
	] as const)("rejects decisions made before %s", (_path, source) => {
		const evidence = validTransition().evidence;
		const input = transitionWith({
			evidence: {
				...evidence,
				observedAt:
					source === "evidence" ? "2026-07-14T00:00:00Z" : evidence.observedAt,
				hostedMain: {
					...evidence.hostedMain,
					observedAt:
						source === "hosted main"
							? "2026-07-14T00:00:00Z"
							: evidence.hostedMain.observedAt,
				},
			},
		});
		const result = validateSynaipseTransition(input);
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: _path }),
		);
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

	it.each([
		null,
		undefined,
		[],
		"not-an-object",
		42,
		true,
	])("fails closed for malformed top-level input: %s", (input) => {
		expect(
			decideSynaipseTransition(input as unknown as SynaipseTransitionInput, {
				expectedSha: SHA,
				now: NOW,
			}),
		).toMatchObject({
			status: "blocked",
			blockers: ["invalid_transition_contract"],
		});
	});

	it("rejects an RFC3339 timestamp without seconds", () => {
		const input = transitionWith({ decidedAt: "2026-07-13T14:00Z" });
		expect(validateSynaipseTransition(input).valid).toBe(false);
	});

	it.each([
		"2026-02-30T23:00:00Z",
		"2026-07-11T24:00:00Z",
		"2026-07-11T23:00:00+24:00",
	])("rejects normalized or out-of-range RFC3339 values: %s", (timestamp) => {
		const input = transitionWith({ decidedAt: timestamp });
		expect(validateSynaipseTransition(input).valid).toBe(false);
	});

	it("accepts every canonical lifecycle stage transition", () => {
		const transitions = [
			["shape", "admit"],
			["admit", "build"],
			["build", "prove"],
			["prove", "review"],
			["review", "integrate"],
			["integrate", "improve"],
			["improve", "shape"],
		] as const;
		for (const [fromStage, toStage] of transitions) {
			const input = transitionWith({
				fromStage,
				toStage,
				authority: {
					...validTransition().authority,
					capabilities: [`transition:${fromStage}->${toStage}`],
				},
			});
			expect(
				decideSynaipseTransition(input, { expectedSha: SHA, now: NOW }),
			).toMatchObject({ status: "admitted" });
		}
	});

	it("rejects a waiver that is not authorized at the validation boundary", () => {
		const input = transitionWith({
			waiver: {
				id: "ch_waiver_7K4M2P9QX3DR",
				issuer: "operator",
				scope: "admit->build",
				reason: "temporary exception",
				compensation: "fresh review",
				expiresAt: "2026-07-14T23:59:59Z",
				retirementCondition: "remove after transition",
			},
		});
		expect(validateSynaipseTransition(input).valid).toBe(false);
		expect(
			decideSynaipseTransition(input, { expectedSha: SHA, now: NOW }),
		).toMatchObject({
			status: "blocked",
			blockers: ["waiver_scope_or_authority_invalid"],
		});
	});
});
