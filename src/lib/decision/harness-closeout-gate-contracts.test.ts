import { describe, expect, it } from "vitest";
import {
	HARNESS_CLOSEOUT_GATE_CONTRACTS,
	HARNESS_CLOSEOUT_GATE_IDS,
	createMissingGateResult,
	type HarnessCloseoutGateId,
} from "./he-phase-exit.js";

describe("coding-harness closeout gate contracts", () => {
	it("keeps every closeout gate tied to a source contract and payload fields", () => {
		expect(Object.keys(HARNESS_CLOSEOUT_GATE_CONTRACTS).sort()).toEqual(
			[...HARNESS_CLOSEOUT_GATE_IDS].sort(),
		);

		for (const gateId of HARNESS_CLOSEOUT_GATE_IDS) {
			const contract = HARNESS_CLOSEOUT_GATE_CONTRACTS[gateId];
			const missingPayload = createMissingGateResult(gateId, true).payload;

			expect(contract).toMatchObject({
				gateId,
				source: expect.stringMatching(/^[$@]/),
				sourceRef: expect.any(String),
				closeoutPurpose: expect.any(String),
			});
			expect(contract.sourceRef.trim()).not.toHaveLength(0);
			expect(contract.closeoutPurpose.trim()).not.toHaveLength(0);

			for (const field of contract.payloadFields) {
				expect(
					Object.hasOwn(missingPayload, field),
					`${gateId} contract field ${field} must exist on missing payload`,
				).toBe(true);
			}
		}
	});

	it("marks glossary review as conditional instead of mandatory ceremony", () => {
		const contract =
			HARNESS_CLOSEOUT_GATE_CONTRACTS[
				"ubiquitous_language" satisfies HarnessCloseoutGateId
			];

		expect(contract).toMatchObject({
			applicability: "conditional",
			source: "$ubiquitous-language",
			sourceRef: "agent-skills/Skills/agent-ops/ubiquitous-language/SKILL.md",
		});
	});
});
