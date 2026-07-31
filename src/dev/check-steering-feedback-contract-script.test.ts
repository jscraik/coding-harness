import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const requireScript = createRequire(import.meta.url);

const { validateAgents, validateAgentGovernance } = requireScript(
	"../../scripts/check-steering-feedback-contract.cjs",
) as {
	validateAgents(content: string): string[];
	validateAgentGovernance(content: string): string[];
};

describe("check-steering-feedback-contract", () => {
	it("accepts a bounded local-correction threshold in agent instructions", () => {
		const content = [
			"Treat feedback as an observed local defect first.",
			"Add a durable control only when the existing contract is contradictory,",
			"a safety boundary is crossed, or the same failure recurs across independent work.",
		].join("\n");

		expect(validateAgents(content)).toEqual([]);
	});

	it("rejects instructions that promote a durable control without a threshold", () => {
		expect(
			validateAgents(
				"Treat feedback as an observed local defect first. Add a durable control.",
			),
		).toContain("AGENTS.md: missing durable-control threshold");
	});

	it("accepts the equivalent bounded rule in governance guidance", () => {
		const content = [
			"Finish the bounded local repair first.",
			"Promote a small durable control only when the same failure recurs across independent work,",
			"an existing contract conflicts, or a safety boundary requires enforcement.",
		].join("\n");

		expect(validateAgentGovernance(content)).toEqual([]);
	});
});
