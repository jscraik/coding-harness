import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validatePacketSource } from "./packet-consolidation.js";

const reviewerExample = JSON.parse(
	readFileSync(
		new URL(
			"../../../contracts/examples/reviewer-decision.example.json",
			import.meta.url,
		),
		"utf8",
	),
) as Record<string, unknown>;

/** Mutate evidence references only after proving the canonical fixture boundary. */
function setValidatedReviewerEvidenceRefs(
	packet: Record<string, unknown>,
	evidenceRefs: string[],
): void {
	const validation = validatePacketSource("reviewer-decision/v1", packet);
	if (!validation.valid) {
		throw new TypeError(
			`Invalid reviewer-decision fixture: ${validation.errors.join("; ")}`,
		);
	}
	const receipt = Reflect.get(packet, "coverageReceipt");
	if (
		typeof receipt !== "object" ||
		receipt === null ||
		Array.isArray(receipt)
	) {
		throw new TypeError(
			"Reviewer-decision fixture requires a coverage receipt",
		);
	}
	Reflect.set(receipt, "evidenceRefs", evidenceRefs);
}

describe("reviewer decision coverage boundary", () => {
	it.each([
		["pass", "needs_evidence"],
		["needs_evidence", "accept"],
		["blocked", "defer"],
		["defer", "object"],
	] as const)("rejects incompatible reviewer status %s and decision %s", (status, decision) => {
		const packet = structuredClone(reviewerExample);
		Reflect.set(packet, "status", status);
		Reflect.set(packet, "decision", decision);
		Reflect.set(packet, "outcomes", [decision]);

		const validation = validatePacketSource("reviewer-decision/v1", packet);

		expect(validation).toEqual({
			valid: false,
			errors: expect.arrayContaining([
				expect.stringContaining("decision must be compatible with status"),
			]),
		});
	});

	it.each([
		"accept",
		"accepted_risk",
	] as const)("requires a coverage receipt for a passing reviewer %s decision", (decision) => {
		const packet = structuredClone(reviewerExample);
		Reflect.deleteProperty(packet, "coverageReceipt");
		Reflect.set(packet, "status", "pass");
		Reflect.set(packet, "decision", decision);

		const validation = validatePacketSource("reviewer-decision/v1", packet);

		expect(validation).toEqual({
			valid: false,
			errors: expect.arrayContaining([
				expect.stringContaining(
					"coverageReceipt is required for passing or accepted reviewer decisions",
				),
			]),
		});
	});

	it.each([
		"accept",
		"accepted_risk",
	] as const)("requires evidence references for a passing reviewer %s decision", (decision) => {
		const packet = structuredClone(reviewerExample);
		Reflect.set(packet, "status", "pass");
		Reflect.set(packet, "decision", decision);
		Reflect.set(packet, "outcomes", [decision]);
		setValidatedReviewerEvidenceRefs(packet, []);

		const validation = validatePacketSource("reviewer-decision/v1", packet);

		expect(validation).toEqual({
			valid: false,
			errors: expect.arrayContaining([
				expect.stringContaining(
					"coverageReceipt.evidenceRefs must be a non-empty array",
				),
			]),
		});
	});
});
