import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EXIT_CODES, runReplayCLI } from "./replay.js";

function readReplayEventPayload(
	runRecordsDir: string,
): Record<string, unknown> {
	const runDirs = readdirSync(runRecordsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
	expect(runDirs.length).toBe(1);
	const events = readFileSync(
		join(runRecordsDir, runDirs[0] ?? "", "events.jsonl"),
		"utf-8",
	)
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	expect(events.length).toBe(1);
	return events[0].payload;
}

describe("replay command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		while (tempDirs.length > 0) {
			const dir = tempDirs.pop();
			if (dir) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	describe("runReplayCLI", () => {
		it("returns VALIDATION_ERROR when no trace ID provided", async () => {
			const exitCode = await runReplayCLI({});
			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		});

		it("returns VALIDATION_ERROR for invalid trace ID format", async () => {
			const exitCode = await runReplayCLI({ traceId: "invalid-id" });
			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		});

		it("returns TRACE_NOT_FOUND for non-existent trace", async () => {
			const exitCode = await runReplayCLI({
				traceId: "trace-aaaaaaaaaaaaaaaa",
			});
			expect(exitCode).toBe(EXIT_CODES.TRACE_NOT_FOUND);
		});

		it("lists traces with --list", async () => {
			const tempDir = mkdtempSync(join(tmpdir(), "replay-test-"));
			tempDirs.push(tempDir);
			const runRecordsDir = join(tempDir, "agent-runs");
			const exitCode = await runReplayCLI({ list: true, runRecordsDir });
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);

			const runDirs = readdirSync(runRecordsDir, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);
			expect(runDirs.length).toBe(1);
			const manifest = JSON.parse(
				readFileSync(
					join(runRecordsDir, runDirs[0] ?? "", "manifest.json"),
					"utf-8",
				),
			);
			expect(manifest.command).toBe("replay");
		});

		it("writes successful replay attempts without recovery events", async () => {
			const tempDir = mkdtempSync(join(tmpdir(), "replay-test-"));
			tempDirs.push(tempDir);
			const runRecordsDir = join(tempDir, "agent-runs");
			const exitCode = await runReplayCLI({ list: true, runRecordsDir });
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);

			const payload = readReplayEventPayload(runRecordsDir);
			expect(payload.attemptLedger).toMatchObject({
				schemaVersion: "attempt-ledger/v1",
				command: "replay",
				firstFailure: null,
				retryDecision: {
					decision: "none",
					nextAttempt: null,
				},
				owner: "codex",
				stopReason: null,
			});
			expect(payload.recoveryEvent).toBeNull();
		});

		it("writes recovery metadata for missing trace blockers", async () => {
			const tempDir = mkdtempSync(join(tmpdir(), "replay-test-"));
			tempDirs.push(tempDir);
			const runRecordsDir = join(tempDir, "agent-runs");
			const exitCode = await runReplayCLI({
				traceId: "trace-aaaaaaaaaaaaaaaa",
				runRecordsDir,
			});
			expect(exitCode).toBe(EXIT_CODES.TRACE_NOT_FOUND);

			const payload = readReplayEventPayload(runRecordsDir);
			expect(payload.attemptLedger).toMatchObject({
				schemaVersion: "attempt-ledger/v1",
				command: "replay",
				firstFailure: {
					attempt: 1,
					failureClass: "trace_not_found",
					exitCode: EXIT_CODES.TRACE_NOT_FOUND,
				},
				retryDecision: {
					decision: "stop",
					nextAttempt: null,
				},
				owner: "operator",
			});
			expect(payload.recoveryEvent).toMatchObject({
				schemaVersion: "recovery-event/v1",
				command: "replay",
				owner: "operator",
				failureClass: "trace_not_found",
				retryDecision: "stop",
			});
		});

		it("writes recovery metadata for validation errors", async () => {
			const tempDir = mkdtempSync(join(tmpdir(), "replay-test-"));
			tempDirs.push(tempDir);
			const runRecordsDir = join(tempDir, "agent-runs");
			const exitCode = await runReplayCLI({ runRecordsDir });
			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);

			const payload = readReplayEventPayload(runRecordsDir);
			expect(payload.attemptLedger).toMatchObject({
				schemaVersion: "attempt-ledger/v1",
				command: "replay",
				firstFailure: {
					attempt: 1,
					failureClass: "validation_error",
					exitCode: EXIT_CODES.VALIDATION_ERROR,
				},
				owner: "operator",
				retryDecision: {
					decision: "stop",
					nextAttempt: null,
				},
			});
			expect(payload.recoveryEvent).toMatchObject({
				schemaVersion: "recovery-event/v1",
				command: "replay",
				owner: "operator",
				failureClass: "validation_error",
			});
		});

		it("writes recovery metadata for invalid trace directories", async () => {
			const tempDir = mkdtempSync(join(tmpdir(), "replay-test-"));
			tempDirs.push(tempDir);
			const runRecordsDir = join(tempDir, "agent-runs");
			const exitCode = await runReplayCLI({
				traceDir: "../outside",
				runRecordsDir,
			});
			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);

			const payload = readReplayEventPayload(runRecordsDir);
			expect(payload.attemptLedger).toMatchObject({
				schemaVersion: "attempt-ledger/v1",
				command: "replay",
				firstFailure: {
					attempt: 1,
					failureClass: "invalid_trace_directory",
					exitCode: EXIT_CODES.VALIDATION_ERROR,
				},
				owner: "operator",
			});
			expect(payload.recoveryEvent).toMatchObject({
				schemaVersion: "recovery-event/v1",
				command: "replay",
				owner: "operator",
				failureClass: "invalid_trace_directory",
			});
		});

		it("outputs JSON when --json is set", async () => {
			const exitCode = await runReplayCLI({
				traceId: "trace-bbbbbbbbbbbbbbbb",
				json: true,
			});
			expect(exitCode).toBe(EXIT_CODES.TRACE_NOT_FOUND);
		});
	});
});
