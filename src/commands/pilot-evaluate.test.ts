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

import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	appendCanonicalEvent,
	computeEventHash,
	writeCanonicalManifest,
} from "../lib/contract/run-records.js";
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

function writePassingPilotArtifacts(artifactsDir: string): void {
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
	writeFileSync(join(artifactsDir, "remediation-events.jsonl"), "");
	writeFileSync(join(artifactsDir, "rollback-events.jsonl"), "");
	writeFileSync(join(artifactsDir, "incidents.jsonl"), "");
}

function writeCanonicalProducerBundle(options: {
	runRecordsDir: string;
	runId: string;
	command: "remediate" | "pilot-rollback";
	artifactType: "remediation-events" | "rollback-events";
	artifactPath: string;
	manifestOutcome?: "success" | "hold" | "rollback";
	exitClassification?:
		| "ok"
		| "manual_intervention_required"
		| "rollback_required";
	eventType?: "decision" | "intervention" | "retry";
	eventStatus?: "completed" | "passed";
	preconditions?: Record<string, boolean | string>;
	provenance?: {
		repoContractHash?: string;
		processPolicyHash?: string;
	};
}) {
	const now = new Date().toISOString();
	writeCanonicalManifest({
		baseDir: options.runRecordsDir,
		manifest: {
			schemaVersion: "agent-run-manifest/v1",
			runId: options.runId,
			command: options.command,
			startedAt: now,
			finishedAt: now,
			durationMs: 0,
			repo: {
				repository: "test/repo",
				branch: "codex/test",
				headSha: "a".repeat(40),
			},
			contract: {
				path: "harness.contract.json",
				hash: "b".repeat(64),
			},
			policyContext: {
				mode: "manual",
				safetyPosture: "strict",
				effectivePolicySource: "test",
			},
			outcome: options.manifestOutcome ?? "success",
			exit: {
				code: 0,
				classification: options.exitClassification ?? "ok",
			},
			artifactRefs: [
				{
					type: options.artifactType,
					path: options.artifactPath,
					checksum: "c".repeat(64),
				},
			],
			preconditions: options.preconditions ?? {},
			provenance: {
				repoContractHash:
					options.provenance?.repoContractHash ?? "d".repeat(64),
				processPolicyHash:
					options.provenance?.processPolicyHash ?? "e".repeat(64),
			},
		},
	});

	appendCanonicalEvent({
		baseDir: options.runRecordsDir,
		event: {
			schemaVersion: "agent-run-event/v1",
			runId: options.runId,
			eventId: `evt-${options.runId}`,
			timestamp: now,
			eventType: options.eventType ?? "decision",
			status: options.eventStatus ?? "completed",
			severity: "info",
			payload: {
				origin: options.command,
			},
		},
	});
}

describe("pilot-evaluate", () => {
	let testDir: string;
	let artifactsDir: string;
	let runRecordsDir: string;

	beforeEach(() => {
		// Use artifacts directory within cwd
		const baseDir = resolve("artifacts");
		if (!existsSync(baseDir)) {
			mkdirSync(baseDir, { recursive: true });
		}
		testDir = join(baseDir, `pilot-evaluate-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		artifactsDir = testDir;
		runRecordsDir = join(testDir, "agent-runs");
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
				runRecordsDir,
			});
			expect(result.ok).toBe(false);
			expect(result.error?.code).toBe("E_ARTIFACTS_NOT_FOUND");
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.VALIDATION_ERROR);
		});

		it("returns hold for missing required artifact (sample size 0)", () => {
			const result = runPilotEvaluate({ artifactsDir, runRecordsDir });
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

			const result = runPilotEvaluate({ artifactsDir, runRecordsDir });
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

			const result = runPilotEvaluate({ artifactsDir, runRecordsDir });
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("promote");
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.PROMOTE);
		});

		it("returns rollback when high-risk automation incidents exist", () => {
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

			const result = runPilotEvaluate({ artifactsDir, runRecordsDir });
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("rollback"); // Hard gate triggers rollback
			expect(result.result?.holdReasons.length).toBeGreaterThan(0);
			expect(result.exitCode).toBe(PILOT_EVALUATE_EXIT_CODES.ROLLBACK);
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

			const result = runPilotEvaluate({ artifactsDir, runRecordsDir });
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
				runRecordsDir,
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
					runRecordsDir,
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
			const result = runPilotEvaluate({
				artifactsDir,
				outputPath,
				runRecordsDir,
			});

			expect(result.ok).toBe(true);
			expect(existsSync(outputPath)).toBe(true);

			// Verify output file contents
			const output = JSON.parse(
				require("node:fs").readFileSync(outputPath, "utf-8"),
			);
			expect(output.schemaVersion).toBe("pilot-evaluation/v1");
			expect(output.outcome).toBe("promote");
		});

		it("reports explicit legacy adapter metadata when canonical bundles are absent", () => {
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
			writeFileSync(
				join(artifactsDir, "rollback-events.jsonl"),
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);
			writeFileSync(join(artifactsDir, "remediation-events.jsonl"), "");
			writeFileSync(join(artifactsDir, "incidents.jsonl"), "");

			const result = runPilotEvaluate({ artifactsDir, runRecordsDir });
			expect(result.ok).toBe(true);
			expect(result.result?.ingestion.remediationEvents.source).toBe(
				"legacy_adapter",
			);
			expect(result.result?.ingestion.remediationEvents.adapterVersion).toBe(
				"legacy-jsonl-v1",
			);
			expect(result.result?.ingestion.rollbackEvents.source).toBe(
				"legacy_adapter",
			);
		});

		it("consumes canonical artifactRefs before legacy adapter files", () => {
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

			const canonicalDataDir = join(artifactsDir, "canonical");
			mkdirSync(canonicalDataDir, { recursive: true });
			const canonicalRollbackPath = join(
				canonicalDataDir,
				"rollback-events.jsonl",
			);
			const canonicalRemediationPath = join(
				canonicalDataDir,
				"remediation-events.jsonl",
			);
			writeFileSync(
				canonicalRollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);
			writeFileSync(canonicalRemediationPath, "");

			// Intentionally malformed legacy files prove canonical-first discovery.
			writeFileSync(join(artifactsDir, "rollback-events.jsonl"), "{not-json}");
			writeFileSync(
				join(artifactsDir, "remediation-events.jsonl"),
				"{not-json}",
			);
			writeFileSync(join(artifactsDir, "incidents.jsonl"), "");

			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "remediate-bundle-1",
				command: "remediate",
				artifactType: "remediation-events",
				artifactPath: canonicalRemediationPath,
			});
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "rollback-bundle-1",
				command: "pilot-rollback",
				artifactType: "rollback-events",
				artifactPath: canonicalRollbackPath,
			});

			const result = runPilotEvaluate({ artifactsDir, runRecordsDir });
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("promote");
			expect(result.result?.ingestion.remediationEvents.source).toBe(
				"canonical",
			);
			expect(result.result?.ingestion.rollbackEvents.source).toBe("canonical");
		});

		it("enriches legacy adapter ingestion metadata from the adapter registry", () => {
			writePassingPilotArtifacts(artifactsDir);
			const result = runPilotEvaluate({ artifactsDir, runRecordsDir });

			expect(result.ok).toBe(true);
			expect(result.result?.ingestion.remediationEvents.source).toBe(
				"legacy_adapter",
			);
			expect(result.result?.ingestion.remediationEvents.owner).toBe(
				"pilot-evaluation",
			);
			expect(result.result?.ingestion.remediationEvents.introducedAt).toBe(
				"2026-03-08",
			);
			expect(result.result?.ingestion.remediationEvents.sunsetBy).toContain(
				"30 consecutive",
			);
		});

		it("computes CP6 canonical metrics from canonical bundles", () => {
			writePassingPilotArtifacts(artifactsDir);
			const canonicalDataDir = join(artifactsDir, "canonical");
			mkdirSync(canonicalDataDir, { recursive: true });
			const canonicalRollbackPath = join(
				canonicalDataDir,
				"rollback-events.jsonl",
			);
			const canonicalRemediationPath = join(
				canonicalDataDir,
				"remediation-events.jsonl",
			);
			writeFileSync(
				canonicalRollbackPath,
				[
					JSON.stringify(
						createRollbackEvent({ triggerType: "drill", result: "success" }),
					),
					JSON.stringify(
						createRollbackEvent({
							incidentId: "INC-002",
							triggerType: "real",
							result: "success",
						}),
					),
					JSON.stringify(
						createRollbackEvent({
							incidentId: "INC-003",
							triggerType: "real",
							result: "success",
						}),
					),
				].join("\n"),
			);
			writeFileSync(canonicalRemediationPath, "");
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "remediate-bundle-intervention",
				command: "remediate",
				artifactType: "remediation-events",
				artifactPath: canonicalRemediationPath,
				eventType: "intervention",
				eventStatus: "completed",
			});
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "rollback-bundle-thrash",
				command: "pilot-rollback",
				artifactType: "rollback-events",
				artifactPath: canonicalRollbackPath,
				manifestOutcome: "hold",
				exitClassification: "manual_intervention_required",
				eventType: "retry",
				eventStatus: "passed",
			});

			const { metrics } = capturePilotMetrics(artifactsDir, { runRecordsDir });
			expect(metrics?.interventionRate).toBe(0.5);
			expect(metrics?.thrashRate).toBe(0.5);
			expect(metrics?.rollbackTriggerCount).toBe(3);
			expect(metrics?.evidenceCompletenessRatio).toBe(1);
		});

		it("holds when canonical bundle loading detects a sensitive field leak", () => {
			writePassingPilotArtifacts(artifactsDir);
			const canonicalDataDir = join(artifactsDir, "canonical");
			mkdirSync(canonicalDataDir, { recursive: true });
			const canonicalRollbackPath = join(
				canonicalDataDir,
				"rollback-events.jsonl",
			);
			const canonicalRemediationPath = join(
				canonicalDataDir,
				"remediation-events.jsonl",
			);
			writeFileSync(
				canonicalRollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);
			writeFileSync(canonicalRemediationPath, "");
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "remediate-bundle-clean",
				command: "remediate",
				artifactType: "remediation-events",
				artifactPath: canonicalRemediationPath,
			});

			const sensitiveRunId = "rollback-bundle-sensitive";
			const sensitiveRunDir = join(runRecordsDir, sensitiveRunId);
			mkdirSync(sensitiveRunDir, { recursive: true });
			const now = new Date().toISOString();
			writeFileSync(
				join(sensitiveRunDir, "manifest.json"),
				JSON.stringify(
					{
						schemaVersion: "agent-run-manifest/v1",
						runId: sensitiveRunId,
						command: "pilot-rollback",
						startedAt: now,
						finishedAt: now,
						durationMs: 0,
						repo: {
							repository: "test/repo",
							branch: "codex/test",
							headSha: "a".repeat(40),
						},
						contract: {
							path: "harness.contract.json",
							hash: "b".repeat(64),
						},
						policyContext: {
							mode: "manual",
							safetyPosture: "strict",
							effectivePolicySource: "test",
						},
						outcome: "success",
						exit: {
							code: 0,
							classification: "ok",
						},
						artifactRefs: [
							{
								type: "rollback-events",
								path: canonicalRollbackPath,
								checksum: "c".repeat(64),
							},
						],
						preconditions: {
							apiToken: "leaked-secret",
						},
						provenance: {
							repoContractHash: "d".repeat(64),
							processPolicyHash: "e".repeat(64),
						},
					},
					null,
					2,
				),
			);
			const event = {
				schemaVersion: "agent-run-event/v1" as const,
				runId: sensitiveRunId,
				eventId: `evt-${sensitiveRunId}`,
				timestamp: now,
				eventType: "decision" as const,
				status: "completed" as const,
				severity: "info" as const,
				payload: {
					origin: "pilot-rollback",
				},
			};
			writeFileSync(
				join(sensitiveRunDir, "events.jsonl"),
				`${JSON.stringify({ ...event, eventHash: computeEventHash(event) })}\n`,
				"utf-8",
			);

			const result = runPilotEvaluate({
				artifactsDir,
				runRecordsDir,
				lane: "health",
			});
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("hold");
			expect(result.result?.metrics.sensitiveFieldLeakCount).toBe(1);
			expect(result.result?.holdReasons).toContainEqual(
				expect.stringContaining("Sensitive field leak count"),
			);
		});

		it("holds when canonical bundle discovery finds runId collisions across roots", () => {
			writePassingPilotArtifacts(artifactsDir);
			const localRoot = join(artifactsDir, "agent-runs");
			const sharedRoot = resolve("artifacts/agent-runs");
			const runId = "collision-bundle";
			const localArtifactPath = join(
				artifactsDir,
				"canonical/local-rollback.jsonl",
			);
			const sharedArtifactPath = join(
				artifactsDir,
				"canonical/shared-rollback.jsonl",
			);
			mkdirSync(dirname(localArtifactPath), { recursive: true });
			mkdirSync(sharedRoot, { recursive: true });
			writeFileSync(
				localArtifactPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);
			writeFileSync(
				sharedArtifactPath,
				JSON.stringify(
					createRollbackEvent({
						incidentId: "INC-002",
						triggerType: "real",
						result: "success",
					}),
				),
			);
			writeCanonicalProducerBundle({
				runRecordsDir: localRoot,
				runId,
				command: "pilot-rollback",
				artifactType: "rollback-events",
				artifactPath: localArtifactPath,
			});
			writeCanonicalProducerBundle({
				runRecordsDir: sharedRoot,
				runId,
				command: "pilot-rollback",
				artifactType: "rollback-events",
				artifactPath: sharedArtifactPath,
			});

			try {
				const result = runPilotEvaluate({
					artifactsDir,
					lane: "health",
				});
				expect(result.ok).toBe(true);
				expect(result.result?.outcome).toBe("hold");
				expect(result.result?.metrics.runIdCollisionCount).toBe(1);
				expect(result.result?.holdReasons).toContainEqual(
					expect.stringContaining("RunId collision count"),
				);
			} finally {
				rmSync(join(sharedRoot, runId), { recursive: true, force: true });
			}
		});

		it("enforces the rollback trigger denominator guard from the metric registry in health lane", () => {
			writePassingPilotArtifacts(artifactsDir);
			const canonicalDataDir = join(artifactsDir, "canonical");
			mkdirSync(canonicalDataDir, { recursive: true });
			const canonicalRollbackPath = join(
				canonicalDataDir,
				"rollback-events.jsonl",
			);
			const canonicalRemediationPath = join(
				canonicalDataDir,
				"remediation-events.jsonl",
			);
			writeFileSync(
				canonicalRollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);
			writeFileSync(canonicalRemediationPath, "");
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "remediate-bundle-guard",
				command: "remediate",
				artifactType: "remediation-events",
				artifactPath: canonicalRemediationPath,
			});
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "rollback-bundle-guard",
				command: "pilot-rollback",
				artifactType: "rollback-events",
				artifactPath: canonicalRollbackPath,
				manifestOutcome: "rollback",
				exitClassification: "rollback_required",
			});

			const result = runPilotEvaluate({
				artifactsDir,
				runRecordsDir,
				lane: "health",
			});
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("hold");
			expect(result.result?.holdReasons).toContainEqual(
				expect.stringContaining("insufficient evidence"),
			);
		});

		it("keeps drift-only findings exit-neutral in advisory lane", () => {
			writePassingPilotArtifacts(artifactsDir);
			const canonicalDataDir = join(artifactsDir, "canonical");
			mkdirSync(canonicalDataDir, { recursive: true });
			const wrongRollbackPath = join(canonicalDataDir, "wrong-rollback.jsonl");
			const canonicalRemediationPath = join(
				canonicalDataDir,
				"remediation-events.jsonl",
			);
			writeFileSync(
				wrongRollbackPath,
				[
					JSON.stringify(
						createRollbackEvent({ triggerType: "drill", result: "success" }),
					),
					JSON.stringify(
						createRollbackEvent({
							incidentId: "INC-002",
							triggerType: "real",
							result: "success",
						}),
					),
					JSON.stringify(
						createRollbackEvent({
							incidentId: "INC-003",
							triggerType: "real",
							result: "success",
						}),
					),
				].join("\n"),
			);
			writeFileSync(canonicalRemediationPath, "");
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "remediate-bundle-advisory",
				command: "remediate",
				artifactType: "remediation-events",
				artifactPath: canonicalRemediationPath,
			});
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "rollback-bundle-advisory",
				command: "pilot-rollback",
				artifactType: "rollback-events",
				artifactPath: wrongRollbackPath,
				manifestOutcome: "rollback",
				exitClassification: "rollback_required",
			});

			const advisory = runPilotEvaluate({
				artifactsDir,
				runRecordsDir,
				lane: "advisory",
			});
			expect(advisory.ok).toBe(true);
			expect(advisory.result?.outcome).toBe("promote");
			expect(advisory.result?.controls.lane).toBe("advisory");

			const health = runPilotEvaluate({
				artifactsDir,
				runRecordsDir,
				lane: "health",
			});
			expect(health.ok).toBe(true);
			expect(health.result?.outcome).toBe("hold");
		});

		it("engages manual safe mode when kill switch is enabled", () => {
			writePassingPilotArtifacts(artifactsDir);
			const result = runPilotEvaluate({
				artifactsDir,
				runRecordsDir,
				killSwitch: true,
			});

			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("hold");
			expect(result.result?.controls.killSwitchEngaged).toBe(true);
			expect(result.result?.controls.manualSafeMode).toBe(true);
		});

		it("blocks legacy adapter usage after blockAfter in health lane", () => {
			writePassingPilotArtifacts(artifactsDir);
			const adapterRegistryPath = join(artifactsDir, "adapter-registry.json");
			writeFileSync(
				adapterRegistryPath,
				JSON.stringify({
					schemaVersion: "agent-adapter-registry/v1",
					adapters: [
						{
							adapterVersion: "legacy-jsonl-v1",
							owner: "pilot-evaluation",
							introducedAt: "2026-03-08",
							sunsetBy: "test window",
							blockAfter: "2026-03-08T00:00:00.000Z",
							parityWindow: {
								minimumCanonicalCoverage: 0.95,
								minimumConsecutivePassingWindows: 30,
								maxCriticalDrifts: 0,
							},
						},
					],
				}),
			);

			const result = runPilotEvaluate({
				artifactsDir,
				runRecordsDir,
				lane: "health",
				adapterRegistryPath,
			});
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("hold");
			expect(result.result?.controls.manualSafeMode).toBe(true);
			expect(result.result?.holdReasons).toContainEqual(
				expect.stringContaining("blockAfter"),
			);
		});

		it("requires consecutive passing parity windows before marking legacy retirement ready", () => {
			writePassingPilotArtifacts(artifactsDir);
			const canonicalDataDir = join(artifactsDir, "canonical");
			mkdirSync(canonicalDataDir, { recursive: true });
			const canonicalRollbackPath = join(
				canonicalDataDir,
				"rollback-events.jsonl",
			);
			const canonicalRemediationPath = join(
				canonicalDataDir,
				"remediation-events.jsonl",
			);
			writeFileSync(
				canonicalRollbackPath,
				[
					JSON.stringify(
						createRollbackEvent({ triggerType: "drill", result: "success" }),
					),
					JSON.stringify(
						createRollbackEvent({
							incidentId: "INC-002",
							triggerType: "real",
							result: "success",
						}),
					),
					JSON.stringify(
						createRollbackEvent({
							incidentId: "INC-003",
							triggerType: "real",
							result: "success",
						}),
					),
				].join("\n"),
			);
			writeFileSync(canonicalRemediationPath, "");
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "remediate-bundle-retirement",
				command: "remediate",
				artifactType: "remediation-events",
				artifactPath: canonicalRemediationPath,
			});
			writeCanonicalProducerBundle({
				runRecordsDir,
				runId: "rollback-bundle-retirement",
				command: "pilot-rollback",
				artifactType: "rollback-events",
				artifactPath: canonicalRollbackPath,
			});

			const adapterRegistryPath = join(artifactsDir, "adapter-registry.json");
			writeFileSync(
				adapterRegistryPath,
				JSON.stringify({
					schemaVersion: "agent-adapter-registry/v1",
					adapters: [
						{
							adapterVersion: "legacy-jsonl-v1",
							owner: "pilot-evaluation",
							introducedAt: "2026-03-08",
							sunsetBy: "test window",
							blockAfter: null,
							parityWindow: {
								minimumCanonicalCoverage: 0.95,
								minimumConsecutivePassingWindows: 2,
								maxCriticalDrifts: 0,
							},
						},
					],
				}),
			);
			const parityHistoryPath = join(artifactsDir, "parity-history.json");
			writeFileSync(
				parityHistoryPath,
				JSON.stringify(
					{
						schemaVersion: "pilot-adapter-parity-history/v1",
						windows: [
							{
								windowStart: "2026-03-07",
								windowEnd: "2026-03-07",
								generatedAt: "2026-03-07T12:00:00.000Z",
								lane: "advisory",
								canonicalCoverageRatio: 1,
								criticalDriftCount: 0,
								sensitiveFieldLeakCount: 0,
								runIdCollisionCount: 0,
								passing: true,
							},
						],
					},
					null,
					2,
				),
			);

			const result = runPilotEvaluate({
				artifactsDir,
				runRecordsDir,
				adapterRegistryPath,
				parityHistoryPath,
			});
			expect(result.ok).toBe(true);
			expect(result.result?.controls.legacyRetirementReady).toBe(true);
			expect(
				result.result?.controls.parityWindow?.consecutivePassingWindows,
			).toBe(2);
		});

		it("holds in health lane when canonical bundle provenance is missing a policy hash", () => {
			writePassingPilotArtifacts(artifactsDir);
			const canonicalDataDir = join(artifactsDir, "canonical");
			mkdirSync(canonicalDataDir, { recursive: true });
			const canonicalRollbackPath = join(
				canonicalDataDir,
				"rollback-events.jsonl",
			);
			writeFileSync(
				canonicalRollbackPath,
				JSON.stringify(
					createRollbackEvent({ triggerType: "drill", result: "success" }),
				),
			);

			const malformedRunId = "rollback-bundle-missing-policy-hash";
			const malformedRunDir = join(runRecordsDir, malformedRunId);
			mkdirSync(malformedRunDir, { recursive: true });
			const now = new Date().toISOString();
			writeFileSync(
				join(malformedRunDir, "manifest.json"),
				JSON.stringify(
					{
						schemaVersion: "agent-run-manifest/v1",
						runId: malformedRunId,
						command: "pilot-rollback",
						startedAt: now,
						finishedAt: now,
						durationMs: 0,
						repo: {
							repository: "test/repo",
							branch: "codex/test",
							headSha: "a".repeat(40),
						},
						contract: {
							path: "harness.contract.json",
							hash: "b".repeat(64),
						},
						policyContext: {
							mode: "manual",
							safetyPosture: "strict",
							effectivePolicySource: "test",
						},
						outcome: "success",
						exit: {
							code: 0,
							classification: "ok",
						},
						artifactRefs: [
							{
								type: "rollback-events",
								path: canonicalRollbackPath,
								checksum: "c".repeat(64),
							},
						],
						preconditions: {},
						provenance: {
							repoContractHash: "d".repeat(64),
						},
					},
					null,
					2,
				),
			);
			const event = {
				schemaVersion: "agent-run-event/v1" as const,
				runId: malformedRunId,
				eventId: `evt-${malformedRunId}`,
				timestamp: now,
				eventType: "decision" as const,
				status: "completed" as const,
				severity: "info" as const,
				payload: {
					origin: "pilot-rollback",
				},
			};
			writeFileSync(
				join(malformedRunDir, "events.jsonl"),
				`${JSON.stringify({ ...event, eventHash: computeEventHash(event) })}\n`,
				"utf-8",
			);

			const result = runPilotEvaluate({
				artifactsDir,
				runRecordsDir,
				lane: "health",
			});
			expect(result.ok).toBe(true);
			expect(result.result?.outcome).toBe("hold");
			expect(result.result?.holdReasons).toContainEqual(
				expect.stringContaining("drift detected"),
			);
			expect(
				result.result?.warnings.some((warning) =>
					/processPolicyHash/i.test(warning),
				),
			).toBe(true);
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
