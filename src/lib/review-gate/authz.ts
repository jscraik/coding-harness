/**
 * src/lib/review-gate/authz.ts
 *
 * Re-exports `runCheckAuthz` from the check-authz command so that
 * review-gate (and any other lib module) can depend on it without creating
 * a cross-command import. This bridge file is the correct lib-layer entry
 * point for authz preflight logic.
 *
 * Long-term: the runCheckAuthz implementation should move here and
 * src/commands/check-authz.ts should become a thin CLI wrapper.
 */
export { runCheckAuthz } from "../../commands/check-authz.js";
export type {
	AuthzViolation,
	CheckAuthzOptions,
	CheckAuthzOutput,
	CheckAuthzResult,
} from "../../commands/check-authz.js";
