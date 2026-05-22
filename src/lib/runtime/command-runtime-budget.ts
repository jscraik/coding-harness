/** Contract for reporting command runtime budgets without hiding slow validation paths. */
export const COMMAND_RUNTIME_BUDGET_SCHEMA_VERSION =
	"command-runtime-budget/v1" as const;

/** One observed command duration and its agreed budget. */
export interface CommandRuntimeBudgetObservation {
	command: string;
	durationMs: number;
	budgetMs: number;
	evidenceRef: string;
}

/** Runtime-budget report consumed by validation and closeout evidence. */
export interface CommandRuntimeBudgetReport {
	schemaVersion: typeof COMMAND_RUNTIME_BUDGET_SCHEMA_VERSION;
	status: "pass" | "fail";
	observations: CommandRuntimeBudgetObservation[];
	breaches: CommandRuntimeBudgetObservation[];
	slowestCommand: CommandRuntimeBudgetObservation | null;
}

/** Build a command runtime budget report from measured command durations. */
export function buildCommandRuntimeBudgetReport(
	observations: readonly CommandRuntimeBudgetObservation[],
): CommandRuntimeBudgetReport {
	const normalized = observations.map((observation) => ({ ...observation }));
	const breaches = normalized.filter(
		(observation) => observation.durationMs > observation.budgetMs,
	);
	const slowestCommand =
		normalized.length === 0
			? null
			: normalized.reduce((current, candidate) =>
					candidate.durationMs > current.durationMs ? candidate : current,
				);
	return {
		schemaVersion: COMMAND_RUNTIME_BUDGET_SCHEMA_VERSION,
		status: breaches.length === 0 ? "pass" : "fail",
		observations: normalized,
		breaches,
		slowestCommand,
	};
}

/** Validate a command runtime budget report before it can support closeout. */
export function validateCommandRuntimeBudgetReport(
	report: CommandRuntimeBudgetReport,
): string[] {
	const errors: string[] = [];
	if (report.schemaVersion !== COMMAND_RUNTIME_BUDGET_SCHEMA_VERSION) {
		errors.push("schemaVersion must be command-runtime-budget/v1");
	}
	for (const [index, observation] of report.observations.entries()) {
		if (observation.command.trim().length === 0) {
			errors.push(`observations[${index}].command is required`);
		}
		if (
			!Number.isFinite(observation.durationMs) ||
			observation.durationMs < 0
		) {
			errors.push(
				`observations[${index}].durationMs must be finite and non-negative`,
			);
		}
		if (!Number.isFinite(observation.budgetMs) || observation.budgetMs <= 0) {
			errors.push(
				`observations[${index}].budgetMs must be finite and positive`,
			);
		}
		if (observation.evidenceRef.trim().length === 0) {
			errors.push(`observations[${index}].evidenceRef is required`);
		}
	}
	return errors;
}
