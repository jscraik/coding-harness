/**
 * src/lib/org/repositories.ts
 *
 * Re-exports `findRepositories` from src/commands/org-audit.ts so that
 * other commands (e.g. tooling-audit) can use it without a cross-command import.
 *
 * Long-term: findRepositories should live here exclusively and
 * src/commands/org-audit.ts should import from this module.
 */
export { findRepositories } from "../../commands/org-audit.js";
