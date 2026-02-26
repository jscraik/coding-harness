/**
 * Pilot Rollback CLI command
 *
 * Machine-proof rollback interface for transitioning between
 * autonomous and manual remediation modes. Writes completion
 * marker artifacts for verification.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import type { PilotRollbackPolicy } from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION: 1,
	PRECONDITION: 2,
	INTERNAL: 10,
} as const;

export type PilotMode = "autonomous" | "manual";

export interface RollbackMarker {
	schemaVersion: "pilot-rollback-marker/v1";
	incidentId: string;
	modeBefore: PilotMode;
	modeAfter: PilotMode;
	requestedAt: string;
	completedAt: string;
	rollbackEventsId: string;
	result: "success" | "failed";
	reason: string;
}

export interface RollbackEventsRecord {
	id: string;
	incidentId: string;
	modeTransition: { from: PilotMode; to: PilotMode };
	triggeredAt: string;
	triggeredBy: "automation" | "manual";
	triggerReason: string;
}

export interface RollbackEventsStore {
	schemaVersion: "pilot-rollback-events/v1";
	events: RollbackEventsRecord[];
}

export interface PilotRollbackOptions {
	/** Incident ID that triggered the rollback */
	incidentId: string;
	/** Target mode to transition to */
	mode: PilotMode;
	/** Path to contract file */
	contractPath?: string;
	/** Path to artifacts directory */
	artifactsDir?: string;
	/** Path to output JSON file for result */
	outputPath?: string;
	/** Output as JSON to stdout */
	json?: boolean;
	/** Reason for rollback */
	reason?: string;
}

export interface PilotRollbackResult {
	ok: true;
	output: {
		incidentId: string;
		modeBefore: PilotMode;
		modeAfter: PilotMode;
		requestedAt: string;
		completedAt: string;
		rollbackEventsId: string;
		result: "success";
		reason: string;
	};
}

export interface PilotRollbackError {
	ok: false;
	error: {
		code: "E_VALIDATION" | "E_PRECONDITION" | "E_NOT_FOUND" | "E_INTERNAL";
		message: string;
		context?: Record<string, unknown>;
	};
}

const DEFAULT_ARTIFACTS_DIR = "artifacts/pilot";
const DEFAULT_CONTRACT_PATH = "harness.contract.json";
const ROLLBACK_MARKER_FILE = "rollback-marker.json";
const ROLLBACK_EVENTS_FILE = "rollback-events.jsonl";

function nowIso(): string {
	return new Date().toISOString();
}

function generateEventsId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	return `rollback-${timestamp}-${random}`;
}

function normalizePath(baseDir: string, userPath: string): string {
	try {
		return validatePath(baseDir, userPath);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			throw new Error(`Path traversal detected: ${userPath}`);
		}
		throw error;
	}
}

function resolveArtifactsDir(artifactsDir?: string): string {
	const base = process.cwd();
	if (artifactsDir) {
		return normalizePath(base, resolve(base, artifactsDir));
	}
	return resolve(base, DEFAULT_ARTIFACTS_DIR);
}

function readCurrentMode(contractPath: string): PilotMode {
	try {
		const contract = loadContract(contractPath);
		// Check if pilotRollbackPolicy exists and has a mode field
		const policy = contract.pilotRollbackPolicy as
			| PilotRollbackPolicy
			| undefined;
		return policy?.mode ?? "manual";
	} catch {
		// Default to manual if contract can't be loaded
		return "manual";
	}
}

function appendRollbackEvent(
	eventsPath: string,
	record: RollbackEventsRecord,
): void {
	mkdirSync(dirname(eventsPath), { recursive: true });
	const line = JSON.stringify(record) + "\n";
	writeFileSync(eventsPath, line, { flag: "a", encoding: "utf-8" });
}

function writeRollbackMarker(markerPath: string, marker: RollbackMarker): void {
	mkdirSync(dirname(markerPath), { recursive: true });
	writeFileSync(markerPath, JSON.stringify(marker, null, 2), "utf-8");
}

export async function runPilotRollback(
	options: PilotRollbackOptions,
): Promise<PilotRollbackResult | PilotRollbackError> {
	try {
		// 1. Validate incident ID
		if (!options.incidentId?.trim()) {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: "Missing required option: --incident-id",
				},
			};
		}

		// 2. Validate mode
		if (options.mode !== "autonomous" && options.mode !== "manual") {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: `Invalid mode: ${options.mode}. Must be 'autonomous' or 'manual'`,
				},
			};
		}

		// 3. Resolve paths
		const cwd = process.cwd();
		const contractPath = resolve(
			cwd,
			options.contractPath ?? DEFAULT_CONTRACT_PATH,
		);
		const artifactsDir = resolveArtifactsDir(options.artifactsDir);

		// 4. Check contract exists
		if (!existsSync(contractPath)) {
			return {
				ok: false,
				error: {
					code: "E_PRECONDITION",
					message: `Contract not found: ${contractPath}`,
					context: { contractPath },
				},
			};
		}

		// 5. Read current mode from contract
		const modeBefore = readCurrentMode(contractPath);

		// 6. Validate transition (v1: any transition is allowed, but we record it)
		// In future versions, we may enforce specific transition rules
		const requestedAt = nowIso();

		// 7. Generate event ID and create event record
		const rollbackEventsId = generateEventsId();
		const eventsPath = resolve(artifactsDir, ROLLBACK_EVENTS_FILE);

		const eventRecord: RollbackEventsRecord = {
			id: rollbackEventsId,
			incidentId: options.incidentId,
			modeTransition: { from: modeBefore, to: options.mode },
			triggeredAt: requestedAt,
			triggeredBy: "manual",
			triggerReason: options.reason ?? "Manual rollback requested",
		};

		// 8. Append event to events store
		appendRollbackEvent(eventsPath, eventRecord);

		// 9. Write completion marker
		const completedAt = nowIso();
		const markerPath = resolve(artifactsDir, ROLLBACK_MARKER_FILE);

		const marker: RollbackMarker = {
			schemaVersion: "pilot-rollback-marker/v1",
			incidentId: options.incidentId,
			modeBefore,
			modeAfter: options.mode,
			requestedAt,
			completedAt,
			rollbackEventsId,
			result: "success",
			reason: options.reason ?? "Manual rollback requested",
		};

		writeRollbackMarker(markerPath, marker);

		// 10. Write to output file if specified
		if (options.outputPath) {
			const outputPath = resolve(cwd, options.outputPath);
			mkdirSync(dirname(outputPath), { recursive: true });
			writeFileSync(outputPath, JSON.stringify(marker, null, 2), "utf-8");
		}

		return {
			ok: true,
			output: {
				incidentId: options.incidentId,
				modeBefore,
				modeAfter: options.mode,
				requestedAt,
				completedAt,
				rollbackEventsId,
				result: "success",
				reason: marker.reason,
			},
		};
	} catch (error) {
		if (error instanceof PathTraversalError) {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: "Path traversal detected in provided paths",
				},
			};
		}
		return {
			ok: false,
			error: {
				code: "E_INTERNAL",
				message: `Rollback failed: ${sanitizeError(error)}`,
			},
		};
	}
}

export async function runPilotRollbackCLI(
	options: PilotRollbackOptions,
): Promise<number> {
	const result = await runPilotRollback(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ ok: false, error: result.error }));
		} else {
			console.error(result.error.message);
			if (result.error.context) {
				console.error(`Context: ${JSON.stringify(result.error.context)}`);
			}
		}

		switch (result.error.code) {
			case "E_VALIDATION":
				return EXIT_CODES.VALIDATION;
			case "E_PRECONDITION":
			case "E_NOT_FOUND":
				return EXIT_CODES.PRECONDITION;
			default:
				return EXIT_CODES.INTERNAL;
		}
	}

	const { output } = result;

	if (options.json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "pilot-rollback-result/v1",
					ok: true,
					output,
				},
				null,
				2,
			),
		);
	} else {
		console.info("Rollback completed:");
		console.info(`  Incident: ${output.incidentId}`);
		console.info(`  Mode: ${output.modeBefore} → ${output.modeAfter}`);
		console.info(`  Events ID: ${output.rollbackEventsId}`);
		console.info(`  Completed at: ${output.completedAt}`);
		console.info(`  Reason: ${output.reason}`);
	}

	return EXIT_CODES.SUCCESS;
}
