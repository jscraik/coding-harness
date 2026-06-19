import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { validateHarnessDecision } from "../lib/decision/harness-decision.js";
import type { runHarnessNext } from "./next-runner.js";
import { runNextCLI } from "./next.js";

function captureNextCLI(
	args: string[],
	options: Parameters<typeof runNextCLI>[1],
): { exitCode: number; output: string } {
	const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
	const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		const exitCode = runNextCLI(args, options);
		const output = String(infoSpy.mock.calls.at(-1)?.[0] ?? "");
		expect(errorSpy).not.toHaveBeenCalled();
		return { exitCode, output };
	} finally {
		infoSpy.mockRestore();
		errorSpy.mockRestore();
	}
}

function parseDecision(output: string): ReturnType<typeof runHarnessNext> {
	const parsed = JSON.parse(output) as ReturnType<typeof runHarnessNext>;
	expect(validateHarnessDecision(parsed)).toEqual({ valid: true, errors: [] });
	return parsed;
}

function qualitySizeFitnessFinding() {
	return {
		id: "quality-size:src/commands/fitness.ts",
		title: "Code size or complexity budget exceeded",
		severity: "error",
		lane: "quality-budget",
		principle: "reduce_cognitive_load",
		enforcement: "quality_budget",
		evidence: {
			file: "src/commands/fitness.ts",
			line: 1,
			message: "file has 410 lines; max is 400",
		},
		risk: "Oversized command logic makes agent repair harder.",
		recommendedCommand: "pnpm run quality:size",
		claimBoundary: "Quality size evidence only.",
	};
}

describe("harness next fitness report evidence", () => {
	it("routes the top deterministic fitness finding as the next action", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "harness-next-fitness-"));
		try {
			const finding = qualitySizeFitnessFinding();
			writeFileSync(
				join(repoRoot, "fitness.json"),
				JSON.stringify({
					schemaVersion: "harness-fitness/v1",
					status: "fail",
					generatedAt: "2026-06-19T12:00:00.000Z",
					summary: {
						lanes: 1,
						findings: 1,
						failures: 1,
						warnings: 0,
						lanesNeedingEvidence: 0,
					},
					lanes: [
						{
							id: "quality-budget",
							label: "Quality budget",
							command: "pnpm run quality:size",
							principle: "reduce_cognitive_load",
							enforcement: "quality_budget",
							status: "fail",
							evidenceSource: "artifacts/quality-size.json",
							findings: [finding],
						},
					],
					topDeterministicFinding: finding,
					claimBoundaries: [
						"Fitness reports normalize local gate evidence only.",
					],
				}),
			);

			const { exitCode, output } = captureNextCLI(
				["--json", "--fitness-report", "fitness.json"],
				{
					repoRoot,
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(1);
			const decision = parseDecision(output);
			expect(decision.status).toBe("blocked");
			expect(decision.failureClass).toBe("fitness_deterministic_finding");
			expect(decision.nextCommand).toBe("pnpm run quality:size");
			expect(decision.evidenceRef).toEqual(["artifact:fitness.json"]);
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});
});
