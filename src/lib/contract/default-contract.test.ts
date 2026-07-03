import { describe, expect, it } from "vitest";
import { DEFAULT_CONTRACT } from "./types.js";
import { validateContract } from "./validator.js";

describe("DEFAULT_CONTRACT", () => {
	it("stays valid against the contract validator", () => {
		const result = validateContract(DEFAULT_CONTRACT);

		expect(result.success).toBe(true);
	});
});
