/** Return true when package.json exposes useful local and deep test scripts. */
export function hasRunnableTestScripts(packageText: string): boolean {
	const parsed = parsePackageJson(packageText);
	if (parsed === null || !isRecord(parsed.scripts)) {
		return false;
	}
	const scripts = parsed.scripts;
	return (
		isUsefulScript(scripts.test) &&
		(isUsefulScript(scripts["test:ci"]) || isUsefulScript(scripts["test:deep"]))
	);
}

function parsePackageJson(packageText: string): { scripts?: unknown } | null {
	try {
		const parsed: unknown = JSON.parse(packageText);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsefulScript(value: unknown): boolean {
	if (typeof value !== "string") return false;
	const normalized = value.trim().toLowerCase();
	return (
		normalized.length > 0 &&
		normalized !== "true" &&
		!normalized.includes("no test specified")
	);
}
