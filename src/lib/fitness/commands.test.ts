import { describe, expect, it } from "vitest";
import {
	FITNESS_COMMANDS,
	isTrustedFitnessCommand,
	trustedFitnessCommand,
} from "./commands.js";

describe("fitness commands", () => {
	it("trusts the advisory autoreview command for fitness routing", () => {
		expect(isTrustedFitnessCommand(FITNESS_COMMANDS.AUTOREVIEW)).toBe(true);
		expect(trustedFitnessCommand(FITNESS_COMMANDS.AUTOREVIEW)).toBe(
			FITNESS_COMMANDS.AUTOREVIEW,
		);
	});

	it("trusts the deterministic program-design and context commands", () => {
		for (const command of [
			FITNESS_COMMANDS.PROGRAM_DESIGN,
			FITNESS_COMMANDS.AGENT_ROUTING,
			FITNESS_COMMANDS.DOCUMENTATION_LIFECYCLE,
			FITNESS_COMMANDS.TEST_CONFIDENCE,
		]) {
			expect(isTrustedFitnessCommand(command)).toBe(true);
			expect(trustedFitnessCommand(command)).toBe(command);
		}
	});
});
