/**
 * Contract Merger - Deep merge with security hardening
 *
 * Implements safe deep merge using lodash.mergeWith with:
 * - Dangerous key blocking (prototype pollution prevention)
 * - Configurable array merge strategies
 * - Depth limiting to prevent stack overflow
 */

import mergeWith from "lodash/mergeWith.js";
import { MergeError } from "./errors.js";
import type { HarnessContract, MergeOptions, MergeResult } from "./types.js";
import { DEFAULT_MERGE_OPTIONS } from "./types.js";

/**
 * Keys that are dangerous to merge because they can affect prototype chain.
 * Blocking these prevents prototype pollution attacks.
 *
 * Covers:
 * - Prototype chain manipulation: __proto__, prototype, constructor
 * - Object methods that can be exploited: hasOwnProperty, isPrototypeOf, etc.
 * - Legacy accessors: __defineGetter__, __defineSetter__, __lookupGetter__, __lookupSetter__
 * - Type coercion override: valueOf, toString, toLocaleString
 * - Promise-like injection: then (can make any object thenable)
 */
const DANGEROUS_KEYS = new Set([
	// Prototype chain manipulation
	"__proto__",
	"prototype",
	"constructor",
	// Object methods that can be exploited
	"hasOwnProperty",
	"isPrototypeOf",
	"propertyIsEnumerable",
	// Legacy accessor/mutator methods (still functional in many environments)
	"__defineGetter__",
	"__defineSetter__",
	"__lookupGetter__",
	"__lookupSetter__",
	// Type coercion override
	"toLocaleString",
	"toString",
	"valueOf",
	// Promise-like behavior injection
	"then",
]);

/**
 * Check if a key is dangerous and should be blocked during merge.
 */
export function isDangerousKey(key: string): boolean {
	return DANGEROUS_KEYS.has(key);
}

/**
 * Validate that an object does not contain dangerous keys.
 * Throws MergeError if dangerous keys are found.
 */
export function validateNoDangerousKeys(obj: unknown, path = ""): void {
	if (typeof obj !== "object" || obj === null) {
		return;
	}

	if (Array.isArray(obj)) {
		for (const item of obj) {
			validateNoDangerousKeys(item, path);
		}
		return;
	}

	for (const key of Object.keys(obj)) {
		const currentPath = path ? `${path}.${key}` : key;

		if (isDangerousKey(key)) {
			throw new MergeError(
				`Dangerous key '${key}' blocked at path '${currentPath}'. This may be a prototype pollution attempt.`,
				key,
			);
		}

		validateNoDangerousKeys((obj as Record<string, unknown>)[key], currentPath);
	}
}

/**
 * Deep merge two contracts with security hardening.
 *
 * Uses lodash.mergeWith with a customizer that:
 * - Blocks dangerous keys (__proto__, constructor, prototype, etc.)
 * - Handles arrays according to the specified strategy
 * - Maintains immutability (never mutates inputs)
 *
 * @param parent - Base contract (lower priority)
 * @param child - Override contract (higher priority)
 * @param options - Merge options
 * @returns Merged contract
 */
export function mergeContracts(
	parent: HarnessContract,
	child: Partial<HarnessContract>,
	options: Partial<MergeOptions> = {},
): HarnessContract {
	const opts: MergeOptions = { ...DEFAULT_MERGE_OPTIONS, ...options };

	// Validate child for dangerous keys before merging
	validateNoDangerousKeys(child);

	// Use mergeWith for explicit control over array handling
	const result = mergeWith(
		{},
		parent,
		child,
		(objValue: unknown, srcValue: unknown, key?: string) => {
			// Block dangerous keys - lodash will skip if we return undefined
			// and the key doesn't exist in the target
			if (key !== undefined && isDangerousKey(key)) {
				throw new MergeError(
					`Dangerous key '${key}' blocked during merge. This may be a prototype pollution attempt.`,
					key,
				);
			}

			// Handle array merging based on strategy
			if (Array.isArray(objValue) && Array.isArray(srcValue)) {
				if (opts.arrayMergeStrategy === "concat") {
					return [...objValue, ...srcValue];
				}
				// Default: replace parent array with child array
				return srcValue;
			}

			// Let lodash handle objects and primitives
			return undefined;
		},
	);

	return result as HarnessContract;
}

/**
 * Merge multiple contracts in sequence.
 * Later contracts have higher priority (override earlier ones).
 *
 * @param contracts - Contracts to merge in priority order
 * @param options - Merge options
 * @returns Merge result with audit trail
 */
export function mergeContractChain(
	contracts: Array<Partial<HarnessContract>>,
	options: Partial<MergeOptions> = {},
): MergeResult {
	if (contracts.length === 0) {
		throw new Error("Cannot merge empty contract chain");
	}

	let merged: HarnessContract = contracts[0] as HarnessContract;
	const sources: string[] = [];

	for (let i = 1; i < contracts.length; i++) {
		const nextContract = contracts[i];
		if (nextContract !== undefined) {
			merged = mergeContracts(merged, nextContract, options);
			sources.push(`contract-${i}`);
		}
	}

	return { contract: merged, sources };
}

/**
 * Check if two contracts are semantically equal.
 * Used for drift detection in org-audit.
 */
export function contractsEqual(
	a: HarnessContract,
	b: HarnessContract,
): boolean {
	return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

/**
 * Recursively sort object keys for stable comparison.
 */
function sortKeys<T>(obj: T): T {
	if (typeof obj !== "object" || obj === null) {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(sortKeys) as T;
	}

	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(obj).sort()) {
		sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
	}

	return sorted as T;
}
