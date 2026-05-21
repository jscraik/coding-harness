/** Typed options accepted by the artifact-gate CLI execution seam. */
export interface ArtifactGateCliOptions {
	repoRoot?: string | undefined;
	files?: string[] | undefined;
	registryPath?: string | undefined;
	json?: boolean | undefined;
}

/** Usage error codes emitted before artifact provenance evaluation starts. */
export type ArtifactGateUsageErrorCode =
	| "artifact-gate.files_required"
	| "artifact-gate.files_missing_value"
	| "artifact-gate.registry_missing_value";

/** User-facing artifact-gate usage error payload. */
export interface ArtifactGateUsageError {
	code: ArtifactGateUsageErrorCode;
	message: string;
	fix?: string | undefined;
}

/** Parsed raw argv result for artifact-gate command dispatch. */
export type ArtifactGateCliArgsResult =
	| {
			ok: true;
			options: ArtifactGateCliOptions;
	  }
	| {
			ok: false;
			error: ArtifactGateUsageError;
			json?: boolean | undefined;
	  };
