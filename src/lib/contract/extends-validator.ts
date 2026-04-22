import { hasForbiddenKey, isPlainObject } from "./validator-helpers.js";

const VALID_PRESET_ARRAY_STRATEGIES = ["replace", "append", "prepend"] as const;

function isValidPresetReferenceShape(value: unknown): boolean {
	if (typeof value === "string") {
		return value.trim().length > 0;
	}
	if (!isPlainObject(value)) {
		return false;
	}

	const reference = value as Record<string, unknown>;
	const validKeys = ["source", "arrays", "integrity"] as const;
	const invalidKeys = Object.keys(reference).filter(
		(key) =>
			hasForbiddenKey(key) ||
			!validKeys.includes(key as (typeof validKeys)[number]),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (
		typeof reference.source !== "string" ||
		reference.source.trim().length === 0
	) {
		return false;
	}

	if (
		"arrays" in reference &&
		reference.arrays !== undefined &&
		(typeof reference.arrays !== "string" ||
			!VALID_PRESET_ARRAY_STRATEGIES.includes(
				reference.arrays as (typeof VALID_PRESET_ARRAY_STRATEGIES)[number],
			))
	) {
		return false;
	}

	if (
		"integrity" in reference &&
		reference.integrity !== undefined &&
		(typeof reference.integrity !== "string" ||
			!/^sha256-.+/.test(reference.integrity))
	) {
		return false;
	}

	return true;
}

export function isValidExtendsFieldShape(value: unknown): boolean {
	if (Array.isArray(value)) {
		return (
			value.length > 0 &&
			value.every((entry) => isValidPresetReferenceShape(entry))
		);
	}
	return isValidPresetReferenceShape(value);
}
