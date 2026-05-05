import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { PathTraversalError, validatePath } from "../input/validator.js";
import type {
	HarnessContract,
	MergePolicy,
	MergePolicyValue,
} from "./types.js";
import { DEFAULT_CONTRACT } from "./types.js";
import { requiresCanonicalNorthStarSurfaces } from "./validator-helpers.js";
import {
	type ValidationError,
	ValidationErrorCode,
	validateContract,
} from "./validator.js";

const MAX_CONTRACT_SIZE = 1024 * 1024; // 1MB
const MAX_JSON_DEPTH = 100;

/** LRU cache for loaded contracts. Key: `${baseDir}:${path}` */
const CONTRACT_CACHE = new Map<string, HarnessContract>();
const MAX_CACHE_SIZE = 10;

/** Generate cache key for contract lookup */
function getCacheKey(
	baseDir: string,
	path: string,
	options?: { allowExtends?: boolean },
): string {
	const extendsMode =
		options?.allowExtends === false ? "no-extends" : "default";
	return `${baseDir}:${path}:${extendsMode}`;
}

/** Get contract from cache if present */
function getCachedContract(key: string): HarnessContract | undefined {
	return CONTRACT_CACHE.get(key);
}

/** Store contract in cache with LRU eviction */
function setCachedContract(key: string, contract: HarnessContract): void {
	// Evict oldest if at capacity (simple LRU: re-insert on access)
	if (CONTRACT_CACHE.size >= MAX_CACHE_SIZE && !CONTRACT_CACHE.has(key)) {
		const firstKey = CONTRACT_CACHE.keys().next().value;
		if (firstKey !== undefined) {
			CONTRACT_CACHE.delete(firstKey);
		}
	}
	CONTRACT_CACHE.set(key, contract);
}

/** Clear contract cache (useful for testing) */
export function clearContractCache(): void {
	CONTRACT_CACHE.clear();
}

/**
 * Normalize a merge policy value to canonical array form.
 * - Legacy array: returned as-is
 * - Roadmap object: extracts requiredChecks array
 */
function normalizeMergePolicyValue(value: MergePolicyValue): string[] {
	if (Array.isArray(value)) {
		return value;
	}
	// Roadmap shape: { requiredChecks: [...] }
	return value.requiredChecks;
}

/**
 * Normalize merge policy to canonical array form.
 * All severity keys map to string arrays internally.
 */
function normalizeMergePolicy(policy: MergePolicy): MergePolicy {
	const normalized: MergePolicy = {};
	for (const [severity, value] of Object.entries(policy)) {
		normalized[severity] = normalizeMergePolicyValue(value);
	}
	return normalized;
}

/**
 * Structured error thrown when a harness contract cannot be loaded safely.
 */
export class ContractLoadError extends Error {
	constructor(
		message: string,
		public readonly path: string,
		public readonly errors: ValidationError[] = [],
	) {
		super(message);
		this.name = "ContractLoadError";
	}
}

/**
 * Calculate the maximum nesting depth of a JSON value.
 */
function getDepth(value: unknown): number {
	if (typeof value !== "object" || value === null) {
		return 0;
	}

	const arr = Array.isArray(value) ? value : Object.values(value);
	if (arr.length === 0) {
		return 1;
	}

	return 1 + Math.max(...arr.map(getDepth));
}

/**
 * Parse JSON content and enforce a maximum nesting depth.
 *
 * @returns The parsed value from the provided JSON string.
 * @throws Error if the parsed JSON's nesting depth is greater than MAX_JSON_DEPTH.
 */
function safeParseJson(content: string): unknown {
	const data = JSON.parse(content);
	const depth = getDepth(data);
	if (depth > MAX_JSON_DEPTH) {
		throw new Error(`JSON depth exceeds maximum (${MAX_JSON_DEPTH})`);
	}
	return data;
}

/**
 * Merge validated contract data with defaults and normalize version-dependent fields.
 *
 * Preserves only explicitly provided fields from `data`, fills missing values from defaults,
 * resolves the effective `version`, and when the resolved version does not require canonical
 * NorthStar surfaces, ensures `northStar`, `productSurface`, and `overrideReviewerRegistry`
 * are `undefined` unless they were explicitly present in the input.
 *
 * @param data - Validated contract data, or `undefined` to use defaults
 * @returns The merged HarnessContract with defaults applied and version-dependent fields normalized
 */
function mergeContractDefaults(
	data: HarnessContract | undefined,
): HarnessContract {
	const validatedData = data ?? {};
	const normalizedData = Object.fromEntries(
		Object.entries(validatedData).filter(([, value]) => value !== undefined),
	) as Partial<HarnessContract>;
	const {
		northStar: _defaultNorthStar,
		productSurface: _defaultProductSurface,
		overrideReviewerRegistry: _defaultOverrideReviewerRegistry,
		...legacyCompatibleDefaults
	} = DEFAULT_CONTRACT;
	const resolvedVersion =
		normalizedData.version ??
		legacyCompatibleDefaults.version ??
		DEFAULT_CONTRACT.version;
	const mergeDefaults = requiresCanonicalNorthStarSurfaces(resolvedVersion)
		? DEFAULT_CONTRACT
		: legacyCompatibleDefaults;
	const contract: HarnessContract = {
		...mergeDefaults,
		...normalizedData,
	};
	const canonicalNorthStarRequired =
		requiresCanonicalNorthStarSurfaces(resolvedVersion);
	if (!canonicalNorthStarRequired) {
		if (!Object.hasOwn(normalizedData, "northStar")) {
			contract.northStar = undefined;
		}
		if (!Object.hasOwn(normalizedData, "productSurface")) {
			contract.productSurface = undefined;
		}
		if (!Object.hasOwn(normalizedData, "overrideReviewerRegistry")) {
			contract.overrideReviewerRegistry = undefined;
		}
	}
	return contract;
}

/**
 * Loads and validates a harness contract from disk.
 *
 * @param path - Contract path (absolute or repository-relative)
 * @param baseDir - Repository root used for safe-path validation
 * @param options - Loader options; if `allowExtends` is `false`, contracts containing an `extends` field are rejected
 * @returns The parsed, merged, and normalized harness contract
 * @throws ContractLoadError - when path traversal is detected, JSON parsing fails, contract validation fails, or `extends` is disallowed by `options`
 * @throws Error - when the contract file exceeds the maximum allowed size (1MB) or other filesystem errors occur
 */
export function loadContract(
	path: string,
	baseDir = process.cwd(),
	options?: { allowExtends?: boolean },
): HarnessContract {
	// Check cache first (fast path for repeated loads)
	const cacheKey = getCacheKey(baseDir, path, options);
	const cached = getCachedContract(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	// Validate path stays within baseDir (symlink-aware)
	let validatedPath: string;
	try {
		const contractPath = isAbsolute(path) ? relative(baseDir, path) : path;
		validatedPath = validatePath(baseDir, contractPath);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			throw new ContractLoadError("Path traversal detected", path, [
				{
					code: ValidationErrorCode.FORBIDDEN_KEY,
					path: "contract",
					message: "Contract path escapes working directory",
					fix: "Use a path within the current directory",
				},
			]);
		}
		throw e;
	}

	// Read with size limit (use byte count, not character count)
	const content = readFileSync(validatedPath, "utf-8");
	const byteSize = Buffer.byteLength(content, "utf-8");
	if (byteSize > MAX_CONTRACT_SIZE) {
		throw new Error(`Contract file exceeds maximum size (1MB): ${path}`);
	}

	// Parse JSON with depth limit
	let data: unknown;
	try {
		data = safeParseJson(content);
	} catch (e) {
		const message = e instanceof Error ? e.message : "unknown error";
		throw new ContractLoadError(`Failed to parse JSON: ${message}`, path);
	}

	// Some command paths intentionally fail closed on inherited contracts because
	// they must not resolve repo-controlled inheritance implicitly. Keep the
	// default loader backwards-compatible and let specific callers opt in.
	if (
		options?.allowExtends === false &&
		typeof data === "object" &&
		data !== null &&
		Object.hasOwn(data, "extends")
	) {
		throw new ContractLoadError(
			"Contract inheritance via 'extends' is not supported in this command path. Resolve presets before running policy commands.",
			path,
			[
				{
					code: ValidationErrorCode.INVALID_VALUE,
					path: "extends",
					message:
						"'extends' requires inheritance-aware loading and cannot be used with this command path",
					fix: "Resolve inheritance into a concrete contract before execution",
				},
			],
		);
	}

	// Validate
	const result = validateContract(data);
	if (!result.success) {
		throw new ContractLoadError(
			`Contract validation failed with ${result.errors.length} error(s)`,
			path,
			result.errors,
		);
	}

	const contract = mergeContractDefaults(result.data);

	// Normalize merge policy if present
	if (contract.mergePolicy) {
		contract.mergePolicy = normalizeMergePolicy(contract.mergePolicy);
	}

	// Cache result before returning
	setCachedContract(cacheKey, contract);

	return contract;
}
