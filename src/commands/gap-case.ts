/**
 * Gap-case command compatibility surface.
 *
 * Implementation, argv parsing, and presentation live behind the gap-case
 * module seam under src/lib/gap-case.
 */

export { runGapCaseCLI, runGapCaseFromCliArgs } from "../lib/gap-case/cli.js";
export { openGapCase, resolveGapCase } from "../lib/gap-case/operations.js";
export { GAP_CASE_EXIT_CODES } from "../lib/gap-case/types.js";
export type {
	GapCaseOpenOptions,
	GapCaseRecord,
	GapCaseResolveOptions,
	GapCaseResult,
	GapCaseStoreV1,
} from "../lib/gap-case/types.js";
