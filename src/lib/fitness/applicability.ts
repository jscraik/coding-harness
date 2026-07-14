import type { FitnessApplicability, FitnessLane } from "./types.js";

/** Applicability values are routing metadata, not hosted or merge authority. */
export const VALID_FITNESS_APPLICABILITIES: readonly FitnessApplicability[] = [
	"required",
	"admitted",
	"not_applicable",
	"blocked",
];

/** Return whether a lane is expected to contribute local evidence. */
export function fitnessLaneRequiresEvidence(
	lane: Pick<FitnessLane, "applicability"> | { applicability?: unknown },
): boolean {
	return lane.applicability !== "not_applicable";
}
