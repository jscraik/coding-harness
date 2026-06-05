import { describe, expect, it } from "vitest";
import { DESTRUCTIVE_ARCHIVE_CANDIDATE_OPTIONS } from "./archive-candidates-contract.js";
import { runDocsArchiveCandidatesCli } from "./archive-candidates-cli.js";

describe("runDocsArchiveCandidatesCli", () => {
	it("rejects every destructive option with usage exit code 2", () => {
		for (const option of DESTRUCTIVE_ARCHIVE_CANDIDATE_OPTIONS) {
			const output = createStreams();
			const exitCode = runDocsArchiveCandidatesCli(
				["--", option, "--json"],
				output.streams,
				process.cwd(),
			);

			expect(exitCode, option).toBe(2);
			expect(output.stdout, option).toContain(
				'"code": "destructive_option_unsupported"',
			);
			expect(output.stdout, option).toContain(`"option": "${option}"`);
		}
	});

	it("prints help without running the scanner", () => {
		const output = createStreams();
		const exitCode = runDocsArchiveCandidatesCli(
			["--help"],
			output.streams,
			"/does/not/matter",
		);

		expect(exitCode).toBe(0);
		expect(output.stdout).toContain("Usage: pnpm docs:archive-candidates");
		expect(output.stderr).toBe("");
	});
});

function createStreams(): {
	stdout: string;
	stderr: string;
	streams: {
		stdout: { write(content: string): void };
		stderr: { write(content: string): void };
	};
} {
	const output = { stdout: "", stderr: "" };
	return {
		streams: {
			stdout: {
				write(content: string): void {
					output.stdout += content;
				},
			},
			stderr: {
				write(content: string): void {
					output.stderr += content;
				},
			},
		},
		get stdout(): string {
			return output.stdout;
		},
		get stderr(): string {
			return output.stderr;
		},
	};
}
