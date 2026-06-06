import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
	formatGitHubCliFailure,
	formatGitHubCliVerificationCommand,
	resolveGitHubCli,
} from "../lib/github/cli.js";

vi.mock("node:child_process", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:child_process")>();
	return { ...original, spawnSync: vi.fn(original.spawnSync) };
});

const mockSpawnSync = vi.mocked(spawnSync);

describe("GitHub CLI resolver", () => {
	it("prefers HARNESS_GH_BIN before GH_BIN and defaults to PATH gh", () => {
		expect(
			resolveGitHubCli({ HARNESS_GH_BIN: "/a/gh", GH_BIN: "/b/gh" }),
		).toEqual({ command: "/a/gh", source: "HARNESS_GH_BIN" });
		expect(resolveGitHubCli({ GH_BIN: "/b/gh" })).toEqual({
			command: "/b/gh",
			source: "GH_BIN",
		});
		expect(resolveGitHubCli({})).toEqual({ command: "gh", source: "PATH" });
	});

	it("formats silent mise failures with override guidance", () => {
		mockSpawnSync.mockReturnValueOnce({
			status: 0,
			stdout: "/Users/jamie/.local/share/mise/shims/gh\n",
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		} as ReturnType<typeof spawnSync>);
		const diagnostic = formatGitHubCliFailure(
			{ status: -1, stdout: "", stderr: "" },
			["--version"],
			{ command: "gh", source: "PATH" },
		);

		expect(diagnostic).toContain("github_cli_failed_silently");
		expect(diagnostic).toContain("source=PATH");
		expect(diagnostic).toContain(
			"resolved_path=/Users/jamie/.local/share/mise/shims/gh",
		);
		expect(diagnostic).toContain("mise_path=true");
		expect(diagnostic).toContain("HARNESS_GH_BIN or GH_BIN");
		expect(diagnostic).toContain("verify=gh --version");
	});

	it("quotes verification commands for override paths with spaces", () => {
		expect(
			formatGitHubCliVerificationCommand({
				command: "/Applications/GitHub CLI/gh",
				source: "GH_BIN",
			}),
		).toBe("'/Applications/GitHub CLI/gh' --version");
	});
});
