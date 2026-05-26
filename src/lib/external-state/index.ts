export {
	EXTERNAL_STATE_CLAIM_BLOCKERS,
	EXTERNAL_STATE_SNAPSHOT_SCHEMA_VERSION,
	EXTERNAL_STATE_SOURCES,
	EXTERNAL_STATE_SOURCE_STATUSES,
} from "./types.js";
export type {
	ExternalStateClaimBlocker,
	ExternalStateClaimSupportResult,
	ExternalStateSnapshot,
	ExternalStateSource,
	ExternalStateSourceSnapshot,
	ExternalStateSourceStatus,
	ExternalStateValidationError,
	ExternalStateValidationResult,
} from "./types.js";
export { evaluateExternalStateClaimSupport } from "./claim-support.js";
export { validateExternalStateSnapshot } from "./validation.js";
