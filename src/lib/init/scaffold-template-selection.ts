/**
 * Scaffold template selection rules for harness init.
 *
 * This module filters a template inventory by CI provider and init options while
 * keeping the registry module focused on the inventory itself.
 *
 * @module lib/init/scaffold-template-selection
 */

import { isTemplateEnabledForProvider } from "./scaffold-ci-template-selection.js";
import type { CIProvider, InitOptions, Template } from "./types.js";

/**
 * Files that belong to the deliberately small `init --minimal` contract.
 *
 * Minimal setup must not infer CI, review, memory, hook, documentation, or
 * governance choices for a repository. Tracked rollback adds its own manifest
 * after selection, so it is intentionally not part of this template list.
 */
const MINIMAL_MODE_TEMPLATE_PATHS = new Set(["harness.contract.json"]);

/**
 * Determines whether a template should be rendered for the selected init mode.
 *
 * @param templatePath - Relative path for the scaffold template.
 * @param ciProvider - CI provider used to include provider-specific templates.
 * @param options - Init options that influence template inclusion.
 * @returns `true` when the template should be emitted.
 */
export function shouldEmitTemplateForInit(
	templatePath: string,
	ciProvider: CIProvider,
	options?: InitOptions,
): boolean {
	if (!isTemplateEnabledForProvider(templatePath, ciProvider)) {
		return false;
	}

	if (options?.minimal) {
		return MINIMAL_MODE_TEMPLATE_PATHS.has(templatePath);
	}

	if (options?.issueTracker === "none" || options?.issueTracker === "github") {
		if (templatePath.startsWith(".linear/")) {
			return false;
		}
	}

	if (options?.issueTracker === "none") {
		if (templatePath.includes("ISSUE_TEMPLATE")) {
			return false;
		}
	}

	return true;
}

/**
 * Selects scaffold templates applicable to the specified CI provider and init options.
 *
 * @param templates - Full scaffold template inventory to filter.
 * @param ciProvider - CI provider used to include provider-specific templates.
 * @param options - Init options that influence template inclusion.
 * @returns Templates that should be rendered for the selected init mode.
 */
export function selectTemplatesForProvider(
	templates: readonly Template[],
	ciProvider: CIProvider,
	options?: InitOptions,
): Template[] {
	return templates.filter((template) =>
		shouldEmitTemplateForInit(template.path, ciProvider, options),
	);
}
