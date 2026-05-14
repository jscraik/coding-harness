/**
 * Gap-case CLI command
 *
 * Minimal incident → gap-case workflow for v1 pilot.
 * Supports open and resolve actions with contract-gated behavior.
 */

import type { RiskTier } from "../lib/contract/types.js";
import type {
	GapCaseOpenOptions,
	GapCaseResolveOptions,
	GapCaseResult,
} from "../lib/gap-case/types.js";
import { GAP_CASE_EXIT_CODES } from "../lib/gap-case/types.js";
import {
	findExistingCase,
	generateCaseId,
	isValidHttpsUrl,
	isValidSeverity,
	isValidSha,
	loadGapCasePolicy,
	loadStore,
	resolveStorePath,
	saveStore,
} from "./gap-case-internal.js";

/**
 * Validate all required fields for opening a gap-case.
 * @returns A GapCaseResult error if validation fails, otherwise undefined.
 */
function validateOpenOptions(
	options: GapCaseOpenOptions,
): GapCaseResult | undefined {
	if (!options.incidentId?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "incidentId is required" },
		};
	}

	if (!options.summary?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "summary is required" },
		};
	}

	if (!options.owner?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "owner is required" },
		};
	}

	if (!options.severity || !isValidSeverity(options.severity)) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "severity must be one of: high, medium, low",
			},
		};
	}

	if (options.headSha && !isValidSha(options.headSha)) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "headSha must be a valid 40-character hex SHA",
			},
		};
	}

	if (options.slaHours !== undefined) {
		if (
			!Number.isInteger(options.slaHours) ||
			options.slaHours <= 0 ||
			options.slaHours > 8760
		) {
			return {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: "slaHours must be a positive integer (max 8760)",
				},
			};
		}
	}

	return undefined;
}

/**
 * Create a new gap-case record, add it to the store, and persist.
 */
function persistNewGapCase(
	options: GapCaseOpenOptions,
	policy: import("../lib/contract/types.js").PilotGapCasePolicy,
	store: import("../lib/gap-case/types.js").GapCaseStoreV1,
	storePath: string,
): GapCaseResult {
	const severity = options.severity;
	if (!severity) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "severity must be one of: high, medium, low",
			},
		};
	}

	const now = new Date().toISOString();
	const slaHours = options.slaHours ?? policy.defaultSlaHours;
	const slaDueAt = new Date(
		Date.now() + slaHours * 60 * 60 * 1000,
	).toISOString();

	const newCase: import("../lib/gap-case/types.js").GapCaseRecord = {
		id: generateCaseId(),
		incidentId: options.incidentId.trim(),
		status: "open",
		severity,
		summary: options.summary.trim(),
		owner: options.owner.trim(),
		openedAt: now,
		slaDueAt,
		provider: options.provider,
		findingId: options.findingId,
		prNumber: options.prNumber,
		headSha: options.headSha,
	};

	store.cases.push(newCase);

	try {
		saveStore(storePath, store);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "E_STORE_WRITE",
				message: error instanceof Error ? error.message : "Store write failed",
			},
		};
	}

	return { ok: true, output: newCase };
}

/**
 * Open a new gap-case (idempotent - returns existing if fingerprint matches)
 */
export function openGapCase(options: GapCaseOpenOptions): GapCaseResult {
	const { policy, error: policyError } = loadGapCasePolicy(
		options.contractPath,
	);
	if (policyError) return policyError;

	const validationError = validateOpenOptions(options);
	if (validationError) return validationError;

	const storePath = resolveStorePath(options.storePath, policy.storePath);

	let store: import("../lib/gap-case/types.js").GapCaseStoreV1;
	try {
		store = loadStore(storePath);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "E_STORE_CORRUPT",
				message: error instanceof Error ? error.message : "Store load failed",
			},
		};
	}

	const existing = findExistingCase(
		store,
		options.incidentId,
		options.headSha,
		options.findingId,
	);
	if (existing) {
		return { ok: true, output: existing };
	}

	return persistNewGapCase(options, policy, store, storePath);
}

/**
 * Validate all required fields for resolving a gap-case.
 * @returns A GapCaseResult error if validation fails, otherwise undefined.
 */
function validateResolveOptions(
	options: GapCaseResolveOptions,
	policy: import("../lib/contract/types.js").PilotGapCasePolicy,
): GapCaseResult | undefined {
	if (!options.caseId?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "caseId is required" },
		};
	}

	if (!options.evidenceUrl?.trim()) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: `evidenceUrl is required${policy.requireClosureEvidence ? " by policy" : ""}`,
			},
		};
	}

	if (!isValidHttpsUrl(options.evidenceUrl)) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "evidenceUrl must be a valid HTTPS URL",
			},
		};
	}

	return undefined;
}

/**
 * Build a resolved gap-case record, update the store, and persist.
 */
function persistResolvedGapCase(
	existingCase: import("../lib/gap-case/types.js").GapCaseRecord,
	options: GapCaseResolveOptions,
	store: import("../lib/gap-case/types.js").GapCaseStoreV1,
	caseIndex: number,
	storePath: string,
): GapCaseResult {
	const now = new Date().toISOString();
	const resolvedCase: import("../lib/gap-case/types.js").GapCaseRecord = {
		id: existingCase.id,
		incidentId: existingCase.incidentId,
		status: "resolved",
		severity: existingCase.severity,
		summary: existingCase.summary,
		owner: existingCase.owner,
		openedAt: existingCase.openedAt,
		slaDueAt: existingCase.slaDueAt,
		resolvedAt: now,
		provider: existingCase.provider,
		findingId: existingCase.findingId,
		prNumber: existingCase.prNumber,
		headSha: existingCase.headSha,
		resolution: {
			evidenceUrl: options.evidenceUrl.trim(),
			fixPr: options.fixPr,
			note: options.note,
			resolvedBy: options.resolvedBy,
		},
	};

	store.cases[caseIndex] = resolvedCase;

	try {
		saveStore(storePath, store);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "E_STORE_WRITE",
				message: error instanceof Error ? error.message : "Store write failed",
			},
		};
	}

	return { ok: true, output: resolvedCase };
}

/**
 * Resolve an existing gap-case
 */
export function resolveGapCase(options: GapCaseResolveOptions): GapCaseResult {
	const { policy, error: policyError } = loadGapCasePolicy(
		options.contractPath,
	);
	if (policyError) return policyError;

	const validationError = validateResolveOptions(options, policy);
	if (validationError) return validationError;

	const storePath = resolveStorePath(options.storePath, policy.storePath);

	let store: import("../lib/gap-case/types.js").GapCaseStoreV1;
	try {
		store = loadStore(storePath);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "E_STORE_CORRUPT",
				message: error instanceof Error ? error.message : "Store load failed",
			},
		};
	}

	const caseIndex = store.cases.findIndex((c) => c.id === options.caseId);
	if (caseIndex === -1) {
		return {
			ok: false,
			error: {
				code: "E_NOT_FOUND",
				message: `Gap-case not found: ${options.caseId}`,
			},
		};
	}

	const existingCase = store.cases[caseIndex];
	if (!existingCase) {
		return {
			ok: false,
			error: {
				code: "E_NOT_FOUND",
				message: `Gap-case not found: ${options.caseId}`,
			},
		};
	}

	if (existingCase.status === "resolved") {
		return {
			ok: false,
			error: {
				code: "E_ALREADY_RESOLVED",
				message: `Gap-case ${options.caseId} is already resolved`,
			},
		};
	}

	return persistResolvedGapCase(
		existingCase,
		options,
		store,
		caseIndex,
		storePath,
	);
}

/**
 * CLI entry point for gap-case command
 */
export function runGapCaseCLI(args: {
	action: "open" | "resolve";
	json?: boolean;
	contractPath?: string;
	storePath?: string;
	// Open options
	incidentId?: string;
	summary?: string;
	severity?: string;
	owner?: string;
	provider?: string;
	findingId?: string;
	prNumber?: number;
	headSha?: string;
	slaHours?: number;
	// Resolve options
	caseId?: string;
	evidenceUrl?: string;
	fixPr?: number;
	note?: string;
	resolvedBy?: string;
}): number {
	let result: GapCaseResult;

	if (args.action === "open") {
		result = openGapCase({
			incidentId: args.incidentId ?? "",
			summary: args.summary ?? "",
			severity: args.severity as RiskTier | undefined,
			owner: args.owner ?? "",
			provider: args.provider as GapCaseOpenOptions["provider"],
			findingId: args.findingId,
			prNumber: args.prNumber,
			headSha: args.headSha,
			slaHours: args.slaHours,
			contractPath: args.contractPath,
			storePath: args.storePath,
			json: args.json,
		});
	} else {
		result = resolveGapCase({
			caseId: args.caseId ?? "",
			evidenceUrl: args.evidenceUrl ?? "",
			fixPr: args.fixPr,
			note: args.note,
			resolvedBy: args.resolvedBy,
			contractPath: args.contractPath,
			storePath: args.storePath,
			json: args.json,
		});
	}

	if (result.ok) {
		if (args.json) {
			console.info(JSON.stringify(result.output, null, 2));
		} else {
			console.info(`✓ Gap-case ${result.output.status}: ${result.output.id}`);
			console.info(`  Incident: ${result.output.incidentId}`);
			console.info(`  Severity: ${result.output.severity}`);
			console.info(`  Owner: ${result.output.owner}`);
			console.info(`  Status: ${result.output.status}`);
			if (result.output.status === "open") {
				console.info(`  SLA due: ${result.output.slaDueAt}`);
			} else if (result.output.resolution) {
				console.info(`  Evidence: ${result.output.resolution.evidenceUrl}`);
			}
		}
		return GAP_CASE_EXIT_CODES.SUCCESS;
	}

	// Error output
	if (args.json) {
		console.error(JSON.stringify({ error: result.error }, null, 2));
	} else {
		console.error(`✗ ${result.error.message}`);
	}

	// Map error codes to exit codes
	switch (result.error.code) {
		case "E_VALIDATION":
			return GAP_CASE_EXIT_CODES.VALIDATION_ERROR;
		case "E_NOT_FOUND":
		case "E_ALREADY_RESOLVED":
			return GAP_CASE_EXIT_CODES.NOT_FOUND;
		case "E_STORE_CORRUPT":
		case "E_STORE_WRITE":
			return GAP_CASE_EXIT_CODES.STORE_ERROR;
		default:
			return GAP_CASE_EXIT_CODES.SYSTEM_ERROR;
	}
}
