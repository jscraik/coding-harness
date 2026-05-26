/** Format unknown root-hygiene failures for contextual wrapper errors. */
export function formatRootHygieneError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
