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
