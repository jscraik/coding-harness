/**
 * src/lib/ci-migrate/init-bridge.ts
 *
 * Re-exports `runInitCLI` from src/commands/init.ts so that ci-migrate
 * can call init logic without a cross-command import.
 *
 * Long-term: the init orchestration logic should move to a pure lib module
 * and both commands should be thin CLI wrappers over it.
 */
export { runInitCLI } from "../../commands/init.js";
