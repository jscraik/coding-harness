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
import { loadContract } from "../contract/loader.js";
import type { PilotGapCasePolicy } from "../contract/types.js";
import { DEFAULT_PILOT_GAP_CASE_POLICY } from "../contract/types.js";
import { PathTraversalError, validatePath } from "../input/validator.js";
import type { GapCaseRecord, GapCaseResult, GapCaseStoreV1 } from "./types.js";

/** Default local gap-case store path. */
export const DEFAULT_STORE_PATH = ".harness/gap-cases.v1.json";
/** Maximum accepted store size before read/write rejection. */
export const MAX_STORE_SIZE_BYTES = 1024 * 1024;

const SAFE_POLICY_STORE_PREFIX = ".harness/";

/**
 * Return whether a policy-supplied store path is inside the allowed subdirectory.
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
 * Resolve the case-store path with policy sandboxing.
 */
export function resolveStorePath(
	overridePath?: string,
	policyStorePath?: string,
): string {
	if (overridePath) return overridePath;
	if (policyStorePath && isAllowedPolicyStorePath(policyStorePath)) {
		return policyStorePath;
	}
	return DEFAULT_STORE_PATH;
}

/**
 * Generate a unique gap-case ID.
 */
export function generateCaseId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	return `gc-${timestamp}-${random}`;
}

/**
 * Load a gap-case store from disk, validating path and store shape.
 */
export function loadStore(storePath: string): GapCaseStoreV1 {
	const absolutePath = resolve(storePath);
	const cwd = process.cwd();

	try {
		validatePath(cwd, absolutePath);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			throw new Error("Store path escapes working directory");
		}
		throw error;
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
		const record = data as Record<string, unknown>;

		if (
			typeof data !== "object" ||
			data === null ||
			record.version !== "1" ||
			!Array.isArray(record.cases)
		) {
			throw new Error("Invalid store format");
		}

		for (const entry of record.cases) {
			if (
				typeof entry !== "object" ||
				entry === null ||
				typeof (entry as Record<string, unknown>).id !== "string" ||
				typeof (entry as Record<string, unknown>).incidentId !== "string"
			) {
				throw new Error("Invalid store format");
			}
		}

		return data as GapCaseStoreV1;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		throw new Error(`Corrupt gap-case store: ${message}`);
	}
}

/**
 * Save a gap-case store with write-to-temp-then-rename atomicity.
 */
export function saveStore(storePath: string, store: GapCaseStoreV1): void {
	const absolutePath = resolve(storePath);
	const cwd = process.cwd();
	try {
		validatePath(cwd, absolutePath);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			throw new Error("Store path escapes working directory");
		}
		throw error;
	}

	const dir = dirname(absolutePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const nonce =
		Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
	const tmpPath = `${absolutePath}.tmp.${nonce}`;
	try {
		const serialized = JSON.stringify(store, null, 2);
		if (Buffer.byteLength(serialized, "utf8") > MAX_STORE_SIZE_BYTES) {
			throw new Error(
				`Store file exceeds max size (${MAX_STORE_SIZE_BYTES} bytes)`,
			);
		}
		writeFileSync(tmpPath, serialized, { encoding: "utf-8", flag: "wx" });
		renameSync(tmpPath, absolutePath);
	} catch (error) {
		try {
			if (existsSync(tmpPath)) {
				unlinkSync(tmpPath);
			}
		} catch {
			// Best-effort cleanup only.
		}
		throw error;
	}
}

/**
 * Find an existing case by incident and optional provider fingerprint.
 */
export function findExistingCase(
	store: GapCaseStoreV1,
	incidentId: string,
	headSha?: string,
	findingId?: string,
): GapCaseRecord | undefined {
	return store.cases.find((entry) => {
		if (entry.incidentId !== incidentId) return false;
		if (headSha && entry.headSha !== headSha) return false;
		if (findingId && entry.findingId !== findingId) return false;
		return true;
	});
}

/**
 * Load gap-case policy from a harness contract and require it to be enabled.
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
						message:
							"Failed to load contract: " +
							(error instanceof Error ? error.message : "Unknown error"),
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
