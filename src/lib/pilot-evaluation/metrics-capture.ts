/**
 * Pilot metrics capture functions
 *
 * Reads artifact files and computes metrics for pilot evaluation.
 */

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import {
	type LoadedRunRecordBundle,
	loadRunRecordBundle,
} from "../contract/run-records.js";
import {
	type PilotAdapterRegistry,
	getAdapterRegistryEntry,
	loadAdapterRegistry,
} from "./registries.js";
import type {
	IncidentRecord,
	PendingIncident,
	PilotEvaluationIngestion,
	PilotMetrics,
	PrLeadTimeEntry,
	RemediationEvent,
	RollbackEvent,
} from "./types.js";
import { ARTIFACT_FILES, SUPPORTED_ARTIFACT_SCHEMAS } from "./types.js";

// Re-export types for consumers
export type {
	PrLeadTimeEntry,
	RemediationEvent,
	RollbackEvent,
	IncidentRecord,
	PendingIncident,
} from "./types.js";

interface CanonicalArtifactDiscovery {
	paths: string[];
	runIds: string[];
	driftWarnings: string[];
	usedCanonical: boolean;
}

interface CanonicalBundleScan {
	bundles: LoadedRunRecordBundle[];
	errors: string[];
	runIdCollisionCount: number;
	sensitiveFieldLeakCount: number;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function resolveRunRecordRoots(
	artifactsDir: string,
	runRecordsDir?: string,
): string[] {
	if (runRecordsDir) {
		return [resolve(process.cwd(), runRecordsDir)];
	}
	const defaults = [
		resolve(process.cwd(), "artifacts/agent-runs"),
		resolve(artifactsDir, "agent-runs"),
	];
	return unique(defaults);
}

function isWithinRoot(candidate: string, root: string): boolean {
	return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function safeArtifactPath(
	pathLike: string,
	allowedRoots: string[],
): string | null {
	const resolved = resolve(pathLike);
	return allowedRoots.some((root) => isWithinRoot(resolved, root))
		? resolved
		: null;
}

function discoverCanonicalArtifacts(options: {
	artifactsDir: string;
	runRecordsDir?: string;
	command: string;
	artifactTypes: string[];
	expectedFileName: string;
}): CanonicalArtifactDiscovery {
	const driftWarnings: string[] = [];
	const runIds: string[] = [];
	const artifactPaths: string[] = [];
	const roots = resolveRunRecordRoots(
		options.artifactsDir,
		options.runRecordsDir,
	);
	const workspaceRoot = resolve(process.cwd());
	const artifactRoot = resolve(options.artifactsDir);
	const allowedRoots = unique(
		[workspaceRoot, artifactRoot, ...roots].map((root) => resolve(root)),
	);
	let usedCanonical = false;

	for (const root of roots) {
		if (!existsSync(root)) {
			continue;
		}

		const entries = readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();

		for (const runId of entries) {
			try {
				const bundle = loadRunRecordBundle({
					runId,
					baseDir: root,
					...(isWithinRoot(root, workspaceRoot)
						? {}
						: {
								cwd: (() => {
									try {
										return realpathSync(dirname(root));
									} catch {
										return dirname(root);
									}
								})(),
							}),
				});
				if (bundle.manifest.command !== options.command) {
					continue;
				}

				usedCanonical = true;
				runIds.push(runId);

				const refs = bundle.manifest.artifactRefs.filter((ref) =>
					options.artifactTypes.includes(ref.type),
				);
				if (refs.length === 0) {
					driftWarnings.push(
						`${options.command}:${runId}: missing typed artifactRefs for ${options.expectedFileName}`,
					);
					continue;
				}

				for (const ref of refs) {
					if (basename(ref.path) !== options.expectedFileName) {
						driftWarnings.push(
							`${options.command}:${runId}: artifactRef ${ref.path} does not match expected ${options.expectedFileName}`,
						);
						continue;
					}
					const safePath = safeArtifactPath(ref.path, allowedRoots);
					if (!safePath) {
						driftWarnings.push(
							`${options.command}:${runId}: artifactRef path escapes workspace (${ref.path})`,
						);
						continue;
					}
					artifactPaths.push(safePath);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				driftWarnings.push(
					`canonical bundle load failed for ${runId}: ${message}`,
				);
			}
		}
	}

	return {
		paths: unique(artifactPaths),
		runIds: unique(runIds),
		driftWarnings,
		usedCanonical,
	};
}

function scanCanonicalBundles(
	artifactsDir: string,
	runRecordsDir?: string,
): CanonicalBundleScan {
	const roots = resolveRunRecordRoots(artifactsDir, runRecordsDir);
	const workspaceRoot = resolve(process.cwd());
	const seenRunIds = new Map<string, string>();
	const bundles: LoadedRunRecordBundle[] = [];
	const errors: string[] = [];
	let runIdCollisionCount = 0;
	let sensitiveFieldLeakCount = 0;

	for (const root of roots) {
		if (!existsSync(root)) {
			continue;
		}

		const entries = readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();

		for (const runId of entries) {
			const existingRoot = seenRunIds.get(runId);
			if (existingRoot && existingRoot !== root) {
				runIdCollisionCount++;
				errors.push(
					`runId collision detected for ${runId} in ${existingRoot} and ${root}`,
				);
				continue;
			}
			seenRunIds.set(runId, root);

			try {
				const bundle = loadRunRecordBundle({
					runId,
					baseDir: root,
					...(isWithinRoot(root, workspaceRoot)
						? {}
						: {
								cwd: (() => {
									try {
										return realpathSync(dirname(root));
									} catch {
										return dirname(root);
									}
								})(),
							}),
				});
				bundles.push(bundle);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`canonical bundle load failed for ${runId}: ${message}`);
				if (/sensitive/i.test(message)) {
					sensitiveFieldLeakCount++;
				}
			}
		}
	}

	return {
		bundles,
		errors,
		runIdCollisionCount,
		sensitiveFieldLeakCount,
	};
}

/**
 * Read and parse JSON file with error handling
 */
function readJsonFile<T>(filePath: string): T | null {
	if (!existsSync(filePath)) {
		return null;
	}
	try {
		const content = readFileSync(filePath, "utf-8");
		return JSON.parse(content) as T;
	} catch {
		return null;
	}
}

/**
 * Read JSONL file and parse entries
 */
function readJsonlFile<T>(filePath: string): {
	data: T[];
	error?: string;
} {
	if (!existsSync(filePath)) {
		return { data: [] };
	}
	const content = readFileSync(filePath, "utf-8");
	const lines = content
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	const data: T[] = [];
	for (let idx = 0; idx < lines.length; idx++) {
		const line = lines[idx];
		if (line === undefined) continue;
		try {
			data.push(JSON.parse(line) as T);
		} catch {
			return {
				data: [],
				error: `${filePath}: invalid JSONL at line ${idx + 1}`,
			};
		}
	}
	return { data };
}

/**
 * Validate artifact schema version
 */
function validateSchema(
	schemaVersion: string | undefined,
	expectedSchema: string,
	fileName: string,
): { valid: boolean; error?: string } {
	if (!schemaVersion) {
		return { valid: false, error: `${fileName}: missing schemaVersion` };
	}
	if (schemaVersion !== expectedSchema) {
		return {
			valid: false,
			error: `${fileName}: unsupported schema version ${schemaVersion}, expected ${expectedSchema}`,
		};
	}
	return { valid: true };
}

/**
 * Calculate median from array of numbers
 */
function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	const midVal = sorted[mid];
	const midMinusOneVal = sorted[mid - 1];
	if (midVal === undefined) return 0;
	return sorted.length % 2 !== 0
		? midVal
		: ((midMinusOneVal ?? 0) + midVal) / 2;
}

/**
 * Calculate p75 (75th percentile) from array of numbers
 */
function p75(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.ceil(sorted.length * 0.75) - 1;
	const val = sorted[Math.max(0, index)];
	return val ?? 0;
}

/**
 * Calculate p95 (95th percentile) from array of numbers
 */
function p95(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.ceil(sorted.length * 0.95) - 1;
	const val = sorted[Math.max(0, index)];
	return val ?? 0;
}

/**
 * Simple bootstrap confidence interval (percentile method)
 */
function bootstrapCi(
	values: number[],
	confidence = 0.95,
	iterations = 1000,
): { lower: number; upper: number; halfWidth: number } {
	if (values.length < 2) {
		return { lower: 0, upper: 0, halfWidth: 0 };
	}

	const means: number[] = [];
	for (let i = 0; i < iterations; i++) {
		// Resample with replacement
		const sample: number[] = [];
		for (let j = 0; j < values.length; j++) {
			const idx = Math.floor(Math.random() * values.length);
			const val = values[idx];
			if (val !== undefined) {
				sample.push(val);
			}
		}
		if (sample.length > 0) {
			means.push(median(sample));
		}
	}

	if (means.length === 0) {
		return { lower: 0, upper: 0, halfWidth: 0 };
	}

	means.sort((a, b) => a - b);
	const alpha = (1 - confidence) / 2;
	const lowerIdx = Math.floor(means.length * alpha);
	const upperIdx = Math.floor(means.length * (1 - alpha));

	const lower = means[lowerIdx] ?? 0;
	const upper = means[upperIdx] ?? 0;
	const halfWidth = (upper - lower) / 2;

	return { lower, upper, halfWidth };
}

/**
 * Load PR lead time data from artifact
 */
export function loadPrLeadTimeData(artifactsDir: string): {
	data: PrLeadTimeEntry[];
	errors: string[];
} {
	const errors: string[] = [];
	const filePath = join(artifactsDir, ARTIFACT_FILES.PR_LEAD_TIME);
	const data = readJsonFile<{
		schemaVersion: string;
		entries: PrLeadTimeEntry[];
	}>(filePath);

	if (!data) {
		return {
			data: [],
			errors: [...errors, `Missing or invalid ${ARTIFACT_FILES.PR_LEAD_TIME}`],
		};
	}

	const validation = validateSchema(
		data.schemaVersion,
		SUPPORTED_ARTIFACT_SCHEMAS.PR_LEAD_TIME,
		ARTIFACT_FILES.PR_LEAD_TIME,
	);
	if (!validation.valid && validation.error) {
		errors.push(validation.error);
		return { data: [], errors };
	}

	return { data: data.entries, errors };
}

/**
 * Load remediation events from artifact
 */
export function loadRemediationEvents(
	artifactsDir: string,
	options?: { artifactPaths?: string[] },
): {
	data: RemediationEvent[];
	errors: string[];
} {
	const errors: string[] = [];
	const paths =
		options?.artifactPaths && options.artifactPaths.length > 0
			? options.artifactPaths
			: [join(artifactsDir, ARTIFACT_FILES.REMEDIATION_EVENTS)];
	const data: RemediationEvent[] = [];

	for (const filePath of paths) {
		const parsed = readJsonlFile<RemediationEvent>(filePath);
		if (parsed.error) {
			errors.push(parsed.error);
			continue;
		}
		data.push(...parsed.data);
	}

	// Validate schema for each entry
	for (const event of data) {
		const validation = validateSchema(
			event.schemaVersion,
			SUPPORTED_ARTIFACT_SCHEMAS.REMEDIATION_EVENTS,
			ARTIFACT_FILES.REMEDIATION_EVENTS,
		);
		if (!validation.valid && validation.error) {
			errors.push(validation.error);
		}
	}

	return { data, errors };
}

/**
 * Load rollback events from artifact
 */
export function loadRollbackEvents(
	artifactsDir: string,
	options?: { artifactPaths?: string[] },
): {
	data: RollbackEvent[];
	errors: string[];
} {
	const errors: string[] = [];
	const paths =
		options?.artifactPaths && options.artifactPaths.length > 0
			? options.artifactPaths
			: [join(artifactsDir, ARTIFACT_FILES.ROLLBACK_EVENTS)];
	const data: RollbackEvent[] = [];

	for (const filePath of paths) {
		const parsed = readJsonlFile<RollbackEvent>(filePath);
		if (parsed.error) {
			errors.push(parsed.error);
			continue;
		}
		data.push(...parsed.data);
	}

	for (const event of data) {
		const validation = validateSchema(
			event.schemaVersion,
			SUPPORTED_ARTIFACT_SCHEMAS.ROLLBACK_EVENTS,
			ARTIFACT_FILES.ROLLBACK_EVENTS,
		);
		if (!validation.valid && validation.error) {
			errors.push(validation.error);
		}
	}

	return { data, errors };
}

/**
 * Load incidents from artifact
 */
export function loadIncidents(artifactsDir: string): {
	data: IncidentRecord[];
	errors: string[];
} {
	const errors: string[] = [];
	const filePath = join(artifactsDir, ARTIFACT_FILES.INCIDENTS);
	const { data, error } = readJsonlFile<IncidentRecord>(filePath);
	if (error) {
		errors.push(error);
		return { data: [], errors };
	}

	for (const incident of data) {
		const validation = validateSchema(
			incident.schemaVersion,
			SUPPORTED_ARTIFACT_SCHEMAS.INCIDENTS,
			ARTIFACT_FILES.INCIDENTS,
		);
		if (!validation.valid && validation.error) {
			errors.push(validation.error);
		}
	}

	return { data, errors };
}

/**
 * Load pending incidents from artifact
 */
export function loadPendingIncidents(artifactsDir: string): {
	data: PendingIncident[];
	errors: string[];
} {
	const errors: string[] = [];
	const filePath = join(artifactsDir, ARTIFACT_FILES.PENDING_INCIDENTS);

	if (!existsSync(filePath)) {
		return { data: [], errors: [] }; // Pending incidents file is optional
	}

	const data = readJsonFile<PendingIncident[]>(filePath);
	if (!data) {
		errors.push(`Invalid ${ARTIFACT_FILES.PENDING_INCIDENTS}`);
		return { data: [], errors };
	}

	return { data, errors };
}

/**
 * Calculate PR lead time metrics
 */
export function calculateLeadTimeMetrics(
	pilotEntries: PrLeadTimeEntry[],
	baselineEntries: PrLeadTimeEntry[],
): {
	p50Improvement: number;
	p75Improvement: number;
	p50CiHalfWidth: number;
	p75CiHalfWidth: number;
	sampleSize: number;
} {
	const pilotLeadTimes = pilotEntries
		.filter(
			(e): e is PrLeadTimeEntry & { leadTimeHours: number } =>
				e.leadTimeHours !== null && e.pilotEligible,
		)
		.map((e) => e.leadTimeHours);

	const baselineLeadTimes = baselineEntries
		.filter(
			(e): e is PrLeadTimeEntry & { leadTimeHours: number } =>
				e.leadTimeHours !== null,
		)
		.map((e) => e.leadTimeHours);

	if (pilotLeadTimes.length === 0 || baselineLeadTimes.length === 0) {
		return {
			p50Improvement: 0,
			p75Improvement: 0,
			p50CiHalfWidth: 1,
			p75CiHalfWidth: 1,
			sampleSize: 0,
		};
	}

	const pilotP50 = median(pilotLeadTimes);
	const pilotP75 = p75(pilotLeadTimes);
	const baselineP50 = median(baselineLeadTimes);
	const baselineP75 = p75(baselineLeadTimes);

	// Improvement is negative (reduction in lead time)
	const p50Improvement =
		baselineP50 > 0 ? (pilotP50 - baselineP50) / baselineP50 : 0;
	const p75Improvement =
		baselineP75 > 0 ? (pilotP75 - baselineP75) / baselineP75 : 0;

	// Bootstrap CI
	const p50Ci = bootstrapCi(pilotLeadTimes);
	const p75Ci = bootstrapCi(pilotLeadTimes);

	return {
		p50Improvement,
		p75Improvement,
		p50CiHalfWidth: p50Ci.halfWidth,
		p75CiHalfWidth: p75Ci.halfWidth,
		sampleSize: pilotLeadTimes.length,
	};
}

/**
 * Calculate rollback reliability
 */
export function calculateRollbackReliability(events: RollbackEvent[]): number {
	const triggers = events.filter(
		(e) => e.triggerType === "drill" || e.triggerType === "real",
	);
	if (triggers.length === 0) return 1; // No triggers = 100% reliability by default

	const successful = triggers.filter((e) => e.result === "success").length;
	return successful / triggers.length;
}

export function countRollbackTriggers(events: RollbackEvent[]): number {
	return events.filter(
		(e) => e.triggerType === "drill" || e.triggerType === "real",
	).length;
}

export function calculateInterventionRate(
	bundles: LoadedRunRecordBundle[],
): number {
	if (bundles.length === 0) {
		return 0;
	}

	const runIds = new Set<string>();
	for (const bundle of bundles) {
		if (
			bundle.events.some(
				(event) =>
					event.eventType === "intervention" &&
					(event.status === "completed" || event.status === "passed"),
			)
		) {
			runIds.add(bundle.manifest.runId);
		}
	}

	return runIds.size / bundles.length;
}

export function calculateThrashRate(bundles: LoadedRunRecordBundle[]): number {
	if (bundles.length === 0) {
		return 0;
	}

	let thrashCount = 0;
	for (const bundle of bundles) {
		const hasRetry = bundle.events.some((event) => event.eventType === "retry");
		const hasManualInterventionOutcome =
			bundle.manifest.outcome === "hold" ||
			bundle.manifest.outcome === "rollback";
		if (hasRetry || hasManualInterventionOutcome) {
			thrashCount++;
		}
	}

	return thrashCount / bundles.length;
}

export function calculateCanonicalEvidenceCompleteness(
	bundles: LoadedRunRecordBundle[],
): number {
	if (bundles.length === 0) {
		return 1;
	}

	let complete = 0;
	for (const bundle of bundles) {
		const hasArtifactRefs = bundle.manifest.artifactRefs.length > 0;
		const hasDualProvenance =
			Boolean(bundle.manifest.provenance.repoContractHash) &&
			Boolean(bundle.manifest.provenance.processPolicyHash);
		if (hasArtifactRefs && hasDualProvenance) {
			complete++;
		}
	}

	return complete / bundles.length;
}

/**
 * Count high-risk automation incidents
 */
export function countHighRiskAutomationIncidents(
	incidents: IncidentRecord[],
): number {
	return incidents.filter(
		(i) => i.severity === "high" && i.causality === "automation_confirmed",
	).length;
}

/**
 * Count unresolved critical incidents
 */
export function countUnresolvedCriticalIncidents(
	incidents: IncidentRecord[],
	pending: PendingIncident[],
): number {
	// Count unresolved high-severity incidents
	const unresolvedIncidents = incidents.filter(
		(i) => i.severity === "high" && i.resolvedAt === null,
	).length;

	// Add pending incidents that are high severity
	const pendingHigh = pending.filter((p) => p.severity === "high").length;

	return unresolvedIncidents + pendingHigh;
}

/**
 * Calculate incident classification latency p95
 */
export function calculateClassificationLatency(
	incidents: IncidentRecord[],
): number {
	const latencies: number[] = [];

	for (const incident of incidents) {
		if (incident.classifiedAt && incident.openedAt) {
			const opened = new Date(incident.openedAt).getTime();
			const classified = new Date(incident.classifiedAt).getTime();
			const hours = (classified - opened) / (1000 * 60 * 60);
			if (hours >= 0) {
				latencies.push(hours);
			}
		}
	}

	if (latencies.length === 0) return 0;
	return p95(latencies);
}

/**
 * Calculate per-repo sample sizes
 */
export function calculateRepoSampleSizes(
	entries: PrLeadTimeEntry[],
): Record<string, number> {
	const repoCounts: Record<string, number> = {};

	for (const entry of entries) {
		if (entry.pilotEligible && entry.leadTimeHours !== null) {
			repoCounts[entry.repo] = (repoCounts[entry.repo] || 0) + 1;
		}
	}

	return repoCounts;
}

/**
 * Calculate evidence completeness ratio
 */
export function calculateEvidenceCompleteness(
	leadTimeData: PrLeadTimeEntry[],
	remediationData: RemediationEvent[],
	incidentsData: IncidentRecord[],
): number {
	// Check required fields presence across artifacts
	let totalFields = 0;
	let presentFields = 0;

	// Lead time required fields
	for (const entry of leadTimeData) {
		const requiredFields = ["prNumber", "repo", "createdAt", "headSha"];
		for (const field of requiredFields) {
			totalFields++;
			if ((entry as unknown as Record<string, unknown>)[field] !== undefined) {
				presentFields++;
			}
		}
	}

	// Remediation required fields
	for (const event of remediationData) {
		const requiredFields = [
			"prNumber",
			"repo",
			"headSha",
			"provider",
			"severity",
			"action",
		];
		for (const field of requiredFields) {
			totalFields++;
			if ((event as unknown as Record<string, unknown>)[field] !== undefined) {
				presentFields++;
			}
		}
	}

	// Incident required fields
	for (const incident of incidentsData) {
		const requiredFields = ["incidentId", "severity", "causality", "openedAt"];
		for (const field of requiredFields) {
			totalFields++;
			if (
				(incident as unknown as Record<string, unknown>)[field] !== undefined
			) {
				presentFields++;
			}
		}
	}

	if (totalFields === 0) return 1; // No data = assume complete
	return presentFields / totalFields;
}

/**
 * Determine evaluation window dates from data
 */
export function determineWindowDates(leadTimeData: PrLeadTimeEntry[]): {
	windowStart: string;
	windowEnd: string;
} {
	const dates = leadTimeData
		.map((e) => e.createdAt)
		.filter((d): d is string => Boolean(d))
		.sort();

	if (dates.length === 0) {
		const now = new Date().toISOString();
		const datePart = now.split("T")[0] ?? now;
		return { windowStart: datePart, windowEnd: datePart };
	}

	const firstDate = dates[0];
	const lastDate = dates[dates.length - 1];

	return {
		windowStart: firstDate?.split("T")[0] ?? "",
		windowEnd: lastDate?.split("T")[0] ?? "",
	};
}

/**
 * Capture all pilot metrics from artifacts directory
 */
export function capturePilotMetrics(
	artifactsDir: string,
	options?: { runRecordsDir?: string; adapterRegistryPath?: string },
): {
	metrics: PilotMetrics | null;
	errors: string[];
	ingestion: PilotEvaluationIngestion;
	driftWarnings: string[];
} {
	const errors: string[] = [];
	const driftWarnings: string[] = [];
	let adapterRegistry: PilotAdapterRegistry | null = null;

	try {
		adapterRegistry = loadAdapterRegistry(options?.adapterRegistryPath);
	} catch (error) {
		errors.push(error instanceof Error ? error.message : String(error));
	}

	const canonicalBundleScan = scanCanonicalBundles(
		artifactsDir,
		options?.runRecordsDir,
	);
	driftWarnings.push(...canonicalBundleScan.errors);

	const remediationDiscovery = discoverCanonicalArtifacts({
		artifactsDir,
		...(options?.runRecordsDir ? { runRecordsDir: options.runRecordsDir } : {}),
		command: "remediate",
		artifactTypes: ["remediation-events", "legacy-remediation-events"],
		expectedFileName: ARTIFACT_FILES.REMEDIATION_EVENTS,
	});
	driftWarnings.push(...remediationDiscovery.driftWarnings);
	const remediationArtifactPaths =
		remediationDiscovery.paths.length > 0
			? remediationDiscovery.paths
			: [join(artifactsDir, ARTIFACT_FILES.REMEDIATION_EVENTS)];

	const rollbackDiscovery = discoverCanonicalArtifacts({
		artifactsDir,
		...(options?.runRecordsDir ? { runRecordsDir: options.runRecordsDir } : {}),
		command: "pilot-rollback",
		artifactTypes: ["rollback-events", "legacy-rollback-events"],
		expectedFileName: ARTIFACT_FILES.ROLLBACK_EVENTS,
	});
	driftWarnings.push(...rollbackDiscovery.driftWarnings);
	const rollbackArtifactPaths =
		rollbackDiscovery.paths.length > 0
			? rollbackDiscovery.paths
			: [join(artifactsDir, ARTIFACT_FILES.ROLLBACK_EVENTS)];

	const ingestion: PilotEvaluationIngestion = {
		remediationEvents: {
			source:
				remediationDiscovery.paths.length > 0 ? "canonical" : "legacy_adapter",
			adapterVersion:
				remediationDiscovery.paths.length > 0 ? "none" : "legacy-jsonl-v1",
			runIds: remediationDiscovery.runIds,
			mappedArtifactPaths: remediationArtifactPaths,
			driftWarnings: remediationDiscovery.driftWarnings,
			...(() => {
				const entry =
					adapterRegistry &&
					getAdapterRegistryEntry(adapterRegistry, "legacy-jsonl-v1");
				return remediationDiscovery.paths.length > 0 || !entry
					? {}
					: {
							owner: entry.owner,
							introducedAt: entry.introducedAt,
							sunsetBy: entry.sunsetBy,
							blockAfter: entry.blockAfter,
						};
			})(),
		},
		rollbackEvents: {
			source:
				rollbackDiscovery.paths.length > 0 ? "canonical" : "legacy_adapter",
			adapterVersion:
				rollbackDiscovery.paths.length > 0 ? "none" : "legacy-jsonl-v1",
			runIds: rollbackDiscovery.runIds,
			mappedArtifactPaths: rollbackArtifactPaths,
			driftWarnings: rollbackDiscovery.driftWarnings,
			...(() => {
				const entry =
					adapterRegistry &&
					getAdapterRegistryEntry(adapterRegistry, "legacy-jsonl-v1");
				return rollbackDiscovery.paths.length > 0 || !entry
					? {}
					: {
							owner: entry.owner,
							introducedAt: entry.introducedAt,
							sunsetBy: entry.sunsetBy,
							blockAfter: entry.blockAfter,
						};
			})(),
		},
	};

	// Load all artifacts
	const { data: leadTimeData, errors: ltErrors } =
		loadPrLeadTimeData(artifactsDir);
	errors.push(...ltErrors);

	const { data: remediationData, errors: remErrors } = loadRemediationEvents(
		artifactsDir,
		{
			artifactPaths: remediationArtifactPaths,
		},
	);
	errors.push(...remErrors);

	const { data: rollbackData, errors: rbErrors } = loadRollbackEvents(
		artifactsDir,
		{
			artifactPaths: rollbackArtifactPaths,
		},
	);
	errors.push(...rbErrors);

	const { data: incidentsData, errors: incErrors } =
		loadIncidents(artifactsDir);
	errors.push(...incErrors);

	const { data: pendingData, errors: pendErrors } =
		loadPendingIncidents(artifactsDir);
	errors.push(...pendErrors);

	// If we have critical schema errors, return null
	if (
		errors.some(
			(e) =>
				e.includes("missing schemaVersion") ||
				e.includes("unsupported schema") ||
				e.includes("invalid JSONL"),
		)
	) {
		return { metrics: null, errors, ingestion, driftWarnings };
	}

	// Filter pilot-eligible entries
	const pilotEntries = leadTimeData.filter((e) => e.pilotEligible);

	// For baseline, use non-pilot entries or entries before pilot start
	// In v1, we assume baseline is captured separately or from entries with pilotEligible=false
	const baselineEntries = leadTimeData.filter((e) => !e.pilotEligible);

	// Calculate metrics
	const leadTimeMetrics = calculateLeadTimeMetrics(
		pilotEntries,
		baselineEntries,
	);
	const { windowStart, windowEnd } = determineWindowDates(leadTimeData);

	const metrics: PilotMetrics = {
		windowStart,
		windowEnd,
		sampleSize: leadTimeMetrics.sampleSize,
		leadTimeP50Improvement: leadTimeMetrics.p50Improvement,
		leadTimeP75Improvement: leadTimeMetrics.p75Improvement,
		leadTimeP50CiHalfWidth: leadTimeMetrics.p50CiHalfWidth,
		leadTimeP75CiHalfWidth: leadTimeMetrics.p75CiHalfWidth,
		rollbackReliability: calculateRollbackReliability(rollbackData),
		rollbackTriggerCount: countRollbackTriggers(rollbackData),
		interventionRate: calculateInterventionRate(canonicalBundleScan.bundles),
		highRiskAutomationIncidents:
			countHighRiskAutomationIncidents(incidentsData),
		unresolvedCriticalIncidents: countUnresolvedCriticalIncidents(
			incidentsData,
			pendingData,
		),
		incidentClassificationP95Hours:
			calculateClassificationLatency(incidentsData),
		evidenceCompletenessRatio:
			canonicalBundleScan.bundles.length > 0
				? calculateCanonicalEvidenceCompleteness(canonicalBundleScan.bundles)
				: calculateEvidenceCompleteness(
						leadTimeData,
						remediationData,
						incidentsData,
					),
		thrashRate: calculateThrashRate(canonicalBundleScan.bundles),
		sensitiveFieldLeakCount: canonicalBundleScan.sensitiveFieldLeakCount,
		runIdCollisionCount: canonicalBundleScan.runIdCollisionCount,
		repoSampleSizes: calculateRepoSampleSizes(pilotEntries),
	};

	return { metrics, errors, ingestion, driftWarnings };
}
