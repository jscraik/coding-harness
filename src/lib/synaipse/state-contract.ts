/** Versioned compact state projection emitted by the SynAIpse cockpit. */
export const SYNAIPSE_STATE_SCHEMA_VERSION = "synaipse-state/v1" as const;

/** Structured validation result for `synaipse-state/v1`. */
export interface SynaipseStateValidationResult {
	valid: boolean;
	errors: Array<{ path: string; message: string }>;
}
