/**
 * Gap-case command tests
 */

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GapCaseRecord } from "../lib/gap-case/types.js";
import { openGapCase, resolveGapCase, runGapCaseCLI } from "./gap-case.js";

// Contract that enables gap-case
const ENABLED_CONTRACT = {
	version: "1.0",
	riskTierRules: {},
	pilotGapCasePolicy: {
		enabled: true,
		defaultSlaHours: 72,
		requireClosureEvidence: true,
		storePath: ".harness/gap-cases.v1.json",
	},
};

describe("gap-case", () => {
	let testDir: string;
	let storePath: string;
	let contractPath: string;

	beforeEach(() => {
		// Use artifacts directory within cwd (contract loader validates paths stay within cwd)
		const baseDir = resolve("artifacts");
		if (!existsSync(baseDir)) {
			mkdirSync(baseDir, { recursive: true });
		}
		testDir = mkdtempSync(join(baseDir, "gap-case-test-XXXXXX"));
		storePath = join(testDir, "gap-cases.v1.json");
		contractPath = join(testDir, "harness.contract.json");
		// Write enabled contract
		writeFileSync(contractPath, JSON.stringify(ENABLED_CONTRACT, null, 2));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	// Security: contract-supplied storePath must not clobber files outside .harness/
	it("ignores contract storePath outside .harness/ and uses default", () => {
		const maliciousTarget = join(testDir, "malicious-target.json");
		writeFileSync(
			maliciousTarget,
			JSON.stringify({ marker: "ORIGINAL" }),
			"utf-8",
		);

		const maliciousContractPath = join(testDir, "malicious.contract.json");
		writeFileSync(
			maliciousContractPath,
			JSON.stringify({
				version: "1.0",
				riskTierRules: {},
				pilotGapCasePolicy: {
					enabled: true,
					defaultSlaHours: 72,
					requireClosureEvidence: true,
					storePath: maliciousTarget, // points outside .harness/
				},
			}),
			"utf-8",
		);

		const result = openGapCase({
			incidentId: "INC-SEC-001",
			summary: "Security test",
			severity: "high",
			owner: "test-owner",
			contractPath: maliciousContractPath,
		});

		// Case creation should succeed (falls back to default)
		expect(result.ok).toBe(true);
		// The malicious target must NOT have been overwritten
		const targetContent = JSON.parse(
			require("node:fs").readFileSync(maliciousTarget, "utf-8"),
		);
		expect(targetContent).toEqual({ marker: "ORIGINAL" });
		// Clean up default store written by the fallback
		const defaultStore = resolve(".harness/gap-cases.v1.json");
		rmSync(defaultStore, { force: true });
	});

	describe("openGapCase", () => {
		// Security: loadStore must reject paths that escape cwd
		it("rejects store path that traverses outside cwd", () => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "medium",
				owner: "test-owner",
				storePath: "../gap-cases.v1.json",
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_STORE_CORRUPT");
				expect(result.error.message).toContain("escapes working directory");
			}
		});

		// Security: loadStore must reject oversized files before reading
		it("rejects store file exceeding 1 MiB", () => {
			writeFileSync(storePath, "x".repeat(1024 * 1024 + 1), "utf-8");
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "medium",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_STORE_CORRUPT");
				expect(result.error.message).toContain("exceeds max size");
			}
		});

		it("requires incidentId", () => {
			const result = openGapCase({
				incidentId: "",
				summary: "Test summary",
				severity: "medium",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("incidentId");
			}
		});

		it("requires summary", () => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "",
				severity: "medium",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("summary");
			}
		});

		it("requires owner", () => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "medium",
				owner: "",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("owner");
			}
		});

		it("validates severity", () => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "invalid" as "medium",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("severity");
			}
		});

		it("validates SHA format", () => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "medium",
				owner: "test-owner",
				headSha: "invalid-sha",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("headSha");
			}
		});

		it("validates SLA hours", () => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "medium",
				owner: "test-owner",
				slaHours: 0,
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("slaHours");
			}
		});

		it("returns E_DISABLED when policy is disabled", () => {
			const disabledContractPath = join(testDir, "disabled.contract.json");
			writeFileSync(
				disabledContractPath,
				JSON.stringify({
					version: "1.0",
					riskTierRules: {},
					pilotGapCasePolicy: {
						enabled: false,
						defaultSlaHours: 72,
						requireClosureEvidence: true,
						storePath: ".harness/gap-cases.v1.json",
					},
				}),
			);

			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "medium",
				owner: "test-owner",
				storePath,
				contractPath: disabledContractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_DISABLED");
			}
		});

		it("creates a new gap-case with required fields", () => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.incidentId).toBe("INC-001");
				expect(result.output.summary).toBe("Test summary");
				expect(result.output.severity).toBe("high");
				expect(result.output.owner).toBe("test-owner");
				expect(result.output.status).toBe("open");
				expect(result.output.id).toMatch(/^gc-/);
				expect(result.output.openedAt).toBeDefined();
				expect(result.output.slaDueAt).toBeDefined();
			}
		});

		it("creates gap-case with optional fields", () => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "medium",
				owner: "test-owner",
				provider: "greptile",
				findingId: "FIND-001",
				prNumber: 123,
				headSha: "a".repeat(40),
				slaHours: 48,
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.provider).toBe("greptile");
				expect(result.output.findingId).toBe("FIND-001");
				expect(result.output.prNumber).toBe(123);
				expect(result.output.headSha).toBe("a".repeat(40));
			}
		});

		it("is idempotent - returns existing case for same fingerprint", () => {
			const first = openGapCase({
				incidentId: "INC-001",
				summary: "First summary",
				severity: "high",
				owner: "test-owner",
				headSha: "a".repeat(40),
				findingId: "FIND-001",
				storePath,
				contractPath,
			});
			expect(first.ok).toBe(true);

			const second = openGapCase({
				incidentId: "INC-001",
				summary: "Different summary", // Should be ignored
				severity: "low", // Should be ignored
				owner: "different-owner", // Should be ignored
				headSha: "a".repeat(40),
				findingId: "FIND-001",
				storePath,
				contractPath,
			});
			expect(second.ok).toBe(true);
			if (second.ok && first.ok) {
				expect(second.output.id).toBe(first.output.id);
				expect(second.output.summary).toBe("First summary"); // Original preserved
			}
		});

		it("creates different cases for different fingerprints", () => {
			const first = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				headSha: "a".repeat(40),
				storePath,
				contractPath,
			});
			expect(first.ok).toBe(true);

			const second = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				headSha: "b".repeat(40), // Different SHA
				storePath,
				contractPath,
			});
			expect(second.ok).toBe(true);
			if (second.ok && first.ok) {
				expect(second.output.id).not.toBe(first.output.id);
			}
		});
	});

	describe("resolveGapCase", () => {
		let openCase: GapCaseRecord;

		beforeEach(() => {
			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			if (result.ok) {
				openCase = result.output;
			}
		});

		it("requires caseId", () => {
			const result = resolveGapCase({
				caseId: "",
				evidenceUrl: "https://example.com/evidence",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("caseId");
			}
		});

		it("requires evidenceUrl", () => {
			const result = resolveGapCase({
				caseId: openCase.id,
				evidenceUrl: "",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("evidenceUrl");
			}
		});

		it("requires HTTPS URL for evidence", () => {
			const result = resolveGapCase({
				caseId: openCase.id,
				evidenceUrl: "http://example.com/evidence", // HTTP not HTTPS
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_VALIDATION");
				expect(result.error.message).toContain("HTTPS");
			}
		});

		it("returns E_NOT_FOUND for unknown case", () => {
			const result = resolveGapCase({
				caseId: "gc-nonexistent",
				evidenceUrl: "https://example.com/evidence",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_NOT_FOUND");
			}
		});

		it("resolves an open case", () => {
			const result = resolveGapCase({
				caseId: openCase.id,
				evidenceUrl: "https://example.com/evidence",
				fixPr: 456,
				note: "Fixed in PR",
				resolvedBy: "resolver",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.status).toBe("resolved");
				expect(result.output.resolvedAt).toBeDefined();
				expect(result.output.resolution?.evidenceUrl).toBe(
					"https://example.com/evidence",
				);
				expect(result.output.resolution?.fixPr).toBe(456);
				expect(result.output.resolution?.note).toBe("Fixed in PR");
				expect(result.output.resolution?.resolvedBy).toBe("resolver");
			}
		});

		it("returns E_ALREADY_RESOLVED for already resolved case", () => {
			// First resolve
			resolveGapCase({
				caseId: openCase.id,
				evidenceUrl: "https://example.com/evidence",
				storePath,
				contractPath,
			});

			// Try to resolve again
			const result = resolveGapCase({
				caseId: openCase.id,
				evidenceUrl: "https://example.com/other-evidence",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_ALREADY_RESOLVED");
			}
		});
	});

	describe("runGapCaseCLI", () => {
		it("returns VALIDATION_ERROR for missing incidentId on open", () => {
			const exitCode = runGapCaseCLI({
				action: "open",
				storePath,
				contractPath,
			});
			expect(exitCode).toBe(1); // VALIDATION_ERROR
		});

		it("returns SUCCESS for valid open", () => {
			const exitCode = runGapCaseCLI({
				action: "open",
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(exitCode).toBe(0); // SUCCESS
		});

		it("returns NOT_FOUND for unknown case on resolve", () => {
			const exitCode = runGapCaseCLI({
				action: "resolve",
				caseId: "gc-nonexistent",
				evidenceUrl: "https://example.com/evidence",
				storePath,
				contractPath,
			});
			expect(exitCode).toBe(2); // NOT_FOUND
		});

		it("returns VALIDATION_ERROR for missing evidence URL", () => {
			// First open a case
			runGapCaseCLI({
				action: "open",
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				storePath,
				contractPath,
			});

			const exitCode = runGapCaseCLI({
				action: "resolve",
				caseId: "gc-some-id",
				storePath,
				contractPath,
			});
			expect(exitCode).toBe(1); // VALIDATION_ERROR
		});
	});

	describe("store persistence", () => {
		it("persists cases to disk", () => {
			const first = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(first.ok).toBe(true);

			// Open another session with same store
			const second = openGapCase({
				incidentId: "INC-001",
				summary: "Different summary",
				severity: "low",
				owner: "different",
				storePath,
				contractPath,
			});
			expect(second.ok).toBe(true);
			if (second.ok && first.ok) {
				// Should return the same case (idempotent)
				expect(second.output.id).toBe(first.output.id);
			}
		});

		it("handles corrupt store gracefully", () => {
			// Write invalid JSON
			writeFileSync(storePath, "not valid json");

			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_STORE_CORRUPT");
			}
		});

		it("handles invalid store schema", () => {
			// Write valid JSON but wrong schema
			writeFileSync(storePath, JSON.stringify({ version: "2", cases: [] }));

			const result = openGapCase({
				incidentId: "INC-001",
				summary: "Test summary",
				severity: "high",
				owner: "test-owner",
				storePath,
				contractPath,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_STORE_CORRUPT");
			}
		});
	});
});
