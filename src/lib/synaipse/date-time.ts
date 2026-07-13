/** Return whether a character is an ASCII decimal digit. */
function isDigit(value: string): boolean {
	return value >= "0" && value <= "9";
}

/** Return whether the time portion includes hours, minutes, and seconds. */
function hasValidClock(value: string, separator: number): boolean {
	const timeStart = separator + 1;
	if (value.length < timeStart + 8) return false;
	const time = value.slice(timeStart, timeStart + 8);
	return (
		time[2] === ":" &&
		time[5] === ":" &&
		[...time].every(
			(character, index) => index === 2 || index === 5 || isDigit(character),
		)
	);
}

/** Return whether the value ends in UTC or a numeric RFC3339 offset. */
function hasValidOffset(value: string, separator: number): boolean {
	if (value.endsWith("Z")) return true;
	const zoneStart = Math.max(value.lastIndexOf("+"), value.lastIndexOf("-"));
	if (zoneStart <= separator) return false;
	const zone = value.slice(zoneStart + 1);
	return (
		zone.length === 5 &&
		zone[2] === ":" &&
		[...zone].every((character, index) => index === 2 || isDigit(character))
	);
}

/** Return whether a value is an RFC3339 date-time with an explicit zone. */
export function isRfc3339DateTime(value: unknown): value is string {
	if (typeof value !== "string" || value.trim() === "") return false;
	const separator = value.indexOf("T");
	return (
		separator > 0 &&
		!Number.isNaN(Date.parse(value)) &&
		hasValidClock(value, separator) &&
		hasValidOffset(value, separator)
	);
}
