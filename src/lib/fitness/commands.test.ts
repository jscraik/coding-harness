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
});
