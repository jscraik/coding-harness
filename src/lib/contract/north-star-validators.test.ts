import { describe, expect, it } from "vitest";
import {
	type BlockedResumeState,
	isValidBlockedStateRecord,
	mapFailureClassToResumeState,
} from "./north-star-validators.js";

describe("mapFailureClassToResumeState", () => {
	it("maps admission_incomplete to A2", () => {
		expect(mapFailureClassToResumeState("admission_incomplete")).toBe("A2");
	});

	it("maps admission_unjustified to A2", () => {
		expect(mapFailureClassToResumeState("admission_unjustified")).toBe("A2");
	});

	it("maps surface_registration_gap to A2", () => {
		expect(mapFailureClassToResumeState("surface_registration_gap")).toBe("A2");
	});

	it("maps cadence_breach to A2", () => {
		expect(mapFailureClassToResumeState("cadence_breach")).toBe("A2");
	});

	it("maps review_evidence_contradiction to A3", () => {
		expect(mapFailureClassToResumeState("review_evidence_contradiction")).toBe(
			"A3",
		);
	});

	it("maps drift_blocking to A4", () => {
		expect(mapFailureClassToResumeState("drift_blocking")).toBe("A4");
	});

	it("returns undefined for unknown failure classes", () => {
		expect(mapFailureClassToResumeState("unknown_class")).toBeUndefined();
		expect(mapFailureClassToResumeState("contract_invalid")).toBeUndefined();
	});
});

describe("isValidBlockedStateRecord", () => {
	it("returns true for valid A2 / admission_incomplete pair", () => {
		expect(isValidBlockedStateRecord("A2", "admission_incomplete")).toBe(true);
	});

	it("returns true for valid A4 / drift_blocking pair", () => {
		expect(isValidBlockedStateRecord("A4", "drift_blocking")).toBe(true);
	});

	it("returns false when state does not match failure class", () => {
		expect(isValidBlockedStateRecord("A1", "drift_blocking")).toBe(false);
		expect(isValidBlockedStateRecord("A2", "drift_blocking")).toBe(false);
	});

	it("returns false for non-string inputs", () => {
		expect(isValidBlockedStateRecord(null, "drift_blocking")).toBe(false);
		expect(isValidBlockedStateRecord("A4", 123)).toBe(false);
		expect(isValidBlockedStateRecord(undefined, undefined)).toBe(false);
	});

	it("covers all routable failure classes (SA19)", () => {
		const routableClasses = [
			"admission_incomplete",
			"admission_unjustified",
			"surface_registration_gap",
			"cadence_breach",
			"review_evidence_contradiction",
			"drift_blocking",
		] as const;
		const seenStates = new Set<BlockedResumeState>();
		for (const cls of routableClasses) {
			const state = mapFailureClassToResumeState(cls);
			expect(state).toBeDefined();
			seenStates.add(state!);
		}
		// A1 is reserved for preflight summary blockers and is not routable
		// via failure class mapping
		expect(seenStates.has("A2")).toBe(true);
		expect(seenStates.has("A3")).toBe(true);
		expect(seenStates.has("A4")).toBe(true);
	});
});
