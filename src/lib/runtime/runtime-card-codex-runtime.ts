/** Compact Codex runtime summary projected into runtime-card/v1. */
export interface RuntimeCardCodexRuntimeProjection {
	provenanceRef: string | null;
	collectedAt: string | null;
	/** Count of Codex-origin receipt refs projected into runtime-card sources. */
	sourceCount: number;
	blockedSourceCount: number;
	blockerCount: number;
	receiptRefs: string[];
	validationRefs: string[];
	reviewRefs: string[];
	sessionRefs: string[];
	staleStateRefs: string[];
}
