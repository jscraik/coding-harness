import { describe, expect, it } from "vitest";
import { classifyValidationFailure } from "./failure-classifier.js";

describe("classifyValidationFailure", () => {
	it("classifies clean exit with quiet output as passed", () => {
		expect(
			classifyValidationFailure({ command: "pnpm typecheck", exitCode: 0 }),
		).toMatchObject({
			classification: "passed",
			blocking: false,
			confidence: "high",
		});
	});

	it("classifies explicitly expected fixture output with exit 0", () => {
		const result = classifyValidationFailure({
			command: "pnpm run test:related",
			exitCode: 0,
			stdout:
				'{ "gate": "policy-gate", "status": "fail" }\nTest Files 66 passed',
			expectedFixtureOutput: true,
		});

		expect(result).toMatchObject({
			classification: "expected_fixture_stderr",
			blocking: false,
			confidence: "high",
		});
		expect(result.nextAction).toContain("Record the command as passed");
	});

	it("infers expected fixture output from failure-looking output with exit 0", () => {
		const result = classifyValidationFailure({
			command: "pnpm run test:related",
			exitCode: 0,
			stdout:
				'{ "gate": "policy-gate", "status": "fail" }\nTest Files 66 passed',
		});

		expect(result).toMatchObject({
			classification: "expected_fixture_stderr",
			blocking: false,
			confidence: "medium",
		});
	});

	it("classifies missing required credentials before generic tooling failures", () => {
		const result = classifyValidationFailure({
			command: "pnpm publish",
			exitCode: 1,
			stderr: "Failed to replace env in config: $" + "{NPM_TOKEN}",
			requiredCredentialNames: ["NPM_TOKEN"],
		});

		expect(result).toMatchObject({
			classification: "missing_credential",
			blocking: true,
			confidence: "high",
		});
		expect(result.reasons).toEqual([
			"output referenced required credential NPM_TOKEN",
		]);
	});

	it("treats required credential names as literal output tokens", () => {
		const result = classifyValidationFailure({
			command: "pnpm publish",
			exitCode: 1,
			stderr: "Missing env var CI[1]_TOKEN",
			requiredCredentialNames: ["CI[1]_TOKEN"],
		});

		expect(result).toMatchObject({
			classification: "missing_credential",
			blocking: true,
			confidence: "high",
		});
	});

	it("classifies network and runtime setup errors as environment_tooling_failure", () => {
		expect(
			classifyValidationFailure({
				command: "bash scripts/verify-work.sh --fast",
				exitCode: 1,
				stderr: "fetch failed: ECONNRESET transport error",
			}),
		).toMatchObject({
			classification: "environment_tooling_failure",
			blocking: true,
			confidence: "medium",
		});
	});

	it("classifies failures in unrelated dirty files as unrelated_dirty_worktree", () => {
		const result = classifyValidationFailure({
			command: "pnpm test",
			exitCode: 1,
			stderr: "FAIL src/auth/login.test.ts: expected redirect",
			changedFiles: ["src/lib/validation/failure-classifier.ts"],
			dirtyFiles: [
				{ path: "src/auth/login.test.ts", ownedByCurrentChange: false },
				{
					path: "src/lib/validation/failure-classifier.ts",
					ownedByCurrentChange: true,
				},
			],
		});

		expect(result).toMatchObject({
			classification: "unrelated_dirty_worktree",
			blocking: true,
			confidence: "high",
			evidenceRefs: ["src/auth/login.test.ts"],
		});
	});

	it("classifies explicit baseline failures as pre_existing_drift", () => {
		expect(
			classifyValidationFailure({
				command: "pnpm run drift-gate",
				exitCode: 1,
				stdout: '{ "message": "documented in README", "baseline": true }',
			}),
		).toMatchObject({
			classification: "pre_existing_drift",
			blocking: true,
			confidence: "medium",
		});
	});

	it("honors explicit pre-existing failure evidence with high confidence", () => {
		expect(
			classifyValidationFailure({
				command: "pnpm check",
				exitCode: 1,
				stderr: "FAIL src/lib/validation/failure-classifier.test.ts",
				preExistingFailure: true,
				changedFiles: ["src/lib/validation/failure-classifier.test.ts"],
			}),
		).toMatchObject({
			classification: "pre_existing_drift",
			blocking: true,
			confidence: "high",
		});
	});

	it("classifies failures in changed files as introduced_regression", () => {
		const result = classifyValidationFailure({
			command: "pnpm vitest run src/lib/validation/failure-classifier.test.ts",
			exitCode: 1,
			stderr:
				"FAIL src/lib/validation/failure-classifier.test.ts > expected class",
			changedFiles: [
				"src/lib/validation/failure-classifier.ts",
				"src/lib/validation/failure-classifier.test.ts",
			],
		});

		expect(result).toMatchObject({
			classification: "introduced_regression",
			blocking: true,
			confidence: "high",
			evidenceRefs: ["src/lib/validation/failure-classifier.test.ts"],
		});
	});

	it("uses command target paths as changed-file evidence", () => {
		expect(
			classifyValidationFailure({
				command:
					"pnpm vitest run src/lib/validation/failure-classifier.test.ts",
				exitCode: 1,
				stderr: "AssertionError: expected class",
				changedFiles: ["src/lib/validation/failure-classifier.test.ts"],
			}),
		).toMatchObject({
			classification: "introduced_regression",
			blocking: true,
			confidence: "high",
			evidenceRefs: ["src/lib/validation/failure-classifier.test.ts"],
		});
	});

	it("matches changed files when output includes line and column suffixes", () => {
		expect(
			classifyValidationFailure({
				command: "pnpm typecheck",
				exitCode: 1,
				stderr:
					"src/lib/validation/failure-classifier.ts:120:18 - error TS2345",
				changedFiles: ["src/lib/validation/failure-classifier.ts"],
			}),
		).toMatchObject({
			classification: "introduced_regression",
			blocking: true,
			confidence: "high",
			evidenceRefs: ["src/lib/validation/failure-classifier.ts"],
		});
	});

	it("falls back to unknown_failure when no narrower evidence is available", () => {
		expect(
			classifyValidationFailure({
				command: "pnpm check",
				exitCode: 1,
				stderr: "red",
			}),
		).toMatchObject({
			classification: "unknown_failure",
			blocking: true,
			confidence: "low",
		});
	});
});
