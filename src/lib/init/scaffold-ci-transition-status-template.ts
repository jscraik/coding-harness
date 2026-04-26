const DEFAULT_TRANSITION_STATUS_UPDATED_AT = "2026-03-14T00:00:00.000Z";

/**
 * Render the CI provider transition status artifact used by scaffolded repos.
 *
 * @returns Pretty-printed transition status JSON with deterministic timestamp.
 */
export function renderTransitionStatusArtifact(): string {
	return JSON.stringify(
		{
			schemaVersion: "ci-provider-transition-status/v1",
			nextGateComplete: false,
			updatedAt: DEFAULT_TRANSITION_STATUS_UPDATED_AT,
		},
		null,
		2,
	);
}
