import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EXIT_CODES, runGapCase, runGapCaseCLI } from "./gap-case.js";

describe("gap-case", () => {
	const testDir = join(process.cwd(), "artifacts/test/gap-case");
	const contractPath = join(testDir, "harness.contract.json");
	const caseStore = join(testDir, ".harness/gap-cases.json");

	beforeEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	function createContract(policy?: {
		enabled?: boolean;
		defaultSlaHours?: number;
		requireClosureEvidence?: boolean;
		storePath?: string;
	}): string {
		const contract = {
			version: "1.0",
			pilotGapCasePolicy: {
				enabled: policy?.enabled ?? true,
				defaultSlaHours: policy?.defaultSlaHours ?? 168, // 7 days
				requireClosureEvidence: policy?.requireClosureEvidence ?? false,
				storePath: policy?.storePath ?? caseStore,
			},
		};
		mkdirSync(dirname(contractPath), { recursive: true });
		writeFileSync(contractPath, JSON.stringify(contract), "utf-8");
		return contractPath;
	}

	describe("create action", () => {
		it("creates a gap case with required fields", () => {
			createContract();

			const result = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "create") {
				expect(result.output.caseRecord.id).toMatch(/^gap-/);
				expect(result.output.caseRecord.incidentId).toBe("incident-001");
				expect(result.output.caseRecord.severity).toBe("high");
				expect(result.output.caseRecord.status).toBe("open");
			}
		});

		it("uses contract defaultSlaHours for due date", () => {
			createContract({ defaultSlaHours: 24 }); // 1 day

			const result = runGapCase({
				action: "create",
				incidentId: "incident-002",
				owner: "bob",
				severity: "medium",
				linkedPr: "https://github.com/org/repo/pull/2",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "create") {
				const dueDate = new Date(result.output.caseRecord.dueAt);
				const now = new Date();
				const hoursDiff =
					(dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
				// Should be approximately 24 hours (with some buffer for test execution)
				expect(hoursDiff).toBeGreaterThan(23);
				expect(hoursDiff).toBeLessThan(25);
			}
		});

		it("returns error when gap-case is disabled in policy", () => {
			createContract({ enabled: false });

			const result = runGapCase({
				action: "create",
				incidentId: "incident-003",
				owner: "alice",
				severity: "low",
				linkedPr: "https://github.com/org/repo/pull/3",
				contractPath,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_POLICY");
				expect(result.error.message).toContain("disabled");
			}
		});

		it("returns error for missing incidentId", () => {
			createContract();

			const result = runGapCase({
				action: "create",
				incidentId: "",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_USAGE");
				expect(result.error.message).toContain("--incident-id");
			}
		});

		it("returns error for invalid severity", () => {
			createContract();

			const result = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "critical" as "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_USAGE");
				expect(result.error.message).toContain("--severity");
			}
		});
	});

	describe("list action", () => {
		it("lists all gap cases", () => {
			createContract();

			// Create two cases
			runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});
			runGapCase({
				action: "create",
				incidentId: "incident-002",
				owner: "bob",
				severity: "low",
				linkedPr: "https://github.com/org/repo/pull/2",
				contractPath,
			});

			const result = runGapCase({
				action: "list",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "list") {
				expect(result.output.cases).toHaveLength(2);
			}
		});

		it("filters by open status", () => {
			createContract();

			// Create and resolve one case
			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (createResult.ok && createResult.output.action === "create") {
				runGapCase({
					action: "resolve",
					caseId: createResult.output.caseRecord.id,
					incidentId: "incident-001",
					resolvedBy: "bob",
					linkedPr: "https://github.com/org/repo/pull/2",
					contractPath,
				});
			}

			// Create another open case
			runGapCase({
				action: "create",
				incidentId: "incident-002",
				owner: "charlie",
				severity: "low",
				linkedPr: "https://github.com/org/repo/pull/3",
				contractPath,
			});

			const result = runGapCase({
				action: "list",
				open: true,
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "list") {
				expect(result.output.cases).toHaveLength(1);
				expect(result.output.cases[0]?.status).toBe("open");
			}
		});

		it("filters by unresolvedCausality (high-severity only)", () => {
			createContract();

			// Create high-severity case without causality
			runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			// Create low-severity case
			runGapCase({
				action: "create",
				incidentId: "incident-002",
				owner: "bob",
				severity: "low",
				linkedPr: "https://github.com/org/repo/pull/2",
				contractPath,
			});

			const result = runGapCase({
				action: "list",
				unresolvedCausality: true,
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "list") {
				expect(result.output.cases).toHaveLength(1);
				expect(result.output.cases[0]?.severity).toBe("high");
			}
		});
	});

	describe("resolve action", () => {
		it("resolves an open gap case", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			expect(createResult.ok).toBe(true);
			if (!createResult.ok || createResult.output.action !== "create") return;

			const result = runGapCase({
				action: "resolve",
				caseId: createResult.output.caseRecord.id,
				incidentId: "incident-001",
				resolvedBy: "bob",
				linkedPr: "https://github.com/org/repo/pull/2",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "resolve") {
				expect(result.output.caseRecord.status).toBe("resolved");
				expect(result.output.caseRecord.resolvedBy).toBe("bob");
				expect(result.output.caseRecord.closedAt).toBeDefined();
			}
		});

		it("returns error when case is already resolved", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			// Resolve once
			runGapCase({
				action: "resolve",
				caseId: createResult.output.caseRecord.id,
				incidentId: "incident-001",
				resolvedBy: "bob",
				linkedPr: "https://github.com/org/repo/pull/2",
				contractPath,
			});

			// Try to resolve again
			const result = runGapCase({
				action: "resolve",
				caseId: createResult.output.caseRecord.id,
				incidentId: "incident-001",
				resolvedBy: "charlie",
				linkedPr: "https://github.com/org/repo/pull/3",
				contractPath,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_POLICY");
				expect(result.error.message).toContain("already resolved");
			}
		});

		it("requires evidence when requireClosureEvidence is true", () => {
			createContract({ requireClosureEvidence: true });

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			const result = runGapCase({
				action: "resolve",
				caseId: createResult.output.caseRecord.id,
				incidentId: "incident-001",
				resolvedBy: "bob",
				linkedPr: "https://github.com/org/repo/pull/2",
				contractPath,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_POLICY");
				expect(result.error.message).toContain("Evidence required");
			}
		});

		it("allows resolve with evidence when requireClosureEvidence is true", () => {
			createContract({ requireClosureEvidence: true });

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			const result = runGapCase({
				action: "resolve",
				caseId: createResult.output.caseRecord.id,
				incidentId: "incident-001",
				resolvedBy: "bob",
				linkedPr: "https://github.com/org/repo/pull/2",
				evidence: ["Root cause identified: race condition in X"],
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "resolve") {
				expect(result.output.caseRecord.status).toBe("resolved");
			}
		});
	});

	describe("update-causality action", () => {
		it("updates causality for a gap case", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			const result = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_confirmed",
				confidence: "confirmed",
				updatedBy: "bob",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "update-causality") {
				expect(result.output.caseRecord.causality).toBe(
					"automation_confirmed",
				);
				expect(result.output.caseRecord.confidence).toBe("confirmed");
				expect(result.output.caseRecord.causalityUpdatedBy).toBe("bob");
			}
		});

		it("requires confirmed confidence for causality downgrade", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			// First set to automation_confirmed
			runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_confirmed",
				confidence: "confirmed",
				updatedBy: "bob",
				contractPath,
			});

			// Try to downgrade without confirmed confidence
			const result = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_possible",
				confidence: "probable",
				updatedBy: "charlie",
				contractPath,
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("E_POLICY");
				expect(result.error.message).toContain("downgrade requires");
			}
		});

		it("allows causality downgrade with confirmed confidence", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			// First set to automation_confirmed
			runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_confirmed",
				confidence: "confirmed",
				updatedBy: "bob",
				contractPath,
			});

			// Downgrade with confirmed confidence
			const result = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "human_or_external",
				confidence: "confirmed",
				updatedBy: "charlie",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "update-causality") {
				expect(result.output.caseRecord.causality).toBe(
					"human_or_external",
				);
			}
		});
	});

	describe("runGapCaseCLI", () => {
		it("returns SUCCESS exit code on create", () => {
			createContract();

			const exitCode = runGapCaseCLI({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		});

		it("returns USAGE exit code for missing incident ID", () => {
			createContract();

			const exitCode = runGapCaseCLI({
				action: "create",
				incidentId: "",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.USAGE);
		});

		it("returns POLICY exit code when disabled", () => {
			createContract({ enabled: false });

			const exitCode = runGapCaseCLI({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.POLICY);
		});
	});

	describe("auto-rollback trigger", () => {
		it("triggers rollback when high-severity automation is confirmed", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			const result = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_confirmed",
				confidence: "confirmed",
				updatedBy: "bob",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "update-causality") {
				expect(result.output.caseRecord.autoRollbackTriggeredAt).toBeDefined();
				expect(result.output.caseRecord.autoRollbackReason).toContain(
					"Automatic rollback triggered",
				);
			}
		});

		it("does not trigger rollback for medium severity", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "medium",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			const result = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_confirmed",
				confidence: "confirmed",
				updatedBy: "bob",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "update-causality") {
				expect(result.output.caseRecord.autoRollbackTriggeredAt).toBeUndefined();
			}
		});

		it("does not trigger rollback for automation_possible", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			const result = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_possible",
				confidence: "confirmed",
				updatedBy: "bob",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "update-causality") {
				expect(result.output.caseRecord.autoRollbackTriggeredAt).toBeUndefined();
			}
		});

		it("does not trigger rollback without confirmed confidence", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			const result = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_confirmed",
				confidence: "probable",
				updatedBy: "bob",
				contractPath,
			});

			expect(result.ok).toBe(true);
			if (result.ok && result.output.action === "update-causality") {
				expect(result.output.caseRecord.autoRollbackTriggeredAt).toBeUndefined();
			}
		});

		it("does not trigger rollback twice", () => {
			createContract();

			const createResult = runGapCase({
				action: "create",
				incidentId: "incident-001",
				owner: "alice",
				severity: "high",
				linkedPr: "https://github.com/org/repo/pull/1",
				contractPath,
			});

			if (!createResult.ok || createResult.output.action !== "create") return;

			// First update triggers rollback
			const firstResult = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_confirmed",
				confidence: "confirmed",
				updatedBy: "bob",
				contractPath,
			});

			expect(firstResult.ok).toBe(true);
			if (!firstResult.ok || firstResult.output.action !== "update-causality") return;

			const firstTriggeredAt = firstResult.output.caseRecord.autoRollbackTriggeredAt;
			expect(firstTriggeredAt).toBeDefined();

			// Downgrade and re-confirm (should not trigger again)
			runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_possible",
				confidence: "confirmed",
				updatedBy: "charlie",
				contractPath,
			});

			const secondResult = runGapCase({
				action: "update-causality",
				caseId: createResult.output.caseRecord.id,
				causality: "automation_confirmed",
				confidence: "confirmed",
				updatedBy: "dave",
				contractPath,
			});

			expect(secondResult.ok).toBe(true);
			if (secondResult.ok && secondResult.output.action === "update-causality") {
				// Should still have the original timestamp
				expect(secondResult.output.caseRecord.autoRollbackTriggeredAt).toBe(
					firstTriggeredAt,
				);
			}
		});
	});

	describe("exit codes", () => {
		it("defines expected exit codes", () => {
			expect(EXIT_CODES.SUCCESS).toBe(0);
			expect(EXIT_CODES.USAGE).toBe(2);
			expect(EXIT_CODES.POLICY).toBe(3);
			expect(EXIT_CODES.PARTIAL).toBe(4);
			expect(EXIT_CODES.INTERNAL).toBe(10);
		});
	});
});
