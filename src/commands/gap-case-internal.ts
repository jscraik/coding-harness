/**
 * Gap-case internal compatibility surface.
 *
 * Store, policy, and validation helpers live under src/lib/gap-case.
 */

export {
	DEFAULT_STORE_PATH,
	MAX_STORE_SIZE_BYTES,
	findExistingCase,
	generateCaseId,
	isAllowedPolicyStorePath,
	loadGapCasePolicy,
	loadStore,
	resolveStorePath,
	saveStore,
} from "../lib/gap-case/store.js";
export {
	isValidHttpsUrl,
	isValidSeverity,
	isValidSha,
} from "../lib/gap-case/validators.js";
