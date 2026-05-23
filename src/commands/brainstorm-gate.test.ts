import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runBrainstormGateCLI } from "./brainstorm-gate.js";

describe("brainstorm-gate command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	function createBrainstorm(
		baseDir: string,
		filename: string,
		date: string,
		withSections = true,
	): void {
		const brainstormsDir = join(baseDir, "docs/brainstorms");
		mkdirSync(brainstormsDir, { recursive: true });
		const sections = withSections
			? [
					"## What We're Building",
					"## Why This Approach",
					"## Key Decisions",
				].join("\n\n")
			: "## What We're Building";
		writeFileSync(
			join(brainstormsDir, filename),
			[
				"---",
				"topic: test topic",
				`date: ${date}`,
				"---",
				"",
				sections,
				"",
			].join("\n"),
			"utf-8",
		);
	}

	function isoDate(offsetDays = 0): string {
		const date = new Date();
		date.setUTCDate(date.getUTCDate() + offsetDays);
		return date.toISOString().slice(0, 10);
	}

	it("returns success for a fresh strict-complete brainstorm", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "brainstorm-gate-pass-"));
		tempDirs.push(tempDir);
		const today = isoDate();
		createBrainstorm(tempDir, `${today}-throughput-brainstorm.md`, today, true);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runBrainstormGateCLI({
			brainstormsPath: join(tempDir, "docs/brainstorms"),
			strict: true,
			maxAgeDays: 30,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("PASSED"));
	});

	it("returns stale exit code when the most recent brainstorm is too old", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "brainstorm-gate-stale-"));
		tempDirs.push(tempDir);
		createBrainstorm(
			tempDir,
			"2020-01-01-old-brainstorm.md",
			"2020-01-01",
			true,
		);
		vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runBrainstormGateCLI({
			brainstormsPath: join(tempDir, "docs/brainstorms"),
			maxAgeDays: 7,
		});

		expect(exitCode).toBe(EXIT_CODES.BRAINSTORM_STALE);
	});

	it("returns missing exit code and JSON payload when no brainstorm docs exist", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "brainstorm-gate-missing-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "docs/brainstorms"), { recursive: true });
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runBrainstormGateCLI({
			brainstormsPath: join(tempDir, "docs/brainstorms"),
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.BRAINSTORM_MISSING);
		expect(infoSpy).toHaveBeenCalledTimes(1);
		const payload = infoSpy.mock.calls[0]?.[0];
		expect(typeof payload).toBe("string");
		expect(payload).toContain('"code": "MISSING"');
	});
});
