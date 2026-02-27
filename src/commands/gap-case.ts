import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import {
	DEFAULT_PILOT_GAP_CASE_POLICY,
	type PilotGapCasePolicy,
} from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	USAGE: 2,
	POLICY: 3,
	PARTIAL: 4,
	INTERNAL: 10,
} as const;

export type GapCaseStatus = "open" | "resolved";
export type GapSeverity = "low" | "medium" | "high";

/**
 * Causality classification for incident attribution (v1 pilot)
 * Used to determine if automation was the root cause of an incident.
 */
export type Causality =
	| "automation_confirmed"
	| "automation_possible"
	| "human_or_external"
	| "unknown";

/**
 * Confidence level for causality classification.
 */
export type Confidence = "confirmed" | "probable" | "provisional";

export interface GapCaseRecord {
	id: string;
	incidentId: string;
	owner: string;
	severity: GapSeverity;
	linkedPr: string;
	findingSummary?: string;
	createdAt: string;
	dueAt: string;
	status: GapCaseStatus;
	resolvedBy?: string;
	closedAt?: string;
	closeReason?: string;
	evidence?: string[];
	// Causality fields (Phase 3)
	causality?: Causality;
	confidence?: Confidence;
	causalityUpdatedAt?: string;
	causalityUpdatedBy?: string;
	// Auto-rollback trigger (Phase 4)
	autoRollbackTriggeredAt?: string;
	autoRollbackReason?: string;
}

export interface GapCaseStore {
	version: number;
	cases: GapCaseRecord[];
}

export interface CreateGapCaseOptions {
	action: "create";
	incidentId: string;
	owner: string;
	severity: GapSeverity;
	linkedPr: string;
	findingSummary?: string;
	dueDays?: number;
	caseStore?: string;
	caseIdPrefix?: string;
	caseId?: string;
	evidence?: string[];
	contractPath?: string;
	json?: boolean;
}

export interface ListGapCaseOptions {
	action: "list";
	caseStore?: string;
	contractPath?: string;
	open?: boolean;
	overdue?: boolean;
	unresolvedCausality?: boolean;
	json?: boolean;
}

export interface ResolveGapCaseOptions {
	action: "resolve";
	caseStore?: string;
	contractPath?: string;
	caseId: string;
	incidentId: string;
	resolvedBy: string;
	linkedPr: string;
	evidence?: string[];
	closeReason?: string;
	force?: boolean;
	json?: boolean;
}

export interface UpdateCausalityOptions {
	action: "update-causality";
	caseStore?: string;
	contractPath?: string;
	caseId: string;
	causality: Causality;
	confidence: Confidence;
	updatedBy: string;
	json?: boolean;
}

type GapCaseResultOutput =
	| { action: "create"; caseRecord: GapCaseRecord }
	| { action: "list"; cases: GapCaseRecord[] }
	| { action: "resolve"; caseRecord: GapCaseRecord }
	| { action: "update-causality"; caseRecord: GapCaseRecord };

export interface GapCaseError {
	code: "E_USAGE" | "E_VALIDATION" | "E_POLICY" | "E_NOT_FOUND" | "E_INTERNAL";
	message: string;
	details?: Record<string, unknown>;
}

export type GapCaseResult =
	| { ok: true; output: GapCaseResultOutput }
	| { ok: false; error: GapCaseError };

const DEFAULT_CASE_STORE = ".harness/gap-cases.json";
const DEFAULT_CASE_ID_PREFIX = "gap-";
const HOURS_PER_DAY = 24;
const DEFAULT_ARTIFACTS_DIR = "artifacts/pilot";
const ROLLBACK_MARKER_FILE = "rollback-marker.json";
const ROLLBACK_EVENTS_FILE = "rollback-events.jsonl";

function nowIso(): string {
	return new Date().toISOString();
}

function normalizeCaseStore(caseStore?: string): string {
	return validatePath(process.cwd(), resolve(caseStore || DEFAULT_CASE_STORE));
}

/**
 * Load pilot gap-case policy from contract, with defaults.
 */
function loadPolicy(contractPath?: string): PilotGapCasePolicy {
	if (!contractPath) {
		return DEFAULT_PILOT_GAP_CASE_POLICY;
	}

	try {
		const contract = loadContract(contractPath);
		return contract.pilotGapCasePolicy ?? DEFAULT_PILOT_GAP_CASE_POLICY;
	} catch {
		return DEFAULT_PILOT_GAP_CASE_POLICY;
	}
}

function readCaseStore(filePath: string): GapCaseStore {
	if (!existsSync(filePath)) {
		return { version: 1, cases: [] };
	}

	const raw = readFileSync(filePath, "utf-8");
	const parsed = JSON.parse(raw) as unknown;
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!Array.isArray((parsed as { cases?: unknown }).cases)
	) {
		return { version: 1, cases: [] };
	}
	const cases = (parsed as { cases: unknown[] }).cases.filter(
		(entry): entry is GapCaseRecord =>
			typeof entry === "object" &&
			entry !== null &&
			typeof (entry as { id?: unknown }).id === "string",
	);
	return { version: 1, cases };
}

function writeCaseStore(filePath: string, store: GapCaseStore): void {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Auto-rollback event record for audit trail
 */
interface AutoRollbackEvent {
	id: string;
	incidentId: string;
	caseId: string;
	triggerType: "automatic";
	trigger: "high_risk_automation_confirmed";
	triggeredAt: string;
	modeBefore: "autonomous";
	modeAfter: "manual";
	result: "success";
}

/**
 * Auto-rollback marker for completion verification
 */
interface AutoRollbackMarker {
	schemaVersion: "pilot-rollback-marker/v1";
	incidentId: string;
	caseId: string;
	modeBefore: "autonomous";
	modeAfter: "manual";
	triggerType: "automatic";
	trigger: "high_risk_automation_confirmed";
	requestedAt: string;
	completedAt: string;
	result: "success";
}

/**
 * Generate a unique ID for rollback events
 */
function generateRollbackEventId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	return `rollback-${timestamp}-${random}`;
}

/**
 * Trigger automatic rollback to manual mode.
 * Called when high-severity automation-caused incident is confirmed.
 */
function triggerAutoRollback(
	incidentId: string,
	caseId: string,
	artifactsDir?: string,
): { triggered: boolean; rollbackEventId?: string; error?: string } {
	try {
		const baseDir = process.cwd();
		const artifactsPath = artifactsDir
			? validatePath(baseDir, resolve(baseDir, artifactsDir))
			: resolve(baseDir, DEFAULT_ARTIFACTS_DIR);

		const now = nowIso();
		const rollbackEventId = generateRollbackEventId();

		// Create rollback event record
		const event: AutoRollbackEvent = {
			id: rollbackEventId,
			incidentId,
			caseId,
			triggerType: "automatic",
			trigger: "high_risk_automation_confirmed",
			triggeredAt: now,
			modeBefore: "autonomous",
			modeAfter: "manual",
			result: "success",
		};

		// Append to rollback events
		const eventsPath = resolve(artifactsPath, ROLLBACK_EVENTS_FILE);
		mkdirSync(dirname(eventsPath), { recursive: true });
		const line = JSON.stringify(event) + "\n";
		writeFileSync(eventsPath, line, { flag: "a", encoding: "utf-8" });

		// Write rollback marker
		const marker: AutoRollbackMarker = {
			schemaVersion: "pilot-rollback-marker/v1",
			incidentId,
			caseId,
			modeBefore: "autonomous",
			modeAfter: "manual",
			triggerType: "automatic",
			trigger: "high_risk_automation_confirmed",
			requestedAt: now,
			completedAt: now,
			result: "success",
		};

		const markerPath = resolve(artifactsPath, ROLLBACK_MARKER_FILE);
		mkdirSync(dirname(markerPath), { recursive: true });
		writeFileSync(markerPath, JSON.stringify(marker, null, 2), "utf-8");

		return { triggered: true, rollbackEventId };
	} catch (error) {
		return {
			triggered: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

function nextCaseId(cases: GapCaseRecord[], prefix: string): string {
	const matches = cases
		.map((entry) => {
			if (!entry.id.startsWith(prefix)) {
				return 0;
			}
			const suffix = entry.id.slice(prefix.length);
			const n = Number.parseInt(suffix, 10);
			return Number.isNaN(n) ? 0 : n;
		})
		.filter((value) => value > 0);
	const next = Math.max(0, ...matches, 0) + 1;
	return `${prefix}${next.toString().padStart(3, "0")}`;
}

function computeDueDate(slaHours: number): string {
	const timestamp = Date.now() + slaHours * 60 * 60 * 1000;
	return new Date(timestamp).toISOString();
}

function isOverdue(caseRecord: GapCaseRecord): boolean {
	return new Date(caseRecord.dueAt).getTime() < Date.now();
}

/**
 * Check if a case has unresolved high-severity causality.
 * A case is unresolved if causality is automation_possible or unknown
 * and hasn't been confirmed by dual-review.
 */
function hasUnresolvedCausality(caseRecord: GapCaseRecord): boolean {
	if (caseRecord.severity !== "high") return false;
	if (!caseRecord.causality) return true; // No causality set = unresolved
	if (caseRecord.causality === "automation_possible") return true;
	if (caseRecord.causality === "unknown") return true;
	return false;
}

/**
 * Check if causality downgrade requires dual-review.
 * A downgrade is when moving from automation_confirmed to a lower certainty.
 */
function isCausalityDowngrade(
	current: Causality | undefined,
	newCausality: Causality,
): boolean {
	if (!current) return false;
	const rank: Record<Causality, number> = {
		automation_confirmed: 3,
		automation_possible: 2,
		human_or_external: 1,
		unknown: 0,
	};
	return rank[newCausality] < rank[current];
}

export function runGapCase(
	options:
		| CreateGapCaseOptions
		| ListGapCaseOptions
		| ResolveGapCaseOptions
		| UpdateCausalityOptions,
): GapCaseResult {
	try {
		// Load policy from contract
		const contractPath =
			"contractPath" in options ? options.contractPath : undefined;
		const policy = loadPolicy(contractPath);

		// Check if gap-case is enabled
		if (!policy.enabled) {
			return {
				ok: false,
				error: {
					code: "E_POLICY",
					message:
						"Gap-case tracking is disabled in contract policy (pilotGapCasePolicy.enabled = false)",
				},
			};
		}

		// Use policy's store path if not overridden
		const caseStorePath =
			"caseStore" in options && options.caseStore
				? options.caseStore
				: policy.storePath ?? DEFAULT_CASE_STORE;
		const caseStore = normalizeCaseStore(caseStorePath);
		const store = readCaseStore(caseStore);

		if (options.action === "create") {
			if (!options.incidentId.trim()) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message: "Missing required option: --incident-id",
					},
				};
			}
			if (!options.owner.trim()) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message: "Missing required option: --owner",
					},
				};
			}
			if (
				options.severity !== "low" &&
				options.severity !== "medium" &&
				options.severity !== "high"
			) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message:
							"Invalid required option: --severity must be low|medium|high",
					},
				};
			}
			if (!options.linkedPr.trim()) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message: "Missing required option: --linked-pr",
					},
				};
			}

			const prefix = options.caseIdPrefix ?? DEFAULT_CASE_ID_PREFIX;
			const id = options.caseId ?? nextCaseId(store.cases, prefix);

			// Use policy's SLA hours (converted to days for backward compat) or explicit override
			let slaHours: number;
			if (options.dueDays !== undefined) {
				if (options.dueDays <= 0) {
					return {
						ok: false,
						error: {
							code: "E_VALIDATION",
							message: "Invalid --due-days; must be a positive integer",
						},
					};
				}
				slaHours = options.dueDays * HOURS_PER_DAY;
			} else {
				slaHours = policy.defaultSlaHours;
			}

			const existing = store.cases.find((entry) => entry.id === id);
			if (existing) {
				return {
					ok: false,
					error: {
						code: "E_VALIDATION",
						message: `Gap case ${id} already exists`,
					},
				};
			}

			const caseRecord: GapCaseRecord = {
				id,
				incidentId: options.incidentId,
				owner: options.owner,
				severity: options.severity,
				linkedPr: options.linkedPr,
				createdAt: nowIso(),
				dueAt: computeDueDate(slaHours),
				status: "open",
				...(options.findingSummary
					? { findingSummary: options.findingSummary }
					: {}),
				...(options.evidence ? { evidence: options.evidence } : {}),
			};

			store.cases.push(caseRecord);
			writeCaseStore(caseStore, store);
			return { ok: true, output: { action: "create", caseRecord } };
		}

		if (options.action === "list") {
			let cases = [...store.cases];
			if (options.open) {
				cases = cases.filter((entry) => entry.status === "open");
			}
			if (options.overdue) {
				cases = cases.filter(isOverdue);
			}
			if (options.unresolvedCausality) {
				cases = cases.filter(hasUnresolvedCausality);
			}
			return { ok: true, output: { action: "list", cases } };
		}

		if (options.action === "resolve") {
			const target = store.cases.find((entry) => entry.id === options.caseId);
			if (!target) {
				return {
					ok: false,
					error: {
						code: "E_NOT_FOUND",
						message: `Gap case ${options.caseId} not found`,
					},
				};
			}
			if (target.status === "resolved") {
				return {
					ok: false,
					error: {
						code: "E_POLICY",
						message: `Gap case ${options.caseId} is already resolved`,
					},
				};
			}
			if (
				!options.incidentId.trim() ||
				options.incidentId !== target.incidentId
			) {
				return {
					ok: false,
					error: {
						code: "E_VALIDATION",
						message: "Incident ID does not match existing gap case",
					},
				};
			}
			if (!options.resolvedBy.trim() || !options.linkedPr.trim()) {
				return {
					ok: false,
					error: {
						code: "E_USAGE",
						message: "Missing required option: --resolved-by and --linked-pr",
					},
				};
			}

			// Enforce evidence requirement from policy
			const hasEvidence =
				(options.evidence && options.evidence.length > 0) ||
				(target.evidence && target.evidence.length > 0);

			if (policy.requireClosureEvidence && !hasEvidence && !options.force) {
				return {
					ok: false,
					error: {
						code: "E_POLICY",
						message:
							"Evidence required for closure (pilotGapCasePolicy.requireClosureEvidence = true). Provide --evidence or use --force to override.",
						details: { requireClosureEvidence: true },
					},
				};
			}

			target.status = "resolved";
			target.closedAt = nowIso();
			target.resolvedBy = options.resolvedBy;
			target.closeReason = options.closeReason ?? "fix";
			// Apply evidence and linkedPr from resolve options
			if (options.evidence && options.evidence.length > 0) {
				target.evidence = [...(target.evidence ?? []), ...options.evidence];
			}
			if (options.linkedPr?.trim()) {
				target.linkedPr = options.linkedPr;
			}

			writeCaseStore(caseStore, store);
			return { ok: true, output: { action: "resolve", caseRecord: target } };
		}

		if (options.action === "update-causality") {
			const target = store.cases.find((entry) => entry.id === options.caseId);
			if (!target) {
				return {
					ok: false,
					error: {
						code: "E_NOT_FOUND",
						message: `Gap case ${options.caseId} not found`,
					},
				};
			}

			// Check for causality downgrade (requires explicit acknowledgment)
			if (
				isCausalityDowngrade(target.causality, options.causality) &&
				options.confidence !== "confirmed"
			) {
				return {
					ok: false,
					error: {
						code: "E_POLICY",
						message:
							"Causality downgrade requires --confidence confirmed for audit trail. Downgrading from a higher-certainty causality classification must be explicitly confirmed.",
						details: {
							currentCausality: target.causality,
							newCausality: options.causality,
							requiredConfidence: "confirmed",
						},
					},
				};
			}

			target.causality = options.causality;
			target.confidence = options.confidence;
			target.causalityUpdatedAt = nowIso();
			target.causalityUpdatedBy = options.updatedBy;

			// Auto-rollback trigger: high-severity + automation_confirmed + confirmed confidence
			if (
				target.severity === "high" &&
				options.causality === "automation_confirmed" &&
				options.confidence === "confirmed" &&
				!target.autoRollbackTriggeredAt
			) {
				const rollbackResult = triggerAutoRollback(
					target.incidentId,
					target.id,
					policy.artifactsDir,
				);
				if (rollbackResult.triggered) {
					target.autoRollbackTriggeredAt = nowIso();
					target.autoRollbackReason =
						"Automatic rollback triggered: high-severity automation-caused incident confirmed";
				}
			}

			writeCaseStore(caseStore, store);
			return {
				ok: true,
				output: { action: "update-causality", caseRecord: target },
			};
		}

		return {
			ok: false,
			error: {
				code: "E_INTERNAL",
				message: "Unknown gap-case action",
			},
		};
	} catch (error) {
		if (error instanceof PathTraversalError) {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: "Invalid --case-store path (path traversal detected)",
				},
			};
		}
		if (error instanceof SyntaxError) {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: `Could not parse gap-case store: ${sanitizeError(error)}`,
				},
			};
		}
		return {
			ok: false,
			error: {
				code: "E_INTERNAL",
				message: `Could not update gap-case state: ${sanitizeError(error)}`,
			},
		};
	}
}

export function runGapCaseCLI(
	options:
		| CreateGapCaseOptions
		| ListGapCaseOptions
		| ResolveGapCaseOptions
		| UpdateCausalityOptions,
): number {
	const result = runGapCase(options);
	if (!result.ok) {
		// Output only JSON or only plain text, not both
		if ("json" in options && options.json) {
			console.error(JSON.stringify({ error: result.error }));
		} else {
			console.error(result.error.message);
			if (result.error.details) {
				console.error(`Details: ${JSON.stringify(result.error.details)}`);
			}
		}
		switch (result.error.code) {
			case "E_USAGE":
			case "E_VALIDATION":
				return EXIT_CODES.USAGE;
			case "E_POLICY":
			case "E_NOT_FOUND":
				return EXIT_CODES.POLICY;
			default:
				return EXIT_CODES.INTERNAL;
		}
	}

	if ("json" in options && options.json) {
		console.info(
			JSON.stringify({
				schema: "harness.gap-case.v1",
				meta: {
					tool: "harness-gap-case",
					timestamp: new Date().toISOString(),
				},
				status: "success",
				summary: `Gap-case ${result.output.action} complete`,
				data: result.output,
				errors: [],
			}),
		);
		return EXIT_CODES.SUCCESS;
	}

	switch (result.output.action) {
		case "create":
			console.info(`Created gap case ${result.output.caseRecord.id}`);
			console.info(`incident: ${result.output.caseRecord.incidentId}`);
			console.info(`dueAt: ${result.output.caseRecord.dueAt}`);
			break;
		case "list":
			console.info(
				`Gap cases: ${result.output.cases.length} record(s) in ${normalizeCaseStore(
					"caseStore" in options ? options.caseStore : undefined,
				)}`,
			);
			for (const entry of result.output.cases) {
				const causality = entry.causality ? ` [${entry.causality}]` : "";
				console.info(
					`${entry.id}\t${entry.status}\t${entry.incidentId}\t${entry.owner}${causality}`,
				);
			}
			break;
		case "resolve":
			console.info(`Resolved gap case ${result.output.caseRecord.id}`);
			console.info(`closedAt: ${result.output.caseRecord.closedAt}`);
			break;
		case "update-causality":
			console.info(`Updated causality for ${result.output.caseRecord.id}`);
			console.info(`causality: ${result.output.caseRecord.causality}`);
			console.info(`confidence: ${result.output.caseRecord.confidence}`);
			break;
	}
	return EXIT_CODES.SUCCESS;
}
