import type { CIProvider } from "./types.js";

/**
 * Default CI provider used when scaffold render context does not specify one.
 */
export const DEFAULT_CI_PROVIDER: CIProvider = "circleci";

/**
 * Determine whether a scaffold template should be emitted for the specified CI provider.
 *
 * @param templatePath - Relative template path to evaluate.
 * @param ciProvider - Chosen CI provider used to decide template inclusion.
 * @returns `true` if the template applies to the given provider.
 */
export function isTemplateEnabledForProvider(
	templatePath: string,
	ciProvider: CIProvider,
): boolean {
	if (templatePath.startsWith(".github/workflows/")) {
		if (templatePath === ".github/workflows/release-private-npm.yml") {
			return true;
		}
		return ciProvider === "github-actions";
	}
	if (templatePath === ".circleci/config.yml") {
		return ciProvider === "circleci";
	}
	return true;
}
