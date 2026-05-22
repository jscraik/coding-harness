export {
	runArtifactGateCLI,
	runArtifactGateFromCliArgs,
} from "./artifact-gate/cli.js";
export { buildArtifactGateOptionsFromCliArgs } from "./artifact-gate/cli-args.js";
export {
	DEFAULT_ARTIFACT_PROVENANCE_REGISTRY,
	runArtifactGate,
} from "./artifact-provenance.js";
export type {
	ArtifactGateCliArgsResult,
	ArtifactGateCliOptions,
	ArtifactGateUsageError,
	ArtifactGateUsageErrorCode,
} from "./artifact-gate/types.js";
export type {
	ArtifactGateFinding,
	ArtifactGateResult,
	ArtifactGateSeverity,
	ArtifactGateStatus,
	ArtifactProvenanceEntry,
	ArtifactProvenanceEnforcement,
	ArtifactProvenanceRegistry,
	RunArtifactGateOptions,
} from "./artifact-provenance.js";
