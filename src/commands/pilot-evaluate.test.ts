/**
 * Pilot evaluate command tests
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";

import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	calculateClassificationLatency,
	calculateEvidenceCompleteness,
	calculateLeadTimeMetrics,
	calculateRepoSampleSizes,
	calculateRollbackReliability,
	capturePilotMetrics,
	countHighRiskAutomationIncidents,
	countUnresolvedCriticalIncidents,
	loadIncidents,
	loadPendingIncidents,
	loadPrLeadTimeData,
	loadRemediationEvents,
	loadRollbackEvents,
} from "../lib/pilot-evaluation/metrics-capture.js";
import type {
	IncidentRecord,
	PendingIncident,
	PrLeadTimeEntry,
	RemediationEvent,
	RollbackEvent,
} from "../lib/pilot-evaluation/types.js";
import {
	PILOT_EVALUATE_EXIT_CODES,
	PILOT_THRESHOLDS,
} from "../lib/pilot-evaluation/types.js";
import { runPilotEvaluate } from "./pilot-evaluate.js";

// Helper to create valid lead time entry
function createLeadTimeEntry(
	overrides: Partial<PrLeadTimeEntry> & { prNumber: number; repo: string },
): PrLeadTimeEntry {
	return {
		schemaVersion: "pr-lead-time/v1",
		generatedAt: new Date().toISOString(),
		createdAt: "2026-02-20T10:00:00Z",
		mergedAt: "2026-02-20T14:00:00Z",
		draft: false,
		headSha: "a".repeat(40),
		leadTimeHours: 4,
		pilotEligible: true,
		...overrides,
	};
}

// Helper to create valid remediation event
function createRemediationEvent(
	overrides: Partial<RemediationEvent>,
): RemediationEvent {
	return {
		schemaVersion: "remediation-events/v1",
		generatedAt: new Date().toISOString(),
		prNumber: 1,
		repo: "test/repo",
		headSha: "a".repeat(40),
		provider: "greptile",
		severity: "medium",
		action: "applied",
		...overrides,
	};
}

// Helper to create valid rollback event
function createRollbackEvent(overrides: Partial<RollbackEvent>): RollbackEvent {
	return {
		schemaVersion: "rollback-events/v1",
		generatedAt: new Date().toISOString(),
		incidentId: "INC-001",
		triggerType: "drill",
		triggeredAt: new Date().toISOString(),
		completedAt: new Date().toISOString(),
		modeBefore: "autonomous",
		modeAfter: "manual",
		result: "success",
		...overrides,
	};
}

// Helper to create valid incident record
function createIncidentRecord(
	overrides: Partial<IncidentRecord>,
): IncidentRecord {
	return {
		schemaVersion: "incidents/v1",
		generatedAt: new Date().toISOString(),
		incidentId: "INC-001",
		severity: "medium",
		causality: "human_or_external",
		confidence: "confirmed",
		openedAt: new Date().toISOString(),
		classifiedAt: new Date().toISOString(),
		resolvedAt: null,
		slaDueAt: new Date(Date.now() + 86400000).toISOString(),
		slaBreached: false,
		...overrides,
	};
}

// Helper to create valid pending incident
function createPendingIncident(
	overrides: Partial<PendingIncident>,
): PendingIncident {
	return {
		incidentId: "INC-002",
		severity: "medium",
		openedAt: new Date().toISOString(),
		classificationDeadline: new Date(Date.now() + 86400000).toISOString(),
		...overrides,
	};
}

describe("pilot-evaluate", () => {
	let testDir: string;
	let artifactsDir: string;

	beforeEach(() => {
		// Use artifacts directory within cwd
		const baseDir = resolve("artifacts");
		if (!existsSync(baseDir)) {
			mkdirSync(baseDir, { recursive: true });
		}
		testDir = join(baseDir, `pilot-evaluate-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		artifactsDir = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("loadPrLeadTimeData", () => {
		it("returns empty and error for missing file", () => {
			const { data, errors } = loadPrLeadTimeData(artifactsDir);
			expect(data).toEqual([]);
			expect(errors.length).toBe(1);
			expect(errors[0]).toContain("Missing or invalid");
		});

		it("returns error for unsupported schema version", () => {
			const filePath = join(artifactsDir, "pr-lead-time.json");
			writeFileSync(
				filePath,
				JSON.stringify({
					schemaVersion: "pr-lead-time/v2",
					entries: [],
				}),
			);

			const { data, errors } = loadPrLeadTimeData(artifactsDir);
			expect(data).toEqual([]);
			expect(errors.length).toBe(1);
			expect(errors[0]).toContain("unsupported schema version");
		});

		it("loads valid lead time data", () => {
			const filePath = join(artifactsDir, "pr-lead-time.json");
			const entries = [createLeadTimeEntry({ prNumber: 1, repo: "test/repo" })];
			writeFileSync(
				filePath,
				JSON.stringify({
					schemaVersion: "pr-lead-time/v1",
					entries,
				}),
			);

			const { data, errors } = loadPrLeadTimeData(artifactsDir);
			expect(errors).toEqual([]);
			expect(data.length).toBe(1);
			expect(data[0]?.prNumber).toBe(1);
		});
	});

	describe("loadRemediationEvents", () => {
		it("returns empty array for missing file", () => {
			const { data, errors } = loadRemediationEvents(artifactsDir);
			expect(data).toEqual([]);
			expect(errors).toEqual([]);
		});

		it("loads valid JSONL events", () => {
			const filePath = join(artifactsDir, "remediation-events.jsonl");
			const event = createRemediationEvent({ prNumber: 1 });
			writeFileSync(filePath, JSON.stringify(event));

			const { data, errors } = loadRemediationEvents(artifactsDir);
			expect(errors).toEqual([]);
			expect(data.length).toBe(1);
			expect(data[0]?.prNumber).toBe(1);
		});

		it("returns error for unsupported schema", () => {
			const filePath = join(artifactsDir, "remediation-events.jsonl");
			// Create event with wrong schema version (spread after to override)
			const event: RemediationEvent = {
				...createRemediationEvent({}),
				schemaVersion: "remediation-events/v2",
			};
			writeFileSync(filePath, JSON.stringify(event));

			const { data, errors } = loadRemediationEvents(artifactsDir);
			expect(data.length).toBe(1);
			expect(errors.length).toBe(1);
			expect(errors[0]).toContain("unsupported schema version");
		});
	});

	describe("loadRollbackEvents", () => {
		it("returns empty array for missing file", () => {
			const { data, errors } = loadRollbackEvents(artifactsDir);
			expect(data).toEqual([]);
			expect(errors).toEqual([]);
		});

		it("loads valid rollback events", () => {
			const filePath = join(artifactsDir, "rollback-events.jsonl");
			const event = createRollbackEvent({ incidentId: "INC-001" });
			writeFileSync(filePath, JSON.stringify(event));

			const { data, errors } = loadRollbackEvents(artifactsDir);
			expect(errors).toEqual([]);
			expect(data.length).toBe(1);
			expect(data[0]?.incidentId).toBe("INC-001");
		});

		it("returns error for malformed JSONL", () => {
			const filePath = join(artifactsDir, "rollback-events.jsonl");
			writeFileSync(filePath, "{not-json}");

			const { data, errors } = loadRollbackEvents(artifactsDir);
			expect(data).toEqual([]);
			expect(errors.length).toBe(1);
			expect(errors[0]).toContain("invalid JSONL");
		});
	});

	describe("loadIncidents", () => {
		it("returns empty array for missing file", () => {
			const { data, errors } = loadIncidents(artifactsDir);
			expect(data).toEqual([]);
			expect(errors).toEqual([]);
		});

		it("loads valid incidents", () => {
			const filePath = join(artifactsDir, "incidents.jsonl");
			const incident = createIncidentRecord({ incidentId: "INC-001" });
			writeFileSync(filePath, JSON.stringify(incident));

			const { data, errors } = loadIncidents(artifactsDir);
			expect(errors).toEqual([]);
			expect(data.length).toBe(1);
			expect(data[0]?.incidentId).toBe("INC-001");
		});

		it("returns error for malformed JSONL", () => {
			const filePath = join(artifactsDir, "incidents.jsonl");
			writeFileSync(filePath, "{not-json}");

			const { data, errors } = loadIncidents(artifactsDir);
			expect(data).toEqual([]);
			expect(errors.length).toBe(1);
			expect(errors[0]).toContain("invalid JSONL");
		});
	});

	describe("loadPendingIncidents", () => {
		it("returns empty array for missing file (optional)", () => {
			const { data, errors } = loadPendingIncidents(artifactsDir);
			expect(data).toEqual([]);
			expect(errors).toEqual([]);
		});

		it("loads valid pending incidents", () => {
			const filePath = join(artifactsDir, "pending-incidents.json");
			const pending = [createPendingIncident({ incidentId: "INC-002" })];
			writeFileSync(filePath, JSON.stringify(pending));

			const { data, errors } = loadPendingIncidents(artifactsDir);
			expect(errors).toEqual([]);
			expect(data.length).toBe(1);
			expect(data[0]?.incidentId).toBe("INC-002");
		});
	});

	describe("calculateLeadTimeMetrics", () => {
		it("returns zeros for empty data", () => {
			const result = calculateLeadTimeMetrics([], []);
			expect(result.p50Improvement).toBe(0);
			expect(result.p75Improvement).toBe(0);
			expect(result.sampleSize).toBe(0);
		});

		it("returns zeros when only pilot has data", () => {
			const pilot = [
				createLeadTimeEntry({
					prNumber: 1,
					repo: "test/repo",
					leadTimeHours: 4,
					pilotEligible: true,
				}),
			];
			const result = calculateLeadTimeMetrics(pilot, []);
			expect(result.sampleSize).toBe(0);
		});

		it("calculates improvement correctly", () => {
			const pilot = [
				createLeadTimeEntry({
					prNumber: 1,
					repo: "test/repo",
					leadTimeHours: 4,
					pilotEligible: true,
				}),
				createLeadTimeEntry({
					prNumber: 2,
					repo: "test/repo",
					leadTimeHours: 6,
					pilotEligible: true,
				}),
			];
			const baseline = [
				createLeadTimeEntry({
					prNumber: 3,
					repo: "test/repo",
					leadTimeHours: 8,
					pilotEligible: false,
				}),
				createLeadTimeEntry({
					prNumber: 4,
					repo: "test/repo",
					leadTimeHours: 12,
					pilotEligible: false,
				}),
			];
			const result = calculateLeadTimeMetrics(pilot, baseline);
			// Pilot median: 5, Baseline median: 10
			// Improvement: (5 - 10) / 10 = -0.5 (50% reduction)
			expect(result.p50Improvement).toBe(-0.5);
			expect(result.sampleSize).toBe(2);
		});
	});

	describe("calculateRollbackReliability", () => {
		it("returns 1 when no triggers exist", () => {
			expect(calculateRollbackReliability([])).toBe(1);
		});

		it("calculates reliability for successful rollbacks", () => {
			const events = [
				createRollbackEvent({ triggerType: "drill", result: "success" }),
				createRollbackEvent({ triggerType: "drill", result: "success" }),
			];
			expect(calculateRollbackReliability(events)).toBe(1);
		});

		it("calculates reliability for mixed results", () => {
			const events = [
				createRollbackEvent({ triggerType: "drill", result: "success" }),
				createRollbackEvent({ triggerType: "real", result: "failed" }),
			];
			expect(calculateRollbackReliability(events)).toBe(0.5);
		});

		it("ignores non-trigger events", () => {
			const events = [
				createRollbackEvent({ triggerType: "drill", result: "success" }),
				// Other trigger types are not counted
			];
			expect(calculateRollbackReliability(events)).toBe(1);
		});
	});

	describe("countHighRiskAutomationIncidents", () => {
		it("returns 0 for no incidents", () => {
			expect(countHighRiskAutomationIncidents([])).toBe(0);
		});

		it("counts only high severity automation confirmed incidents", () => {
			const incidents = [
				createIncidentRecord({
					incidentId: "INC-001",
					severity: "high",
					causality: "automation_confirmed",
				}),
				createIncidentRecord({
					incidentId: "INC-002",
					severity: "high",
					causality: "human_or_external",
				}),
				createIncidentRecord({
					incidentId: "INC-003",
					severity: "medium",
					causality: "automation_confirmed",
				}),
			];
			expect(countHighRiskAutomationIncidents(incidents)).toBe(1);
		});
	});

	describe("countUnresolvedCriticalIncidents", () => {
		it("counts unresolved high severity incidents", () => {
			const incidents = [
				createIncidentRecord({
					incidentId: "INC-001",
					severity: "high",
					resolvedAt: null,
				}),
				createIncidentRecord({
					incidentId: "INC-002",
					severity: "high",
					resolvedAt: new Date().toISOString(),
				}),
			];
			expect(countUnresolvedCriticalIncidents(incidents, [])).toBe(1);
		});

		it("counts pending high severity incidents", () => {
			const pending = [
				createPendingIncident({ incidentId: "INC-001", severity: "high" }),
				createPendingIncident({ incidentId: "INC-002", severity: "medium" }),
			];
			expect(countUnresolvedCriticalIncidents([], pending)).toBe(1);
		});
	});

	describe("calculateClassificationLatency", () => {
		it("returns 0 for no incidents", () => {
			expect(calculateClassificationLatency([])).toBe(0);
		});

		it("calculates p95 latency", () => {
			const incidents = [
				createIncidentRecord({
					incidentId: "INC-001",
					openedAt: "2026-02-20T10:00:00Z",
					classifiedAt: "2026-02-20T11:00:00Z", // 1 hour
				}),
				createIncidentRecord({
					incidentId: "INC-002",
					openedAt: "2026-02-20T10:00:00Z",
					classifiedAt: "2026-02-20T14:00:00Z", // 4 hours
				}),
			];
			// With only 2 items, p95 should be the max
			expect(calculateClassificationLatency(incidents)).toBe(4);
		});

		it("skips incidents without classification", () => {
			const incidents = [
				createIncidentRecord({
					incidentId: "INC-001",
					classifiedAt: null,
				}),
			];
			expect(calculateClassificationLatency(incidents)).toBe(0);
		});
	});

	describe("calculateRepoSampleSizes", () => {
		it("returns empty for no eligible entries", () => {
			const entries = [
				createLeadTimeEntry({
					prNumber: 1,
					repo: "test/repo",
					pilotEligible: false,
				}),
			];
			expect(calculateRepoSampleSizes(entries)).toEqual({});
		});

		it("counts eligible entries per repo", () => {
			const entries = [
				createLeadTimeEntry({
					prNumber: 1,
					repo: "test/repo-a",
					pilotEligible: true,
					leadTimeHours: 4,
				}),
				createLeadTimeEntry({
					prNumber: 2,
					repo: "test/repo-a",
					pilotEligible: true,
					leadTimeHours: 6,
				}),
				createLeadTimeEntry({
					prNumber: 3,
					repo: "test/repo-b",
					pilotEligible: true,
					leadTimeHours: 8,
				}),
			];
			const result = calculateRepoSampleSizes(entries);
			expect(result["test/repo-a"]).toBe(2);
			expect(result["test/repo-b"]).toBe(1);
		});
	});

	describe("calculateEvidenceCompleteness", () => {
		it("returns 1 for empty data", () => {
			expect(calculateEvidenceCompleteness([], [], [])).toBe(1);
		});

		it("calculates completeness ratio", () => {
			const leadTime = [
				createLeadTimeEntry({ prNumber: 1, repo: "test/repo" }),
			];
			const result = calculateEvidenceCompleteness(leadTime, [], []);
			// 4 required fields, all present
			expect(result).toBe(1);
		});
	});

	describe("capturePilotMetrics", () => {
		it("returns metrics with errors when artifacts missing", () => {
			const { metrics, errors } = capturePilotMetrics(artifactsDir);
			// Function returns metrics even with missing files (graceful degradation)
			// but errors will indicate missing files
			expect(errors.length).toBeGreaterThan(0);
			expect(metrics).not.toBeNull();
			expect(metrics?.sampleSize).toBe(0);
		});

		it("captures metrics from valid artifacts", () => {
			// Create valid artifacts
			const leadTimePath = join(artifactsDir, "pr-lead-time.json");
			writeFileSync(
				leadTimePath,
				JSON.stringify({
					schemaVersion: "pr-lead-time/v1",
					entries: [
						createLeadTimeEntry({
							prNumber: 1,
							repo: "test/repo",
							leadTimeHours: 4,
							pilotEligible: true,
							createdAt: "2026-02-20T10:00:00Z",
						}),
						createLeadTimeEntry({
							prNumber: 2,
							repo: "test/repo",
							leadTimeHours: 10,
							pilotEligible: false,
							createdAt: "2026-02-19T10:00:00Z",
						}),
					],
				}),
			);

			const rollbackPath = join(artifactsDir, "rollback-events.jsonl");
			writeFileSync(
				rollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);

			// Create empty optional files
			writeFileSync(join(artifactsDir, "remediation-events.jsonl"), "");
			writeFileSync(join(artifactsDir, "incidents.jsonl"), "");

			const { metrics, errors } = capturePilotMetrics(artifactsDir);
			expect(errors).toEqual([]);
			expect(metrics).not.toBeNull();
			expect(metrics?.sampleSize).toBe(1);
			expect(metrics?.rollbackReliability).toBe(1);
			expect(metrics?.highRiskAutomationIncidents).toBe(0);
		});
	});

	describe("runPilotEvaluate", () => {
		it("returns error when artifacts directory missing", () => {
			const result = runPilotEvaluate({
				artifactsDir: "/nonexistent/path",
			});
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("E_ARTIFACTS_NOT_FOUND");
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR);
		});

		it("returns hold for missing required artifact (sample size 0)", () => {
			const result = runPilotEvaluate({ artifactsDir });
			// Returns ok:true but outcome is "hold" because sample size is 0
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("hold");
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.HOLD);
		});

		// Security: malformed JSONL must fail closed, not silently promote
		it("fails closed (E_SCHEMA_VALIDATION) when rollback/incidents JSONL are malformed", () => {
			const leadTimePath = join(artifactsDir, "pr-lead-time.json");
			writeFileSync(
				leadTimePath,
				JSON.stringify({
					schemaVersion: "pr-lead-time/v1",
					entries: [
						createLeadTimeEntry({
							prNumber: 1,
							repo: "test/repo",
							leadTimeHours: 4,
							pilotEligible: true,
						}),
						createLeadTimeEntry({
							prNumber: 2,
							repo: "test/repo",
							leadTimeHours: 10,
							pilotEligible: false,
						}),
					],
				}),
			);
			writeFileSync(join(artifactsDir, "rollback-events.jsonl"), "{not-json}");
			writeFileSync(join(artifactsDir, "incidents.jsonl"), "{not-json}");
			writeFileSync(join(artifactsDir, "remediation-events.jsonl"), "");

			const result = runPilotEvaluate({ artifactsDir });
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("E_SCHEMA_VALIDATION");
			expect(result.error?.message).toContain("invalid JSONL");
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR);
		});

		it("returns promote when all thresholds met", () => {
			// Create valid artifacts with good metrics
			const leadTimePath = join(artifactsDir, "pr-lead-time.json");
			// Create pilot entries with 60% improvement (lead time reduced from 10 to 4 hours)
			const pilotEntries = Array.from({ length: 25 }, (_, i) =>
				createLeadTimeEntry({
					prNumber: i + 1,
					repo: "test/repo",
					leadTimeHours: 4, // Much better than baseline
					pilotEligible: true,
					createdAt: `2026-02-${20 + (i % 5)}T10:00:00Z`,
				}),
			);
			// Create baseline entries
			const baselineEntries = Array.from({ length: 25 }, (_, i) =>
				createLeadTimeEntry({
					prNumber: 100 + i,
					repo: "test/repo",
					leadTimeHours: 10, // Baseline
					pilotEligible: false,
					createdAt: `2026-02-${10 + (i % 5)}T10:00:00Z`,
				}),
			);
			writeFileSync(
				leadTimePath,
				JSON.stringify({
					schemaVersion: "pr-lead-time/v1",
					entries: [...pilotEntries, ...baselineEntries],
				}),
			);

			// Create rollback events (100% success)
			const rollbackPath = join(artifactsDir, "rollback-events.jsonl");
			writeFileSync(
				rollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);

			// Create empty optional files
			writeFileSync(join(artifactsDir, "remediation-events.jsonl"), "");
			writeFileSync(join(artifactsDir, "incidents.jsonl"), "");

			const result = runPilotEvaluate({ artifactsDir });
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("promote");
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.PROMOTE);
		});

		it("returns hold when high-risk automation incidents exist", () => {
			// Create valid lead time data
			const leadTimePath = join(artifactsDir, "pr-lead-time.json");
			writeFileSync(
				leadTimePath,
				JSON.stringify({
					schemaVersion: "pr-lead-time/v1",
					entries: Array.from({ length: 25 }, (_, i) =>
						createLeadTimeEntry({
							prNumber: i + 1,
							repo: "test/repo",
							leadTimeHours: 4,
							pilotEligible: true,
						}),
					),
				}),
			);

			// Create rollback events
			const rollbackPath = join(artifactsDir, "rollback-events.jsonl");
			writeFileSync(
				rollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);

			// Create a high-risk automation incident
			const incidentsPath = join(artifactsDir, "incidents.jsonl");
			writeFileSync(
				incidentsPath,
				JSON.stringify(
					createIncidentRecord({
						severity: "high",
						causality: "automation_confirmed",
					}),
				),
			);

			// Create empty remediation file
			writeFileSync(join(artifactsDir, "remediation-events.jsonl"), "");

			const result = runPilotEvaluate({ artifactsDir });
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("rollback"); // Hard gate triggers rollback
			expect(result.result?.holdReasons.length).toBeGreaterThan(0);
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.HOLD);
		});

		it("returns hold when sample size too small", () => {
			// Create lead time with only 10 entries (below min of 20)
			const leadTimePath = join(artifactsDir, "pr-lead-time.json");
			writeFileSync(
				leadTimePath,
				JSON.stringify({
					schemaVersion: "pr-lead-time/v1",
					entries: Array.from({ length: 10 }, (_, i) =>
						createLeadTimeEntry({
							prNumber: i + 1,
							repo: "test/repo",
							leadTimeHours: 4,
							pilotEligible: true,
						}),
					),
				}),
			);

			// Create rollback events
			const rollbackPath = join(artifactsDir, "rollback-events.jsonl");
			writeFileSync(
				rollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);

			// Create empty optional files
			writeFileSync(join(artifactsDir, "remediation-events.jsonl"), "");
			writeFileSync(join(artifactsDir, "incidents.jsonl"), "");

			const result = runPilotEvaluate({ artifactsDir });
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("hold");
			expect(
				result.result?.holdReasons.some((r) => r.includes("Sample size")),
			).toBe(true);
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.HOLD);
		});

		// Security: output path must not escape cwd
		it("rejects output path that traverses outside cwd", () => {
			const result = runPilotEvaluate({
				artifactsDir,
				outputPath: "../outside.json",
			});
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("E_PATH_TRAVERSAL");
		});

		// Security: symlinked output path must not escape cwd
		it("rejects symlinked output path that escapes cwd", () => {
			const externalTarget = join(
				"/tmp",
				`pilot-eval-target-${Date.now()}.json`,
			);
			writeFileSync(externalTarget, "do-not-overwrite", "utf-8");
			const symlinkPath = join(artifactsDir, "escaped-output.json");
			symlinkSync(externalTarget, symlinkPath);

			try {
				const result = runPilotEvaluate({
					artifactsDir,
					outputPath: symlinkPath,
				});
				expect(result.ok).toBe(false);
				expect(result.error?.code).toBe("E_PATH_TRAVERSAL");
				// Confirm the external target was not touched
				expect(readFileSync(externalTarget, "utf-8")).toBe("do-not-overwrite");
			} finally {
				rmSync(externalTarget, { force: true });
			}
		});

		it("writes output file when specified", () => {
			// Create valid artifacts
			const leadTimePath = join(artifactsDir, "pr-lead-time.json");
			const pilotEntries = Array.from({ length: 25 }, (_, i) =>
				createLeadTimeEntry({
					prNumber: i + 1,
					repo: "test/repo",
					leadTimeHours: 4,
					pilotEligible: true,
				}),
			);
			const baselineEntries = Array.from({ length: 25 }, (_, i) =>
				createLeadTimeEntry({
					prNumber: 100 + i,
					repo: "test/repo",
					leadTimeHours: 10,
					pilotEligible: false,
				}),
			);
			writeFileSync(
				leadTimePath,
				JSON.stringify({
					schemaVersion: "pr-lead-time/v1",
					entries: [...pilotEntries, ...baselineEntries],
				}),
			);

			const rollbackPath = join(artifactsDir, "rollback-events.jsonl");
			writeFileSync(
				rollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);

			writeFileSync(join(artifactsDir, "remediation-events.jsonl"), "");
			writeFileSync(join(artifactsDir, "incidents.jsonl"), "");

			const outputPath = join(artifactsDir, "evaluation-result.json");
			const result = runPilotEvaluate({ artifactsDir, outputPath });

			expect(result.ok).toBe(true);
			expect(existsSync(outputPath)).toBe(true);

			// Verify output file contents
			const output = JSON.parse(
				require("node:fs").readFileSync(outputPath, "utf-8"),
			);
			expect(output.schemaVersion).toBe("pilot-evaluation/v1");
			expect(output.outcome).toBe("promote");
		});
	});

	describe("PILOT_THRESHOLDS", () => {
		it("has required threshold values", () => {
			expect(PILOT_THRESHOLDS.leadTimeP50Improvement).toBe(-0.35);
			expect(PILOT_THRESHOLDS.rollbackReliability).toBe(1.0);
			expect(PILOT_THRESHOLDS.highRiskAutomationIncidents).toBe(0);
			expect(PILOT_THRESHOLDS.minTotalSampleSize).toBe(20);
			expect(PILOT_THRESHOLDS.evidenceCompletenessRatio).toBe(0.95);
		});
	});
});
