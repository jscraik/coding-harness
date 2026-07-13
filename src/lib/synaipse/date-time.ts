/** Return whether a character is an ASCII decimal digit. */
function isDigit(value: string): boolean {
	return value >= "0" && value <= "9";
}

/** Return whether a value is a fixed-width decimal field. */
function isDigits(value: string, width: number): boolean {
	return value.length === width && [...value].every(isDigit);
}

type DateParts = { year: number; month: number; day: number };

/** Return whether numeric date fields describe a real Gregorian calendar date. */
function isCalendarDate({ year, month, day }: DateParts): boolean {
	const leapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const daysInMonth =
		[31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
			month - 1
		] ?? 0;
	return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
}

/** Return whether a fixed-width RFC3339 calendar date is valid. */
function isDatePart(value: string): boolean {
	if (
		value.length !== 10 ||
		value[4] !== "-" ||
		value[7] !== "-" ||
		!isDigits(value.slice(0, 4), 4) ||
		!isDigits(value.slice(5, 7), 2) ||
		!isDigits(value.slice(8, 10), 2)
	)
		return false;
	return isCalendarDate({
		year: Number(value.slice(0, 4)),
		month: Number(value.slice(5, 7)),
		day: Number(value.slice(8, 10)),
	});
}

/** Return whether the numeric clock and optional fraction are valid. */
function hasClockShape(value: string): boolean {
	return (
		value.length === 8 &&
		value[2] === ":" &&
		value[5] === ":" &&
		isDigits(value.slice(0, 2), 2) &&
		isDigits(value.slice(3, 5), 2) &&
		isDigits(value.slice(6, 8), 2)
	);
}

/** Return whether the numeric clock fields fit RFC3339 ranges. */
function hasClockRange(value: string): boolean {
	return (
		Number(value.slice(0, 2)) <= 23 &&
		Number(value.slice(3, 5)) <= 59 &&
		Number(value.slice(6, 8)) <= 59
	);
}

/** Return whether the fractional second component is present and numeric. */
function hasValidFraction(value: string | null): boolean {
	return value === null || (value.length > 0 && isDigits(value, value.length));
}

/** Return whether the numeric clock and optional fraction are valid. */
function isTimePart(value: string): boolean {
	const fractionStart = value.indexOf(".");
	const clock = fractionStart === -1 ? value : value.slice(0, fractionStart);
	const fraction = fractionStart === -1 ? null : value.slice(fractionStart + 1);
	return (
		hasClockShape(clock) && hasClockRange(clock) && hasValidFraction(fraction)
	);
}

/** Return whether a UTC or numeric RFC3339 offset has valid ranges. */
function isZonePart(value: string): boolean {
	if (value === "Z") return true;
	if (
		value.length !== 6 ||
		(value[0] !== "+" && value[0] !== "-") ||
		value[3] !== ":" ||
		!isDigits(value.slice(1, 3), 2) ||
		!isDigits(value.slice(4, 6), 2)
	)
		return false;
	return Number(value.slice(1, 3)) <= 23 && Number(value.slice(4, 6)) <= 59;
}

/** Return whether a value is an RFC3339 date-time without Date.parse normalization. */
export function isRfc3339DateTime(value: unknown): value is string {
	if (typeof value !== "string" || value.length < 20) return false;
	if (value[10] !== "T" || value.indexOf("T", 11) !== -1) return false;
	const zoneStart = value.endsWith("Z") ? value.length - 1 : value.length - 6;
	if (zoneStart <= 10) return false;
	const zone = value.slice(zoneStart);
	return (
		isDatePart(value.slice(0, 10)) &&
		isTimePart(value.slice(11, zoneStart)) &&
		isZonePart(zone)
	);
}
