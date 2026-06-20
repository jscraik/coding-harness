import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMAND_SPECS } from "./command-specs.js";
import type { CommandSpec } from "./types.js";

function findSpec(name: string): CommandSpec {
	const spec = COMMAND_SPECS.find((candidate) => candidate.name === name);
	if (!spec) throw new Error(`Spec "${name}" not found`);
	return spec;
}

describe("command spec argument validation", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("rejects pilot rollback without an incident id", () => {
		expect(findSpec("pilot-rollback").execute(["--mode", "manual"])).toBe(2);
	});

	it("rejects diff-budget flags with missing values", () => {
		const spec = findSpec("diff-budget");
		for (const flag of ["--base", "--head", "--contract", "--override"]) {
			expect(spec.execute([flag])).toBe(2);
		}
	});

	it("rejects malformed UI loop mode and timeout values", () => {
		expect(findSpec("ui:verify").execute(["--timeout"])).toBe(2);
		expect(findSpec("ui:verify").execute(["--timeout", "0"])).toBe(2);
		expect(findSpec("ui:verify").execute(["--timeout", "abc"])).toBe(2);
		expect(findSpec("ui:verify").execute(["--mode"])).toBe(2);
		expect(findSpec("ui:verify").execute(["--mode", "invalid"])).toBe(2);
		expect(findSpec("ui:explore").execute(["--mode"])).toBe(2);
		expect(findSpec("ui:explore").execute(["--mode", "invalid"])).toBe(2);
	});

	it("rejects invalid pilot-evaluate enum values", () => {
		const spec = findSpec("pilot-evaluate");
		expect(
			spec.execute(["--artifacts", "artifacts", "--evaluation-mode", "remote"]),
		).toBe(2);
		expect(
			spec.execute(["--artifacts", "artifacts", "--rollout-stage", "instant"]),
		).toBe(2);
	});
});
