import type { PilotGapCasePolicy } from "../contract/types.js";
import type {
	GapCaseOpenOptions,
	GapCaseRecord,
	GapCaseResolveOptions,
	GapCaseResult,
	GapCaseStoreV1,
} from "./types.js";
import {
	findExistingCase,
	generateCaseId,
	loadGapCasePolicy,
	loadStore,
	resolveStorePath,
	saveStore,
} from "./store.js";
import { validateOpenOptions, validateResolveOptions } from "./validators.js";

/**
 * Create a new gap-case record, add it to the store, and persist.
 */
function persistNewGapCase(
	options: GapCaseOpenOptions,
	policy: PilotGapCasePolicy,
	store: GapCaseStoreV1,
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

	const newCase: GapCaseRecord = {
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
 * Open a new gap-case (idempotent - returns existing if fingerprint matches).
 */
export function openGapCase(options: GapCaseOpenOptions): GapCaseResult {
	const { policy, error: policyError } = loadGapCasePolicy(
		options.contractPath,
	);
	if (policyError) return policyError;

	const validationError = validateOpenOptions(options);
	if (validationError) return validationError;

	const storePath = resolveStorePath(options.storePath, policy.storePath);

	let store: GapCaseStoreV1;
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
 * Build a resolved gap-case record, update the store, and persist.
 */
function persistResolvedGapCase(
	existingCase: GapCaseRecord,
	options: GapCaseResolveOptions,
	store: GapCaseStoreV1,
	caseIndex: number,
	storePath: string,
): GapCaseResult {
	const now = new Date().toISOString();
	const resolvedCase: GapCaseRecord = {
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

/** Resolve an existing gap-case. */
export function resolveGapCase(options: GapCaseResolveOptions): GapCaseResult {
	const { policy, error: policyError } = loadGapCasePolicy(
		options.contractPath,
	);
	if (policyError) return policyError;

	const validationError = validateResolveOptions(options, policy);
	if (validationError) return validationError;

	const storePath = resolveStorePath(options.storePath, policy.storePath);

	let store: GapCaseStoreV1;
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
