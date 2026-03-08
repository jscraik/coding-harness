import {
	existsSync,
	mkdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";

import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	EXIT_CODES,
	runPilotRollback,
	runPilotRollbackCLI,
} from "./pilot-rollback.js";

describe("pilot-rollback", () => {
	const testDir = join(process.cwd(), "artifacts/test/pilot-rollback");
	const contractPath = join(testDir, "harness.contract.json");

	beforeEach(() => {
		// Create test directory and contract
		rmSync(testDir, { recursive: true, force: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	function createContract(policy?: { mode?: "autonomous" | "manual" }): string {
		const contract = {
			version: "1.0",
			pilotRollbackPolicy: {
				autoTrigger: true,
				requireManualRelease: true,
				completionMarkerPath: ".harness/rollback-marker.json",
				mode: policy?.mode ?? "manual",
			},
		};
		mkdirSync(dirname(contractPath), { recursive: true });
		writeFileSync(contractPath, JSON.stringify(contract), "utf-8");
		return contractPath;
	}

	describe("runPilotRollback", () => {
		it("returns VALIDATION error when incidentId is missing", async () => {
			const result = await runPilotRollback({
				incidentId: "",
				mode: "manual",
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("--incident-id");
			}
		});

		it("returns VALIDATION error when mode is invalid", async () => {
			const result = await runPilotRollback({
				incidentId: "incident-123",
				mode: "invalid" as "manual",
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("Invalid mode");
			}
		});

		it("returns PRECONDITION error when contract not found", async () => {
			const result = await runPilotRollback({
				incidentId: "incident-123",
				mode: "manual",
				contractPath: "/nonexistent/contract.json",
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_PRECONDITION");
				expect(result.error.message).toContain("Contract not found");
			}
		});

		it("transitions from manual to autonomous and creates artifacts", async () => {
			createContract({ mode: "manual" });

			const result = await runPilotRollback({
				incidentId: "incident-123",
				mode: "autonomous",
				contractPath,
				artifactsDir: join(testDir, "artifacts/pilot"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.incidentId).toBe("incident-123");
				expect(result.output.modeBefore).toBe("manual");
				expect(result.output.modeAfter).toBe("autonomous");
				expect(result.output.result).toBe("success");
				expect(result.output.rollbackEventsId).toMatch(/^rollback-/);
			}
		});

		it("transitions from autonomous to manual", async () => {
			createContract({ mode: "autonomous" });

			const result = await runPilotRollback({
				incidentId: "incident-456",
				mode: "manual",
				contractPath,
				artifactsDir: join(testDir, "artifacts/pilot"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.modeBefore).toBe("autonomous");
				expect(result.output.modeAfter).toBe("manual");
			}
		});

		it("creates rollback-marker.json artifact", async () => {
			createContract({ mode: "autonomous" });
			const artifactsDir = join(testDir, "artifacts/pilot");

			await runPilotRollback({
				incidentId: "incident-789",
				mode: "manual",
				contractPath,
				artifactsDir,
			});

			const markerPath = join(artifactsDir, "rollback-marker.json");
			expect(existsSync(markerPath)).toBe(true);

			const marker = JSON.parse(
				require("node:fs").readFileSync(markerPath, "utf-8"),
			);
			expect(marker.schemaVersion).toBe("pilot-rollback-marker/v1");
			expect(marker.incidentId).toBe("incident-789");
			expect(marker.modeBefore).toBe("autonomous");
			expect(marker.modeAfter).toBe("manual");
			expect(marker.result).toBe("success");
		});

		it("appends to rollback-events.jsonl", async () => {
			createContract({ mode: "autonomous" });
			const artifactsDir = join(testDir, "artifacts/pilot");

			await runPilotRollback({
				incidentId: "incident-abc",
				mode: "manual",
				contractPath,
				artifactsDir,
			});

			const eventsPath = join(artifactsDir, "rollback-events.jsonl");
			expect(existsSync(eventsPath)).toBe(true);

			const content = require("node:fs").readFileSync(eventsPath, "utf-8");
			const lines = content.trim().split("\n");
			expect(lines.length).toBe(1);

			const event = JSON.parse(lines[0] ?? "");
			expect(event.incidentId).toBe("incident-abc");
			expect(event.modeTransition).toEqual({
				from: "autonomous",
				to: "manual",
			});
			expect(event.triggeredBy).toBe("manual");
		});

		// Regression: existing log entries must be preserved (not overwritten) when appending
		it("preserves existing rollback-events entries when appending", async () => {
			createContract({ mode: "autonomous" });
			const artifactsDir = join(testDir, "artifacts/pilot");
			const eventsPath = join(artifactsDir, "rollback-events.jsonl");
			mkdirSync(dirname(eventsPath), { recursive: true });
			writeFileSync(eventsPath, '{"id":"existing"}\n', "utf-8");

			await runPilotRollback({
				incidentId: "incident-existing",
				mode: "manual",
				contractPath,
				artifactsDir,
			});

			const content = require("node:fs").readFileSync(eventsPath, "utf-8");
			const lines = content.trim().split("\n");
			expect(lines.length).toBe(2);
			expect(JSON.parse(lines[0] ?? "")).toEqual({ id: "existing" });

			const appended = JSON.parse(lines[1] ?? "");
			expect(appended.incidentId).toBe("incident-existing");
			expect(appended.modeTransition).toEqual({
				from: "autonomous",
				to: "manual",
			});
		});

		it("writes to output file when specified", async () => {
			createContract({ mode: "manual" });
			const outputPath = join(testDir, "output/result.json");

			const result = await runPilotRollback({
				incidentId: "incident-output",
				mode: "autonomous",
				contractPath,
				artifactsDir: join(testDir, "artifacts/pilot"),
				outputPath,
			});

			expect(result.ok).toBe(true);
			expect(existsSync(outputPath)).toBe(true);

			const output = JSON.parse(
				require("node:fs").readFileSync(outputPath, "utf-8"),
			);
			expect(output.incidentId).toBe("incident-output");
		});

		// Security: --output path must not escape cwd
		it("returns error when output path traverses outside cwd", async () => {
			createContract({ mode: "manual" });

			const result = await runPilotRollback({
				incidentId: "incident-output-traversal",
				mode: "autonomous",
				contractPath,
				artifactsDir: join(testDir, "artifacts/pilot"),
				outputPath: "../outside.json",
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Path traversal");
			}
		});

		// Security: default artifacts path (no --artifacts flag) must still be validated
		it("returns error when default artifacts dir is a symlink outside cwd", async () => {
			const { mkdtempSync } = require("node:fs");
			const { tmpdir } = require("node:os");
			const originalCwd = process.cwd();
			const sandboxDir = mkdtempSync(join(tmpdir(), "pilot-rollback-"));
			const outsideDir = mkdtempSync(join(tmpdir(), "pilot-rollback-outside-"));

			try {
				process.chdir(sandboxDir);
				writeFileSync(
					join(sandboxDir, "harness.contract.json"),
					JSON.stringify({
						version: "1.0",
						pilotRollbackPolicy: {
							autoTrigger: true,
							requireManualRelease: true,
							completionMarkerPath: ".harness/rollback-marker.json",
							mode: "manual",
						},
					}),
					"utf-8",
				);
				// Place a symlink at the default artifacts/ location pointing outside sandbox
				symlinkSync(outsideDir, join(sandboxDir, "artifacts"), "dir");

				const result = await runPilotRollback({
					incidentId: "incident-default-artifacts-symlink",
					mode: "autonomous",
				});

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.message).toContain("Path traversal");
				}
			} finally {
				process.chdir(originalCwd);
				rmSync(sandboxDir, { recursive: true, force: true });
				rmSync(outsideDir, { recursive: true, force: true });
			}
		});

		// Security: symlinked artifacts directory must be rejected
		it("rejects artifacts dir that resolves through a symlink outside cwd", async () => {
			createContract({ mode: "autonomous" });
			const outsideDir = "/tmp/coding-harness-test-outside-dir";
			const linkedDir = join(testDir, "artifacts-link");
			mkdirSync(outsideDir, { recursive: true });
			mkdirSync(dirname(linkedDir), { recursive: true });
			symlinkSync(outsideDir, linkedDir, "dir");

			try {
				const result = await runPilotRollback({
					incidentId: "incident-dir-symlink",
					mode: "manual",
					contractPath,
					artifactsDir: linkedDir,
				});

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.message).toContain("Path traversal");
				}
			} finally {
				rmSync(outsideDir, { recursive: true, force: true });
			}
		});

		// Security: symlinked rollback output files must be rejected
		it("rejects rollback event/marker files when they are symlinked outside cwd", async () => {
			createContract({ mode: "autonomous" });
			const artifactsDir = join(testDir, "artifacts/pilot");
			mkdirSync(artifactsDir, { recursive: true });

			const outsideEvents = "/tmp/coding-harness-test-outside-events.jsonl";
			const outsideMarker = "/tmp/coding-harness-test-outside-marker.json";
			writeFileSync(outsideEvents, "", "utf-8");
			writeFileSync(outsideMarker, "", "utf-8");
			symlinkSync(outsideEvents, join(artifactsDir, "rollback-events.jsonl"));
			symlinkSync(outsideMarker, join(artifactsDir, "rollback-marker.json"));

			try {
				const result = await runPilotRollback({
					incidentId: "incident-file-symlink",
					mode: "manual",
					contractPath,
					artifactsDir,
				});

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.message).toContain("Path traversal");
				}
				// Confirm the outside files were NOT written to
				expect(require("node:fs").readFileSync(outsideEvents, "utf-8")).toBe(
					"",
				);
				expect(require("node:fs").readFileSync(outsideMarker, "utf-8")).toBe(
					"",
				);
			} finally {
				rmSync(outsideEvents, { force: true });
				rmSync(outsideMarker, { force: true });
			}
		});

		it("defaults to manual mode when contract lacks policy", async () => {
			// Create contract without pilotRollbackPolicy
			mkdirSync(dirname(contractPath), { recursive: true });
			writeFileSync(contractPath, JSON.stringify({ version: "1.0" }), "utf-8");

			const result = await runPilotRollback({
				incidentId: "incident-default",
				mode: "autonomous",
				contractPath,
				artifactsDir: join(testDir, "artifacts/pilot"),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.modeBefore).toBe("manual");
			}
		});
	});

	describe("runPilotRollbackCLI", () => {
		it("returns SUCCESS exit code on successful rollback", async () => {
			createContract({ mode: "autonomous" });

			const exitCode = await runPilotRollbackCLI({
				incidentId: "incident-cli",
				mode: "manual",
				contractPath,
				artifactsDir: join(testDir, "artifacts/pilot"),
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		});

		it("returns VALIDATION exit code for missing incident ID", async () => {
			const exitCode = await runPilotRollbackCLI({
				incidentId: "",
				mode: "manual",
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.VALIDATION);
		});

		it("returns PRECONDITION exit code for missing contract", async () => {
			const exitCode = await runPilotRollbackCLI({
				incidentId: "incident-missing",
				mode: "manual",
				contractPath: "/nonexistent/contract.json",
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.PRECONDITION);
		});
	});

	describe("exit codes", () => {
		it("defines expected exit codes", () => {
			expect(EXIT_CODES.SUCCESS).toBe(0);
			expect(EXIT_CODES.VALIDATION).toBe(1);
			expect(EXIT_CODES.PRECONDITION).toBe(2);
			expect(EXIT_CODES.INTERNAL).toBe(10);
		});
	});
});
