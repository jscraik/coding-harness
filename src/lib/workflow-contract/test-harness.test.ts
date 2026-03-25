import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	type GitFixture,
	type ModuleTestManifest,
	WORKFLOW_CONTRACT_MANIFESTS,
	assertGateFails,
	assertGatePasses,
	createGitFixture,
	createGreenEvidence,
	createRedEvidence,
	runGateAssertions,
	validateModuleTestManifest,
	validateTDDEvidencePair,
} from "./test-harness.js";

// ─── createGitFixture ───────────────────────────────────────────────────────────

describe("createGitFixture", () => {
	const fixtures: GitFixture[] = [];
	afterEach(() => {
		for (const f of fixtures) {
			f.cleanup();
		}
		fixtures.length = 0;
	});

	it("creates a temp directory with a git repo", () => {
		const fixture = createGitFixture();
		fixtures.push(fixture);

		expect(existsSync(fixture.dir)).toBe(true);
		expect(existsSync(join(fixture.dir, ".git"))).toBe(true);
	});

	it("has a valid initial SHA", () => {
		const fixture = createGitFixture();
		fixtures.push(fixture);

		expect(fixture.initialSha).toMatch(/^[0-9a-f]{40}$/);
	});

	it("creates initial files", () => {
		const fixture = createGitFixture({
			files: {
				"README.md": "# Test Project",
				"src/index.ts": "export const x = 1;",
			},
		});
		fixtures.push(fixture);

		expect(readFileSync(join(fixture.dir, "README.md"), "utf-8")).toBe(
			"# Test Project",
		);
		expect(readFileSync(join(fixture.dir, "src/index.ts"), "utf-8")).toBe(
			"export const x = 1;",
		);
	});

	it("commitFiles adds files and returns new SHA", () => {
		const fixture = createGitFixture();
		fixtures.push(fixture);

		const newSha = fixture.commitFiles(
			{ "new-file.txt": "hello" },
			"add new file",
		);

		expect(newSha).toMatch(/^[0-9a-f]{40}$/);
		expect(newSha).not.toBe(fixture.initialSha);
		expect(readFileSync(join(fixture.dir, "new-file.txt"), "utf-8")).toBe(
			"hello",
		);
	});

	it("multiple commits create distinct SHAs", () => {
		const fixture = createGitFixture();
		fixtures.push(fixture);

		const sha1 = fixture.commitFiles({ "a.txt": "a" }, "commit 1");
		const sha2 = fixture.commitFiles({ "b.txt": "b" }, "commit 2");

		expect(sha1).not.toBe(sha2);
		expect(sha1).not.toBe(fixture.initialSha);
	});

	it("git() runs arbitrary git commands", () => {
		const fixture = createGitFixture();
		fixtures.push(fixture);

		const result = fixture.git(["log", "--oneline"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("initial commit");
	});

	it("cleanup removes the temp directory", () => {
		const fixture = createGitFixture();
		const dir = fixture.dir;
		expect(existsSync(dir)).toBe(true);

		fixture.cleanup();
		expect(existsSync(dir)).toBe(false);
		// Don't push to fixtures since we already cleaned up
	});

	it("supports custom git user", () => {
		const fixture = createGitFixture({
			userName: "Custom User",
			userEmail: "custom@example.com",
		});
		fixtures.push(fixture);

		const result = fixture.git(["log", "--format=%an <%ae>"]);
		expect(result.stdout).toContain("Custom User <custom@example.com>");
	});

	it("creates nested directories in initial files", () => {
		const fixture = createGitFixture({
			files: {
				"a/b/c/deep.txt": "deep content",
			},
		});
		fixtures.push(fixture);

		expect(readFileSync(join(fixture.dir, "a/b/c/deep.txt"), "utf-8")).toBe(
			"deep content",
		);
	});
});

// ─── assertGatePasses / assertGateFails ─────────────────────────────────────────

describe("assertGatePasses", () => {
	it("returns ok=true when gate passes", () => {
		const result = assertGatePasses("test-gate", () => ({
			passed: true,
		}));
		expect(result.ok).toBe(true);
		expect(result.gate).toBe("test-gate");
		expect(result.expected).toBe("pass");
		expect(result.actual).toBe("pass");
		expect(result.message).toBe("");
	});

	it("returns ok=false when gate fails", () => {
		const result = assertGatePasses("failing-gate", () => ({
			passed: false,
			message: "check failed",
		}));
		expect(result.ok).toBe(false);
		expect(result.message).toContain("failing-gate");
		expect(result.message).toContain("check failed");
	});

	it("tracks duration", () => {
		const result = assertGatePasses("timed-gate", () => ({
			passed: true,
		}));
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});
});

describe("assertGateFails", () => {
	it("returns ok=true when gate fails (expected)", () => {
		const result = assertGateFails("expected-fail", () => ({
			passed: false,
			message: "something broke",
		}));
		expect(result.ok).toBe(true);
		expect(result.gate).toBe("expected-fail");
		expect(result.expected).toBe("fail");
		expect(result.actual).toBe("fail");
	});

	it("returns ok=false when gate unexpectedly passes", () => {
		const result = assertGateFails("unexpected-pass", () => ({
			passed: true,
		}));
		expect(result.ok).toBe(false);
		expect(result.message).toContain("unexpected-pass");
		expect(result.message).toContain("fail, but it passed");
	});
});

// ─── runGateAssertions ──────────────────────────────────────────────────────────

describe("runGateAssertions", () => {
	it("reports all passing", () => {
		const results = runGateAssertions([
			assertGatePasses("g1", () => ({ passed: true })),
			assertGatePasses("g2", () => ({ passed: true })),
		]);
		expect(results.allPassed).toBe(true);
		expect(results.total).toBe(2);
		expect(results.passed).toBe(2);
		expect(results.failed).toBe(0);
		expect(results.failures).toEqual([]);
		expect(results.summary).toContain("✓");
	});

	it("reports failures with detail", () => {
		const results = runGateAssertions([
			assertGatePasses("g1", () => ({ passed: true })),
			assertGatePasses("g2", () => ({
				passed: false,
				message: "broken",
			})),
		]);
		expect(results.allPassed).toBe(false);
		expect(results.failed).toBe(1);
		expect(results.failures.length).toBe(1);
		expect(results.failures[0]?.gate).toBe("g2");
		expect(results.summary).toContain("✗");
		expect(results.summary).toContain("g2");
	});

	it("sums total duration", () => {
		const results = runGateAssertions([
			assertGatePasses("g1", () => ({ passed: true })),
		]);
		expect(results.totalDurationMs).toBeGreaterThanOrEqual(0);
	});
});

// ─── validateModuleTestManifest ─────────────────────────────────────────────────

describe("validateModuleTestManifest", () => {
	const validManifest: ModuleTestManifest = {
		moduleName: "test-module",
		modulePath: "src/lib/test-module.ts",
		boundaryTestCommand: "npx vitest run test-module.test.ts",
		smokeTestCommand: "npx vitest run test-module.test.ts -t smoke",
		expectedArtifacts: ["dist/output.json"],
		tddRequired: false,
	};

	it("validates a correct manifest", () => {
		const result = validateModuleTestManifest(validManifest);
		expect(result.valid).toBe(true);
		expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
	});

	it("rejects missing module name", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			moduleName: "",
		});
		expect(result.valid).toBe(false);
		expect(result.findings[0]?.code).toBe("MISSING_MODULE_NAME");
	});

	it("rejects missing module path", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			modulePath: "",
		});
		expect(result.valid).toBe(false);
		expect(result.findings[0]?.code).toBe("MISSING_MODULE_PATH");
	});

	it("rejects missing boundary test command", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			boundaryTestCommand: "",
		});
		expect(result.valid).toBe(false);
		expect(result.findings[0]?.code).toBe("MISSING_BOUNDARY_TEST");
	});

	it("rejects missing smoke test command", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			smokeTestCommand: "",
		});
		expect(result.valid).toBe(false);
		expect(result.findings[0]?.code).toBe("MISSING_SMOKE_TEST");
	});

	it("requires evidence format when tddRequired", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			tddRequired: true,
			evidenceFormat: undefined,
		});
		expect(result.valid).toBe(false);
		expect(result.findings[0]?.code).toBe("MISSING_EVIDENCE_FORMAT");
	});

	it("accepts evidence format when tddRequired", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			tddRequired: true,
			evidenceFormat: "vitest-json",
		});
		expect(result.valid).toBe(true);
	});

	it("warns on empty expected artifacts", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			expectedArtifacts: [],
		});
		// warning, not error — still valid
		expect(result.valid).toBe(true);
		expect(
			result.findings.some((f) => f.code === "NO_EXPECTED_ARTIFACTS"),
		).toBe(true);
	});

	it("rejects path traversal in artifacts", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			expectedArtifacts: ["../etc/passwd"],
		});
		expect(result.valid).toBe(false);
		expect(result.findings[0]?.code).toBe("UNSAFE_ARTIFACT_PATH");
	});

	it("rejects absolute paths in artifacts", () => {
		const result = validateModuleTestManifest({
			...validManifest,
			expectedArtifacts: ["/etc/passwd"],
		});
		expect(result.valid).toBe(false);
		expect(result.findings[0]?.code).toBe("UNSAFE_ARTIFACT_PATH");
	});
});

// ─── TDD Evidence ───────────────────────────────────────────────────────────────

describe("TDD evidence", () => {
	describe("createRedEvidence", () => {
		it("creates RED evidence", () => {
			const evidence = createRedEvidence("my-module", "npx vitest run", 3, 10);
			expect(evidence.phase).toBe("RED");
			expect(evidence.passed).toBe(false);
			expect(evidence.failedCount).toBe(3);
			expect(evidence.testCount).toBe(10);
			expect(evidence.moduleName).toBe("my-module");
		});
	});

	describe("createGreenEvidence", () => {
		it("creates GREEN evidence", () => {
			const evidence = createGreenEvidence("my-module", "npx vitest run", 10);
			expect(evidence.phase).toBe("GREEN");
			expect(evidence.passed).toBe(true);
			expect(evidence.failedCount).toBe(0);
			expect(evidence.testCount).toBe(10);
		});
	});

	describe("validateTDDEvidencePair", () => {
		it("validates a correct RED/GREEN pair", () => {
			const red = createRedEvidence("mod", "test", 2, 10);
			// Ensure green is after red
			const green = createGreenEvidence("mod", "test", 10);
			const result = validateTDDEvidencePair(red, green);
			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it("rejects mismatched module names", () => {
			const red = createRedEvidence("mod-a", "test", 1, 5);
			const green = createGreenEvidence("mod-b", "test", 5);
			const result = validateTDDEvidencePair(red, green);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("mismatch"))).toBe(true);
		});

		it("rejects RED evidence that passes", () => {
			const red = {
				...createRedEvidence("mod", "test", 1, 5),
				passed: true,
			};
			const green = createGreenEvidence("mod", "test", 5);
			const result = validateTDDEvidencePair(red, green);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("passed=false"))).toBe(true);
		});

		it("rejects GREEN evidence that fails", () => {
			const red = createRedEvidence("mod", "test", 1, 5);
			const green = {
				...createGreenEvidence("mod", "test", 5),
				passed: false,
			};
			const result = validateTDDEvidencePair(red, green);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("passed=true"))).toBe(true);
		});

		it("rejects wrong temporal order", () => {
			const green = createGreenEvidence("mod", "test", 5);
			// Backdate the green
			green.capturedAt = "2020-01-01T00:00:00.000Z";
			const red = createRedEvidence("mod", "test", 1, 5);
			red.capturedAt = "2025-01-01T00:00:00.000Z";
			const result = validateTDDEvidencePair(red, green);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes("after RED"))).toBe(true);
		});

		it("rejects swapped phases", () => {
			const green = createGreenEvidence("mod", "test", 5);
			const red = createRedEvidence("mod", "test", 1, 5);
			// Pass them in wrong order
			const result = validateTDDEvidencePair(
				green as unknown as ReturnType<typeof createRedEvidence>,
				red as unknown as ReturnType<typeof createGreenEvidence>,
			);
			expect(result.valid).toBe(false);
		});
	});
});

// ─── Default Manifests ──────────────────────────────────────────────────────────

describe("WORKFLOW_CONTRACT_MANIFESTS", () => {
	it("has manifests for all workflow-contract modules", () => {
		expect(WORKFLOW_CONTRACT_MANIFESTS.length).toBe(7);
		const names = WORKFLOW_CONTRACT_MANIFESTS.map((m) => m.moduleName);
		expect(names).toContain("workflow-contract-checker");
		expect(names).toContain("workflow-contract-parser");
		expect(names).toContain("workflow-contract-registry");
		expect(names).toContain("ci-adapter");
		expect(names).toContain("state-normalizer");
		expect(names).toContain("gate-bundle");
		expect(names).toContain("operator-scorecard");
	});

	it("all manifests are valid", () => {
		for (const manifest of WORKFLOW_CONTRACT_MANIFESTS) {
			const result = validateModuleTestManifest(manifest);
			expect(result.valid).toBe(true);
		}
	});

	it("all manifests have boundary and smoke test commands", () => {
		for (const manifest of WORKFLOW_CONTRACT_MANIFESTS) {
			expect(manifest.boundaryTestCommand.length).toBeGreaterThan(0);
			expect(manifest.smokeTestCommand.length).toBeGreaterThan(0);
		}
	});
});
