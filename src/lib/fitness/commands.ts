export const FITNESS_COMMANDS = {
	ARCHITECTURE_CHECK: "pnpm architecture:check",
	QUALITY_SIZE: "pnpm run quality:size",
	TYPECHECK_ARTIFACT: "pnpm run fitness:typecheck-artifact",
	LINT_ARTIFACT: "pnpm run fitness:lint-artifact",
	BEHAVIOR_TESTS: "pnpm run quality:behavior-tests",
	AUDIT_TRACKING: "pnpm run harness:audit-tracking",
	AUTOREVIEW: "pnpm run autoreview",
} as const;

/** Canonical command string used by repository fitness lanes. */
export type FitnessCommand =
	(typeof FITNESS_COMMANDS)[keyof typeof FITNESS_COMMANDS];

export const TRUSTED_FITNESS_COMMANDS = new Set<FitnessCommand>([
	FITNESS_COMMANDS.ARCHITECTURE_CHECK,
	FITNESS_COMMANDS.QUALITY_SIZE,
	FITNESS_COMMANDS.TYPECHECK_ARTIFACT,
	FITNESS_COMMANDS.LINT_ARTIFACT,
	FITNESS_COMMANDS.BEHAVIOR_TESTS,
	FITNESS_COMMANDS.AUDIT_TRACKING,
]);

export const FITNESS_COMMANDS_THAT_WRITE_FILES = new Set<FitnessCommand>([
	FITNESS_COMMANDS.TYPECHECK_ARTIFACT,
	FITNESS_COMMANDS.LINT_ARTIFACT,
]);

/** Return true when a fitness finding recommends a known deterministic command. */
export function isTrustedFitnessCommand(command: string): boolean {
	return trustedFitnessCommand(command) !== null;
}

/** Return a normalized trusted fitness command, or null for untrusted input. */
export function trustedFitnessCommand(command: string): FitnessCommand | null {
	const normalized = command.trim() as FitnessCommand;
	return TRUSTED_FITNESS_COMMANDS.has(normalized) ? normalized : null;
}
