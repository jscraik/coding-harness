import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runNorthStarFeedbackCLI } from "./north-star-feedback.js";

describe("runNorthStarFeedbackCLI", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("emits JSON metrics and writes an output artifact", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-command-"));
		cleanup.push(dir);
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		const source = join(dir, ".harness/learnings/coderabbit.local.json");
		const output = join(dir, ".harness/metrics/north-star-feedback.json");
		writeFileSync(
			source,
			JSON.stringify({
				schemaVersion: "harness-learnings/v1",
				provider: "coderabbit-csv",
				repository: "coding-harness",
				source: {
					kind: "coderabbit_csv",
					uri: "file:///tmp/learnings.csv",
					live: false,
				},
				inputFingerprint: "abc123",
				items: [
					{
						id: "coderabbit.coding-harness.validation",
						provider: "coderabbit",
						source: {
							kind: "coderabbit_csv",
							uri: "file:///tmp/learnings.csv",
							row: 2,
							live: false,
						},
						repository: "coding-harness",
						usage: 47,
						learning: "Use pnpm test:ci.",
						classification: "validation_contract",
						enforcement: "warning",
						promotionStatus: "candidate",
					},
				],
				warnings: [],
				summary: {
					totalRows: 1,
					imported: 1,
					skipped: 0,
					invalid: 0,
					warnings: 0,
					byClassification: { validation_contract: 1 },
					byEnforcement: { warning: 1 },
				},
			}),
		);
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runNorthStarFeedbackCLI([
			"--source",
			source,
			"--enforcement-status",
			join(dir, ".harness/learnings/enforcement-status.missing.json"),
			"--review-thread-count",
			"2",
			"--validation-reruns",
			"1",
			"--output",
			output,
			"--json",
		]);

		expect(exitCode).toBe(0);
		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.schemaVersion).toBe("north-star-feedback/v1");
		expect(result.metrics).toMatchObject({
			promotionCandidates: 1,
			highUsageLearningsUnenforced: 1,
			reviewThreadCount: 2,
			validationReruns: 1,
		});
		expect(JSON.parse(readFileSync(output, "utf-8")).schemaVersion).toBe(
			"north-star-feedback/v1",
		);
	});

	it("returns usage for invalid numeric options", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runNorthStarFeedbackCLI(["--min-usage", "nope", "--json"]);

		expect(exitCode).toBe(2);
		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("north_star_feedback.invalid_number");
	});

	it("returns usage for empty optional string option values", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runNorthStarFeedbackCLI(["--source", "", "--json"]);

		expect(exitCode).toBe(2);
		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("north_star_feedback.invalid_number");
		expect(result.error.message).toContain("--source");
	});

	it("returns usage when optional string flags are followed by another flag", () => {
		const infoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runNorthStarFeedbackCLI(["--source", "--json"]);

		expect(exitCode).toBe(2);
		const result = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(result.error.code).toBe("north_star_feedback.invalid_number");
		expect(result.error.message).toContain("--source");
	});
});
