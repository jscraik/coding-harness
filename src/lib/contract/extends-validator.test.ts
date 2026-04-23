import { describe, expect, it } from "vitest";
import { isValidExtendsFieldShape } from "./extends-validator.js";

describe("isValidExtendsFieldShape", () => {
	it.each([
		"typescript-base",
		{
			source: "preset://core",
		},
		{
			source: "preset://core",
			arrays: "append",
			integrity: "sha256-abc123",
		},
		[
			"typescript-base",
			{
				source: "preset://core",
				arrays: "replace",
			},
		],
	])("accepts valid extends value: %j", (value) => {
		expect(isValidExtendsFieldShape(value)).toBe(true);
	});

	it.each([
		"",
		[],
		{ source: "" },
		{ source: "preset://core", arrays: "merge" },
		{ source: "preset://core", integrity: "sha1-deadbeef" },
		{ source: "preset://core", extra: "nope" },
		[{ source: "preset://core" }, { source: "", arrays: "append" }],
		[{ source: "preset://core", integrity: "deadbeef" }],
		{ __proto__: { polluted: true } },
	])("rejects invalid extends value: %j", (value) => {
		expect(isValidExtendsFieldShape(value)).toBe(false);
	});
});
