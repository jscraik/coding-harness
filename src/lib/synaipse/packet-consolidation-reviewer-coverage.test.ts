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

describe("reviewer decision coverage boundary", () => {
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
});
