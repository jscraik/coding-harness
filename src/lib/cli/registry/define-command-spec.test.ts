import { describe, expect, it } from "vitest";
import { defineCommandSpec } from "./define-command-spec.js";

describe("defineCommandSpec", () => {
	it("builds a simple forwarding command spec", () => {
		const calls: string[][] = [];
		const spec = defineCommandSpec({
			name: "example",
			aliases: ["ex"],
			summary: "Run an example command",
			example: "example --json",
			errorLabel: "Example Error",
			runner: (args) => {
				calls.push(args);
				return 0;
			},
		});

		expect(spec).toMatchObject({
			name: "example",
			aliases: ["ex"],
			summary: "Run an example command",
			example: "example --json",
			errorLabel: "Example Error",
		});
		expect(spec.execute(["--json"])).toBe(0);
		expect(calls).toEqual([["--json"]]);
	});
});
