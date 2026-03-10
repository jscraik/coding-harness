export const CP4B_ENABLED_ENV = "HARNESS_CP4B_ENABLED";

function isTruthy(value: string | undefined): boolean {
	if (!value) {
		return false;
	}
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isCp4bLexicalFallbackEnabled(
	explicitFlag?: boolean,
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	return explicitFlag === true || isTruthy(env[CP4B_ENABLED_ENV]);
}
