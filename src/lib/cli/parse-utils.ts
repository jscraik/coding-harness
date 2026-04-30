/**
 * Parse a CLI argument as an integer when it is present and above the minimum.
 *
 * @param value - Raw CLI value to parse.
 * @param min - Inclusive lower bound for accepted values.
 * @returns Parsed integer, or `undefined` when the value is missing or invalid.
 */
export function parseIntegerArg(
	value: string | undefined,
	min: number = Number.NEGATIVE_INFINITY,
): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const trimmed = value.trim();
	if (!/^-?\d+$/.test(trimmed)) {
		return undefined;
	}
	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(parsed) || parsed < min) {
		return undefined;
	}
	return parsed;
}

/**
 * Parse a comma-separated CLI value into non-empty trimmed items.
 *
 * @param value - Raw CLI value, such as `a,b,c`.
 * @returns Parsed list items, or an empty list when the value is missing or flag-like.
 */
export function parseCsvList(value: string | undefined): string[] {
	if (value === undefined) {
		return [];
	}
	if (value.startsWith("-")) {
		return [];
	}
	return value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

/**
 * Parsed state for a list-valued CLI flag.
 */
export interface FlagListInspection {
	/** Whether the flag appeared in the argument vector. */
	present: boolean;
	/** Parsed list values gathered from the flag's following value tokens. */
	values: string[];
	/** Whether the flag appeared without any usable values. */
	missingValue: boolean;
}

/**
 * Inspect a list-valued CLI flag and parse all following non-flag tokens.
 *
 * Supports both `--files a,b` and `--files a b` forms while stopping before the
 * next flag. Empty comma entries are ignored, and `missingValue` is true when the
 * flag is present but no usable list values follow it.
 *
 * @param args - Argument vector to search.
 * @param flag - Flag name to inspect, such as `--files`.
 * @returns Presence, parsed list values, and whether the flag was missing a usable value.
 */
export function inspectFlagList(
	args: string[],
	flag: string,
): FlagListInspection {
	const index = args.indexOf(flag);
	if (index === -1) {
		return {
			present: false,
			values: [],
			missingValue: false,
		};
	}

	const values: string[] = [];
	for (const token of args.slice(index + 1)) {
		if (token.startsWith("-")) break;
		values.push(...parseCsvList(token));
	}

	return {
		present: true,
		values,
		missingValue: values.length === 0,
	};
}

/**
 * Read the immediate value after a flag index.
 *
 * @param args - Argument vector to inspect.
 * @param flagIndex - Index of the flag whose following value should be read.
 * @returns The following value, or `undefined` when the index is absent or the value is missing.
 */
export function getFlagValue(
	args: string[],
	flagIndex: number,
): string | undefined {
	if (flagIndex === -1) {
		return undefined;
	}
	const value = args[flagIndex + 1];
	if (value === undefined || value.startsWith("-")) {
		return undefined;
	}
	return value;
}

/**
 * Parsed state for a single-valued CLI flag.
 */
export interface FlagValueInspection {
	/** Whether the flag appeared in the argument vector. */
	present: boolean;
	/** The parsed flag value when one was provided. */
	value?: string;
	/** Whether the flag appeared without a usable following value. */
	missingValue: boolean;
}

/**
 * Inspect a single-valued CLI flag.
 *
 * @param args - Argument vector to search.
 * @param flag - Flag name to inspect, such as `--source`.
 * @returns Presence, optional value, and whether the flag was missing a usable value.
 */
export function inspectFlagValue(
	args: string[],
	flag: string,
): FlagValueInspection {
	const index = args.indexOf(flag);
	if (index === -1) {
		return {
			present: false,
			missingValue: false,
		};
	}

	const value = args[index + 1];
	if (value === undefined || value.startsWith("-")) {
		return {
			present: true,
			missingValue: true,
		};
	}

	return {
		present: true,
		value,
		missingValue: false,
	};
}
