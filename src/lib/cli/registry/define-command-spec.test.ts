import { describe, expect, it } from "vitest";
import { defineCommandSpec } from "./define-command-spec.js";

describe("defineCommandSpec", () => {
	it("keeps public command metadata with the forwarding runner", async () => {
		const spec = defineCommandSpec({
			name: "sample",
			aliases: ["s"],
			summary: "Run sample command",
			example: "sample --json",
			errorLabel: "Sample Error",
			execute: (args) => args.length,
		});

		expect(spec).toMatchObject({
			name: "sample",
			aliases: ["s"],
			summary: "Run sample command",
			example: "sample --json",
			errorLabel: "Sample Error",
		});
		expect(await spec.execute(["--json"])).toBe(1);
	});
});
