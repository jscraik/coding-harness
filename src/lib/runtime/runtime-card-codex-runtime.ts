import type { RuntimeCardToolExposureProjection } from "../tool-exposure/types.js";

/** Compact continuity ref fields accepted by runtime-card/v1 Codex runtime projection. */
export const CODEX_RUNTIME_CONTINUITY_REF_FIELDS = [
	"threadRefs",
	"turnRefs",
	"traceRefs",
	"goalRefs",
	"clientMessageRefs",
	"queueRefs",
	"approvalRefs",
	"heartbeatRefs",
] as const;

/** One accepted compact continuity ref array name. */
export type RuntimeCardCodexRuntimeContinuityField =
	(typeof CODEX_RUNTIME_CONTINUITY_REF_FIELDS)[number];

/** Compact continuity refs projected from Codex runtime evidence. */
export type RuntimeCardCodexRuntimeContinuityProjection = Record<
	RuntimeCardCodexRuntimeContinuityField,
	string[]
>;

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
	environmentRefs: string[];
	staleStateRefs: string[];
	continuity?: RuntimeCardCodexRuntimeContinuityProjection;
	toolExposure?: RuntimeCardToolExposureProjection;
}
