import { afterEach, describe, expect, it, vi } from "vitest";
import { validateLinearValueFlags } from "./linear-command-options.js";

describe("validateLinearValueFlags", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("rejects missing values before Linear command execution", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(validateLinearValueFlags(["claim", "--issue"])).toBe(2);
		expect(errorSpy.mock.calls.at(-1)?.[0]).toContain(
			"linear --issue requires a value",
		);
	});

	it("rejects invalid numeric flags before Linear command execution", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(validateLinearValueFlags(["triage", "--limit", "zero"])).toBe(2);
		expect(errorSpy.mock.calls.at(-1)?.[0]).toContain(
			"linear --limit must be an integer >= 1",
		);
		expect(
			validateLinearValueFlags(["triage", "--metadata-threshold", "NaN"]),
		).toBe(2);
		expect(errorSpy.mock.calls.at(-1)?.[0]).toContain(
			"linear --metadata-threshold must be a finite number",
		);
		expect(
			validateLinearValueFlags(["triage", "--metadata-threshold", "0.8junk"]),
		).toBe(2);
		expect(errorSpy.mock.calls.at(-1)?.[0]).toContain(
			"linear --metadata-threshold must be a finite number",
		);
	});

	it("accepts valid Linear value flags", () => {
		expect(
			validateLinearValueFlags([
				"triage",
				"--issue",
				"JSC-1",
				"--limit",
				"3",
				"--metadata-threshold",
				"0.8",
			]),
		).toBeUndefined();
	});
});
