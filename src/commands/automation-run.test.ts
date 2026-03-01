import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	EXIT_CODES,
	runAutomationRun,
	runAutomationRunCLI,
} from "./automation-run.js";

function baseOptions(tempDir: string) {
	return {
		name: "pulse",
		repo: "acme/repo",
		headSha: "a".repeat(40),
		contractVersion: "1.2.0",
		inputFingerprint: "fp-123",
		artifactsDir: join(tempDir, "artifacts/automation"),
		statePath: join(tempDir, "artifacts/automation/idempotency-state.json"),
		json: true,
	} as const;
}

describe("automation-run", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		while (tempDirs.length > 0) {
			const dir = tempDirs.pop();
			if (dir) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	it("creates a succeeded run and artifact on first execution", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "automation-run-test-"));
		tempDirs.push(tempDir);
		const options = baseOptions(tempDir);

		const result = runAutomationRun(options);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.status).toBe("succeeded");
			expect(result.output.replayed).toBe(false);
			expect(result.output.artifactUri).toContain("/pulse/");
			const artifact = JSON.parse(
				readFileSync(result.output.artifactUri, "utf-8"),
			);
			expect(artifact.schemaVersion).toBe("automation-report/v1");
		}
	});

	it("replays succeeded run when key repeats without force", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "automation-run-test-"));
		tempDirs.push(tempDir);
		const options = baseOptions(tempDir);

		const first = runAutomationRun(options);
		expect(first.ok).toBe(true);
		const second = runAutomationRun(options);
		expect(second.ok).toBe(true);
		if (first.ok && second.ok) {
			expect(second.output.replayed).toBe(true);
			expect(second.output.attemptId).toBe(first.output.attemptId);
			expect(second.output.artifactUri).toBe(first.output.artifactUri);
		}
	});

	it("rejects force override while existing run is in_progress", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "automation-run-test-"));
		tempDirs.push(tempDir);
		const options = baseOptions(tempDir);
		const key = [
			options.repo,
			options.headSha,
			options.name,
			options.contractVersion,
			options.inputFingerprint,
		].join("|");
		mkdirSync(join(tempDir, "artifacts/automation"), { recursive: true });
		writeFileSync(
			options.statePath,
			JSON.stringify(
				{
					schemaVersion: "automation-idempotency/v1",
					runs: {
						[key]: {
							attemptId: "pulse-existing",
							status: "in_progress",
							artifactUri: "",
							artifactChecksum: "",
							startedAt: new Date().toISOString(),
						},
					},
				},
				null,
				2,
			),
			"utf-8",
		);

		const result = runAutomationRun({
			...options,
			force: true,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.status).toBe("in_progress");
			expect(result.output.reason).toContain("in progress");
		}
		expect(runAutomationRunCLI({ ...options, force: true })).toBe(
			EXIT_CODES.IN_PROGRESS,
		);
	});

	it("creates a new attempt when force=true and prior run is terminal", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "automation-run-test-"));
		tempDirs.push(tempDir);
		const options = baseOptions(tempDir);

		const first = runAutomationRun(options);
		expect(first.ok).toBe(true);
		const forced = runAutomationRun({
			...options,
			force: true,
		});
		expect(forced.ok).toBe(true);
		if (first.ok && forced.ok) {
			expect(forced.output.replayed).toBe(false);
			expect(forced.output.attemptId).not.toBe(first.output.attemptId);
		}
	});

	it("replays failed runs and supports force rerun", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "automation-run-test-"));
		tempDirs.push(tempDir);
		const options = baseOptions(tempDir);

		const failed = runAutomationRun({
			...options,
			simulateFailure: true,
		});
		expect(failed.ok).toBe(true);
		if (failed.ok) {
			expect(failed.output.status).toBe("failed");
		}
		const replayFailed = runAutomationRun(options);
		expect(replayFailed.ok).toBe(true);
		if (replayFailed.ok) {
			expect(replayFailed.output.status).toBe("failed");
			expect(replayFailed.output.replayed).toBe(true);
		}
		const forced = runAutomationRun({ ...options, force: true });
		expect(forced.ok).toBe(true);
		if (forced.ok) {
			expect(forced.output.status).toBe("succeeded");
			expect(forced.output.replayed).toBe(false);
		}
	});
});
