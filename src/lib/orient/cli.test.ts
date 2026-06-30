import { afterEach, describe, expect, it, vi } from "vitest";
import type { HarnessOrientNextDecisionProvider } from "./types.js";
import { runOrientCLI } from "./cli.js";

function failingProvider(): ReturnType<
	typeof vi.fn<HarnessOrientNextDecisionProvider>
> {
	return vi.fn<HarnessOrientNextDecisionProvider>(() => {
		throw new Error("orient provider should not run for invalid arguments");
	});
}

function readJsonUsage(infoSpy: ReturnType<typeof vi.spyOn>) {
	return JSON.parse(String(infoSpy.mock.calls[0]?.[0] ?? "{}")) as {
		error?: { code?: string; message?: string };
		schemaVersion?: string;
		status?: string;
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("runOrientCLI argument validation", () => {
	it("rejects unknown flags before collecting orientation context", () => {
		const provider = failingProvider();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitCode = runOrientCLI(["--repo-rot", ".", "--json"], provider);

		expect(exitCode).toBe(2);
		expect(provider).not.toHaveBeenCalled();
		expect(readJsonUsage(infoSpy)).toMatchObject({
			schemaVersion: "harness-orient-error/v1",
			status: "error",
			error: { code: "orient.unknown_flag" },
		});
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("rejects extra positional paths before collecting orientation context", () => {
		const provider = failingProvider();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitCode = runOrientCLI([".", "extra", "--json"], provider);

		expect(exitCode).toBe(2);
		expect(provider).not.toHaveBeenCalled();
		expect(readJsonUsage(infoSpy)).toMatchObject({
			schemaVersion: "harness-orient-error/v1",
			status: "error",
			error: { code: "orient.unexpected_positional" },
		});
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("rejects mixed --repo-root and positional paths", () => {
		const provider = failingProvider();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitCode = runOrientCLI(
			["--repo-root", ".", "extra", "--json"],
			provider,
		);

		expect(exitCode).toBe(2);
		expect(provider).not.toHaveBeenCalled();
		expect(readJsonUsage(infoSpy)).toMatchObject({
			schemaVersion: "harness-orient-error/v1",
			status: "error",
			error: { code: "orient.unexpected_positional" },
		});
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("rejects --repo-root without a following value", () => {
		const provider = failingProvider();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitCode = runOrientCLI(["--repo-root", "--json"], provider);

		expect(exitCode).toBe(2);
		expect(provider).not.toHaveBeenCalled();
		expect(readJsonUsage(infoSpy)).toMatchObject({
			schemaVersion: "harness-orient-error/v1",
			status: "error",
			error: { code: "orient.flag_value_required" },
		});
		expect(errorSpy).not.toHaveBeenCalled();
	});
});
