import { describe, expect, it } from "vitest";
import {
	NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS,
	createNorthStarGuardrailId,
	getNorthStarAlignmentDecisionPath,
	getNorthStarDriftFindingsPath,
	getNorthStarDurableGuardrailPath,
	getNorthStarOverrideAcknowledgementPath,
	getNorthStarSurfaceClassificationSnapshotPath,
} from "./north-star-artifacts.js";

describe("north-star artifact contract", () => {
	it("declares canonical schema versions for AC3 sidecar artifacts", () => {
		expect(NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS).toEqual({
			alignmentDecision: "north-star-alignment-decision/v1",
			driftFindings: "north-star-drift-findings/v1",
			surfaceClassificationSnapshot: "north-star-surface-classification/v1",
			overrideAcknowledgement: "north-star-override-acknowledgement/v1",
			durableGuardrail: "north-star-durable-guardrail/v1",
		});
	});

	it("keeps gate artifact paths stable and repository relative", () => {
		expect(getNorthStarAlignmentDecisionPath()).toBe(
			".harness/guardrails/north-star/alignment-decision.json",
		);
		expect(getNorthStarDriftFindingsPath()).toBe(
			".harness/guardrails/north-star/drift-findings.json",
		);
		expect(getNorthStarSurfaceClassificationSnapshotPath()).toBe(
			".harness/guardrails/north-star/surface-classification-snapshot.json",
		);
	});

	it("derives override acknowledgement paths from date and stable id", () => {
		expect(
			getNorthStarOverrideAcknowledgementPath(
				"2026-04-26",
				"reviewer-approved-policy-surface",
			),
		).toBe(
			".harness/overrides/north-star-alignment/2026-04-26/reviewer-approved-policy-surface/override-acknowledgement.json",
		);
	});

	it("derives duplicate-resistant durable guardrail paths", () => {
		const guardrailId = createNorthStarGuardrailId({
			failureClass: "review_evidence_incomplete",
			surfaceIds: ["review-gate", "drift-gate"],
		});

		expect(guardrailId).toBe(
			"review-evidence-incomplete--drift-gate-review-gate",
		);
		expect(
			getNorthStarDurableGuardrailPath(
				"review_evidence_incomplete",
				guardrailId,
			),
		).toBe(
			".harness/guardrails/north-star/review_evidence_incomplete/review-evidence-incomplete--drift-gate-review-gate/guardrail.json",
		);
	});
});
