import { describe, expect, it } from "vitest";
import {
	compareRegistryToReadme,
	extractReadmeCommandNames,
} from "./doc-parity.js";

describe("doc parity", () => {
	it("extracts command names from README command table", () => {
		const names = extractReadmeCommandNames(`| Command | Purpose |
| --- | --- |
| \`init\` | Install harness |
| \`policy-gate\` | Validate policy |`);

		expect(names).toEqual(["init", "policy-gate"]);
	});

	it("compares registry and readme command sets", () => {
		const result = compareRegistryToReadme(
			["init", "policy-gate", "review-gate"],
			["init", "review-gate", "unknown"],
		);

		expect(result).toEqual({
			missingInReadme: ["policy-gate"],
			extraInReadme: ["unknown"],
		});
	});
});
