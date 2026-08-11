import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const requireScript = createRequire(import.meta.url);

const { validateAgents, validateAgentGovernance, validateValidationDoc } =
	requireScript("../../scripts/check-steering-feedback-contract.cjs") as {
		validateAgents(content: string): string[];
		validateAgentGovernance(content: string): string[];
		validateValidationDoc(content: string): string[];
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

	it("does not treat legacy judgment or failure-mode wording as a threshold", () => {
		const content = [
			"Finish the bounded local repair first.",
			"If the same judgment is needed twice or a failure mode can recur, promote a durable control.",
		].join("\n");

		expect(validateAgentGovernance(content)).toContain(
			"docs/agents/07b-agent-governance.md: missing durable-control threshold",
		);
	});

	it("rejects the retired systemic-until-proven-isolated wording", () => {
		const content = [
			"Finish the bounded local repair first.",
			"Specific implementation-detail feedback is systemic until proven isolated.",
		].join("\n");

		expect(validateAgentGovernance(content)).toContain(
			"docs/agents/07b-agent-governance.md: missing durable-control threshold",
		);
	});

	it("accepts the equivalent bounded rule in governance guidance", () => {
		const content = [
			"Finish the bounded local repair first.",
			"Promote a small durable control only when the same failure recurs across independent work,",
			"an existing contract conflicts, or a safety boundary requires enforcement.",
		].join("\n");

		expect(validateAgentGovernance(content)).toEqual([]);
	});

	it("accepts compact validation guidance at the retained boundaries", () => {
		const content = [
			"Use the smallest gate needed for risk and keep required gates fail-closed.",
			"Keep local tests, hosted checks, review, merge, and release separate.",
			"Run pr-readiness.py --phase create before hosted mutation.",
			"Run pr-readiness.py --phase update before hosted mutation.",
			"Use GraphQL reviewThreads with isResolved and isOutdated.",
			"Use run-auth-backed.sh --env-file ~/.codex/.env --canary TOKEN.",
			"Use run-auth-backed.sh --env-file ~/.codex/.env --require-env TOKEN -- child.",
			"Never read the FIFO and never source the FIFO.",
			"Treat feedback as an observed local defect first.",
			"Add a durable control only when an existing contract conflicts, a safety boundary is crossed, or the same failure recurs across independent work.",
			"Command: <exact command> -> pass|fail|blocked",
		].join("\n");

		expect(validateValidationDoc(content)).toEqual([]);
	});

	it.each([
		["fail-closed", "fail-closed validation rule"],
		["isOutdated", "GraphQL review-thread truth"],
		["Never read the FIFO and ", "FIFO read privacy boundary"],
		["never source the FIFO", "FIFO source privacy boundary"],
		["a safety boundary is crossed", "safety-boundary threshold"],
	])("rejects compact guidance missing %s", (removed, expected) => {
		const content = [
			"Use the smallest gate needed for risk and keep required gates fail-closed.",
			"Keep local tests, hosted checks, review, merge, and release separate.",
			"Run pr-readiness.py --phase create before hosted mutation.",
			"Run pr-readiness.py --phase update before hosted mutation.",
			"Use GraphQL reviewThreads with isResolved and isOutdated.",
			"Use run-auth-backed.sh --env-file ~/.codex/.env --canary TOKEN.",
			"Use run-auth-backed.sh --env-file ~/.codex/.env --require-env TOKEN -- child.",
			"Never read the FIFO and never source the FIFO.",
			"Treat feedback as an observed local defect first.",
			"Add a durable control only when an existing contract conflicts, a safety boundary is crossed, or the same failure recurs across independent work.",
			"Command: <exact command> -> pass|fail|blocked",
		]
			.join("\n")
			.replace(removed, "");

		expect(validateValidationDoc(content)).toContain(
			`docs/agents/04-validation.md: missing ${expected}`,
		);
	});

	it("rejects the non-executable PR readiness phase placeholder", () => {
		const content = [
			"Run pr-readiness.py --phase create|update before hosted mutation.",
			"Never read the FIFO and never source the FIFO.",
		].join("\n");

		expect(validateValidationDoc(content)).toContain(
			"docs/agents/04-validation.md: missing PR readiness route",
		);
	});
});
