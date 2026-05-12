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
import type { PilotGapCasePolicy, RiskTier } from "../lib/contract/types.js";
import { DEFAULT_PILOT_GAP_CASE_POLICY } from "../lib/contract/types.js";
import type { GapCaseResult, GapCaseStoreV1 } from "../lib/gap-case/types.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

export const DEFAULT_STORE_PATH = ".harness/gap-cases.v1.json";
export const MAX_STORE_SIZE_BYTES = 1024 * 1024; // 1 MiB

/** Policy-supplied store paths are only honoured if they stay within this prefix. */
const SAFE_POLICY_STORE_PREFIX = ".harness/";

/**
 * Returns true if a policy-supplied storePath is within the allowed subdirectory.
 * CLI-supplied overrides bypass this check (they are operator-intentional).
 */
export function isAllowedPolicyStorePath(storePath: string): boolean {
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
export function resolveStorePath(
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
export function generateCaseId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	return `gc-${timestamp}-${random}`;
}

/**
 * Validate SHA format (40 hex characters)
 */
export function isValidSha(sha: string | undefined): boolean {
	if (!sha) return false;
	return /^[a-f0-9]{40}$/i.test(sha);
}

/**
 * Validate severity tier
 */
export function isValidSeverity(value: string): value is RiskTier {
	return value === "high" || value === "medium" || value === "low";
}

/**
 * Validate URL format (must be HTTPS)
 */
export function isValidHttpsUrl(value: string): boolean {
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
export function loadStore(storePath: string): GapCaseStoreV1 {
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
export function saveStore(storePath: string, store: GapCaseStoreV1): void {
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
		const serialized = JSON.stringify(store, null, 2);
		if (Buffer.byteLength(serialized, "utf8") > MAX_STORE_SIZE_BYTES) {
			throw new Error(
				`Store file exceeds max size (${MAX_STORE_SIZE_BYTES} bytes)`,
			);
		}
		writeFileSync(tmpPath, serialized, "utf-8");
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
export function findExistingCase(
	store: GapCaseStoreV1,
	incidentId: string,
	headSha?: string,
	findingId?: string,
): import("../lib/gap-case/types.js").GapCaseRecord | undefined {
	return store.cases.find((c) => {
		if (c.incidentId !== incidentId) return false;
		if (headSha && c.headSha !== headSha) return false;
		if (findingId && c.findingId !== findingId) return false;
		return true;
	});
}

/**
 * Load gap-case policy from contract, falling back to the default.
 * Verifies that gap-case tracking is enabled.
 * @returns The loaded policy and an optional error result.
 */
export function loadGapCasePolicy(contractPath?: string): {
	policy: PilotGapCasePolicy;
	error?: GapCaseResult;
} {
	let policy = DEFAULT_PILOT_GAP_CASE_POLICY;
	if (contractPath) {
		try {
			const contract = loadContract(contractPath);
			if (contract.pilotGapCasePolicy) {
				policy = contract.pilotGapCasePolicy;
			}
		} catch (error) {
			return {
				policy: DEFAULT_PILOT_GAP_CASE_POLICY,
				error: {
					ok: false,
					error: {
						code: "E_CONTRACT_LOAD",
						message: `Failed to load contract: ${error instanceof Error ? error.message : "Unknown error"}`,
					},
				},
			};
		}
	}
	if (!policy.enabled) {
		return {
			policy,
			error: {
				ok: false,
				error: {
					code: "E_DISABLED",
					message: "Gap-case tracking is disabled in policy",
				},
			},
		};
	}
	return { policy };
}
