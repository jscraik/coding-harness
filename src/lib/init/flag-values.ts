/** Raw flag value inspection result; null means the flag was present without a usable value. */
export type RawFlagValue = string | null | undefined;

/** Return a raw flag value, preserving absent versus missing-value states. */
export function getRawFlagValue(args: string[], flag: string): RawFlagValue {
	const index = args.indexOf(flag);
	if (index === -1) return undefined;
	const value = args[index + 1];
	return value === undefined || value.startsWith("-") ? null : value;
}

/** Find the first positional argument that is not consumed by a value-bearing flag. */
export function findPositionalArg(
	args: string[],
	valueFlags: ReadonlySet<string>,
): string | undefined {
	return args.find((arg, index) => {
		if (arg.startsWith("-")) return false;
		const previous = args[index - 1];
		return !valueFlags.has(previous ?? "");
	});
}
