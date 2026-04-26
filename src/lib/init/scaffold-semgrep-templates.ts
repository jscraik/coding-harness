/**
 * Semgrep scaffold template rendering for downstream repositories.
 *
 * This module owns the local Semgrep hook and CI support files installed by
 * `harness init`, keeping scanner bootstrap, changed-file scan, full scan, and
 * local ruleset rendering together.
 *
 * @module lib/init/scaffold-semgrep-templates
 */

import { renderPackagedRootFile } from "./scaffold-root-templates.js";

/** Files that make up the local Semgrep scaffold surface. */
export const SEMGREP_TEMPLATE_FILES = [
	"scripts/check-semgrep-changed.sh",
	"scripts/check-semgrep-full.sh",
	"scripts/semgrep-bootstrap.sh",
	"scripts/semgrep-pre-push.yml",
] as const;

/**
 * Render the changed-file Semgrep scanner script.
 *
 * @returns The packaged `scripts/check-semgrep-changed.sh` contents.
 */
export function renderSemgrepChangedScript(): string {
	return renderPackagedRootFile("scripts/check-semgrep-changed.sh");
}

/**
 * Render the full-repository Semgrep scanner script.
 *
 * @returns The packaged `scripts/check-semgrep-full.sh` contents.
 */
export function renderSemgrepFullScript(): string {
	return renderPackagedRootFile("scripts/check-semgrep-full.sh");
}

/**
 * Render shared Semgrep bootstrap helpers used by local and CI scanners.
 *
 * @returns The packaged `scripts/semgrep-bootstrap.sh` contents.
 */
export function renderSemgrepBootstrapScript(): string {
	return renderPackagedRootFile("scripts/semgrep-bootstrap.sh");
}

/**
 * Render the local Semgrep pre-push ruleset.
 *
 * @returns The packaged `scripts/semgrep-pre-push.yml` contents.
 */
export function renderSemgrepPrePushRules(): string {
	return renderPackagedRootFile("scripts/semgrep-pre-push.yml");
}
