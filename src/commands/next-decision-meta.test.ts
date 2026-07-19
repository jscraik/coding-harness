import { describe, expect, it } from "vitest";
import { validateHarnessDecision } from "../lib/decision/harness-decision.js";
import {
	createNextDecision,
	nextDecisionOperationalMeta,
} from "./next-decision-meta.js";

describe("nextDecisionOperationalMeta", () => {
	it("keeps canonical evidence metadata ahead of caller extras", () => {
		const meta = nextDecisionOperationalMeta({
			mode: "local",
			extra: {
				sourceErrors: [{ kind: "git", ref: "caller" }],
			},
			sourceErrors: [
				{
					kind: "git",
					ref: "canonical",
					freshness: "current",
					sha: null,
					status: "usable",
					failureClass: null,
				},
			],
		});

		expect(meta.sourceErrors).toEqual([
			expect.objectContaining({ ref: "canonical" }),
		]);
	});

	it("keeps Git-mutating recommendations separate from the current invocation", () => {
		const decision = createNextDecision({
			status: "action_required",
			summary: "A later Git mutation needs authorization.",
			nextAction: "Apply the authorized Git mutation.",
			nextCommand: "git commit -m approved-change",
			safeToRun: true,
			requiresHuman: false,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: ["git:status"],
			failureClass: null,
			retry: "manual",
			riskTier: "high",
			meta: nextDecisionOperationalMeta({
				mode: "local",
				commands: ["git commit -m approved-change"],
				requiresGitWrite: true,
			}),
		});

		expect(decision.meta?.recommendationEffects).toMatchObject({
			schemaVersion: "harness-recommendation-effects/v1",
			authority: { requiresGitWrite: true },
			rollbackPosture: "not_started",
			requiredEvidence: ["git:status"],
			retry: "manual",
			permissionPlan: {
				requiresGitWrite: true,
				commands: ["git commit -m approved-change"],
			},
		});
		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects undeclared fields inside versioned recommendation effects", () => {
		const decision = createNextDecision({
			status: "action_required",
			summary: "A later Git mutation needs authorization.",
			nextAction: "Apply the authorized Git mutation.",
			nextCommand: "git commit -m approved-change",
			safeToRun: true,
			requiresHuman: false,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: ["git:status"],
			failureClass: null,
			retry: "manual",
			riskTier: "high",
			meta: nextDecisionOperationalMeta({
				mode: "local",
				commands: ["git commit -m approved-change"],
				requiresGitWrite: true,
			}),
		});
		const candidate = {
			...decision,
			meta: {
				...decision.meta,
				recommendationEffects: {
					...decision.meta?.recommendationEffects,
					permissionPlan: {
						...decision.meta?.recommendationEffects?.permissionPlan,
						mutatesExternal: true,
					},
				},
			},
		};

		const result = validateHarnessDecision(candidate);

		expect(result.valid).toBe(false);
		expect(result.errors.map((error) => error.code)).toContain(
			"meta.recommendationEffects.permissionPlan.mutatesExternal is not allowed",
		);
	});
});
