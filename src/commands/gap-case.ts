/**
 * Gap-case CLI command
 *
 * Minimal incident → gap-case workflow for v1 pilot.
 * Supports open and resolve actions with contract-gated behavior.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";

import { dirname, relative, resolve, sep } from "node:path";

import { loadContract } from "../lib/contract/loader.js";
import type { RiskTier } from "../lib/contract/types.js";
import { DEFAULT_PILOT_GAP_CASE_POLICY } from "../lib/contract/types.js";
import type {
	GapCaseOpenOptions,
	GapCaseRecord,
	GapCaseResolveOptions,
	GapCaseResult,
	GapCaseStoreV1,
} from "../lib/gap-case/types.js";
import { GAP_CASE_EXIT_CODES } from "../lib/gap-case/types.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

const DEFAULT_STORE_PATH = ".harness/gap-cases.v1.json";
const MAX_STORE_SIZE_BYTES = 1024 * 1024; // 1 MiB

/** Policy-supplied store paths are only honoured if they stay within this prefix. */
const SAFE_POLICY_STORE_PREFIX = ".harness/";

/**
 * Returns true if a policy-supplied storePath is within the allowed subdirectory.
 * CLI-supplied overrides bypass this check (they are operator-intentional).
 */
function isAllowedPolicyStorePath(storePath: string): boolean {
	const cwd = process.cwd();
	const absolutePath = resolve(cwd, storePath);
	try {
		validatePath(cwd, absolutePath);
	} catch {
		return false;
	}
	const rel = relative(cwd, absolutePath).split(sep).join("/");
	return rel.startsWith(SAFE_POLICY_STORE_PREFIX);
}

/**
 * Resolves the case-store path with policy sandboxing:
 * - Explicit CLI override is always accepted (operator-intentional).
 * - Policy-supplied path is only accepted when within .harness/.
 * - Falls back to DEFAULT_STORE_PATH otherwise.
 */
function resolveStorePath(
	overridePath?: string,
	policyStorePath?: string,
): string {
	if (overridePath) return overridePath;
	if (policyStorePath && isAllowedPolicyStorePath(policyStorePath))
		return policyStorePath;
	return DEFAULT_STORE_PATH;
}

/**
 * Generate a unique gap-case ID
 */
function generateCaseId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	return `gc-${timestamp}-${random}`;
}

/**
 * Validate SHA format (40 hex characters)
 */
function isValidSha(sha: string | undefined): boolean {
	if (!sha) return false;
	return /^[a-f0-9]{40}$/i.test(sha);
}

/**
 * Validate severity tier
 */
function isValidSeverity(value: string): value is RiskTier {
	return value === "high" || value === "medium" || value === "low";
}

/**
 * Validate URL format (must be HTTPS)
 */
function isValidHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Load gap-case store from disk
 */
function loadStore(storePath: string): GapCaseStoreV1 {
	const absolutePath = resolve(storePath);
	const cwd = process.cwd();

	// Validate path stays within cwd and doesn't follow symlinks outside
	try {
		validatePath(cwd, absolutePath);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			throw new Error("Store path escapes working directory");
		}
		throw e;
	}

	if (!existsSync(absolutePath)) {
		return { version: "1", cases: [] };
	}

	try {
		const stats = statSync(absolutePath);
		if (!stats.isFile()) {
			throw new Error("Store path must be a regular file");
		}
		if (stats.size > MAX_STORE_SIZE_BYTES) {
			throw new Error(
				`Store file exceeds max size (${MAX_STORE_SIZE_BYTES} bytes)`,
			);
		}

		const content = readFileSync(absolutePath, "utf-8");
		const data = JSON.parse(content) as unknown;

		// Validate structure
		if (
			typeof data !== "object" ||
			data === null ||
			(data as Record<string, unknown>).version !== "1" ||
			!Array.isArray((data as Record<string, unknown>).cases)
		) {
			throw new Error("Invalid store format");
		}

		return data as GapCaseStoreV1;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Corrupt gap-case store: ${message}`);
	}
}

/**
 * Save gap-case store to disk.
 * Uses a write-to-temp-then-rename pattern to prevent store corruption
 * if the process is interrupted mid-write.
 */
function saveStore(storePath: string, store: GapCaseStoreV1): void {
	const absolutePath = resolve(storePath);

	// Validate path stays within cwd (prevent traversal)
	const cwd = process.cwd();
	try {
		validatePath(cwd, absolutePath);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			throw new Error("Store path escapes working directory");
		}
		throw e;
	}

	// Ensure directory exists
	const dir = dirname(absolutePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	// Write atomically: write to sibling temp file, then rename over target.
	// renameSync is atomic on POSIX when src and dst are on the same filesystem,
	// so readers always see either the old or the new content — never a partial write.
	const tmpPath = `${absolutePath}.tmp`;
	try {
		writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf-8");
		renameSync(tmpPath, absolutePath);
	} catch (err) {
		// Best-effort cleanup of the temp file on failure
		try {
			if (existsSync(tmpPath)) {
				unlinkSync(tmpPath);
			}
		} catch {
			// ignore cleanup errors
		}
		throw err;
	}
}

/**
 * Find existing case by fingerprint (incidentId + sha + findingId)
 */
function findExistingCase(
	store: GapCaseStoreV1,
	incidentId: string,
	headSha?: string,
	findingId?: string,
): GapCaseRecord | undefined {
	return store.cases.find((c) => {
		if (c.incidentId !== incidentId) return false;
		if (headSha && c.headSha !== headSha) return false;
		if (findingId && c.findingId !== findingId) return false;
		return true;
	});
}

/**
 * Open a new gap-case (idempotent - returns existing if fingerprint matches)
 */
export function openGapCase(options: GapCaseOpenOptions): GapCaseResult {
	// Load contract for policy
	let policy = DEFAULT_PILOT_GAP_CASE_POLICY;
	if (options.contractPath) {
		try {
			const contract = loadContract(options.contractPath);
			if (contract.pilotGapCasePolicy) {
				policy = contract.pilotGapCasePolicy;
			}
		} catch (error) {
			return {
				ok: false,
				error: {
					code: "E_CONTRACT_LOAD",
					message: `Failed to load contract: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			};
		}
	}

	// Check if gap-case is enabled
	if (!policy.enabled) {
		return {
			ok: false,
			error: {
				code: "E_DISABLED",
				message: "Gap-case tracking is disabled in policy",
			},
		};
	}

	// Validate required fields
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

	// Validate SHA format if provided
	if (options.headSha && !isValidSha(options.headSha)) {
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "headSha must be a valid 40-character hex SHA",
			},
		};
	}

	// Validate SLA hours if provided
	if (options.slaHours !== undefined) {
		if (
			!Number.isInteger(options.slaHours) ||
			options.slaHours <= 0 ||
			options.slaHours > 8760 // Max 1 year
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

	const storePath = resolveStorePath(options.storePath, policy.storePath);

	// Load store
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

	// Check for duplicate (idempotent open)
	const existing = findExistingCase(
		store,
		options.incidentId,
		options.headSha,
		options.findingId,
	);
	if (existing) {
		return { ok: true, output: existing };
	}

	// Create new case
	const now = new Date().toISOString();
	const slaHours = options.slaHours ?? policy.defaultSlaHours;
	const slaDueAt = new Date(
		Date.now() + slaHours * 60 * 60 * 1000,
	).toISOString();

	const newCase: GapCaseRecord = {
		id: generateCaseId(),
		incidentId: options.incidentId.trim(),
		status: "open",
		severity: options.severity,
		summary: options.summary.trim(),
		owner: options.owner.trim(),
		openedAt: now,
		slaDueAt,
		provider: options.provider,
		findingId: options.findingId,
		prNumber: options.prNumber,
		headSha: options.headSha,
	};

	// Add to store
	store.cases.push(newCase);

	// Save store
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
 * Resolve an existing gap-case
 */
export function resolveGapCase(options: GapCaseResolveOptions): GapCaseResult {
	// Load contract for policy
	let policy = DEFAULT_PILOT_GAP_CASE_POLICY;
	if (options.contractPath) {
		try {
			const contract = loadContract(options.contractPath);
			if (contract.pilotGapCasePolicy) {
				policy = contract.pilotGapCasePolicy;
			}
		} catch (error) {
			return {
				ok: false,
				error: {
					code: "E_CONTRACT_LOAD",
					message: `Failed to load contract: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			};
		}
	}

	// Check if gap-case is enabled
	if (!policy.enabled) {
		return {
			ok: false,
			error: {
				code: "E_DISABLED",
				message: "Gap-case tracking is disabled in policy",
			},
		};
	}

	// Validate required fields
	if (!options.caseId?.trim()) {
		return {
			ok: false,
			error: { code: "E_VALIDATION", message: "caseId is required" },
		};
	}

	// Validate evidence URL
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

	const storePath = resolveStorePath(options.storePath, policy.storePath);

	// Load store
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

	// Find case
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

	// Check if already resolved
	if (existingCase.status === "resolved") {
		return {
			ok: false,
			error: {
				code: "E_ALREADY_RESOLVED",
				message: `Gap-case ${options.caseId} is already resolved`,
			},
		};
	}

	// Update case - explicitly build the resolved case to avoid spread type issues
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

	// Save store
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
