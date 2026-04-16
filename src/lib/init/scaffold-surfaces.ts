/**
 * Surface-based template grouping for the init scaffold (JSC-106).
 *
 * Provides:
 * - Surface type definition for template output categories
 * - Template-to-surface classification function
 * - Surface-based template querying for independent testing
 *
 * @module lib/init/scaffold-surfaces
 */

import type { Template } from "./types.js";

// ---------------------------------------------------------------------------
// Surface types
// ---------------------------------------------------------------------------

/**
 * Each surface represents a distinct output category of the init scaffold.
 *
 * Templates are classified by their output path and purpose, enabling
 * independent testing and reasoning about each generated surface.
 */
export type ScaffoldSurface =
	| "contract" // harness.contract.json, memory.json
	| "ci" // .github/workflows/*, .circleci/*, ci-required-checks.json
	| "scripts" // scripts/* (verify-work, validate-codestyle, prepare-worktree, etc.)
	| "config" // biome.json, .gitleaks.toml, prek.toml, .mise.toml, .npmrc, .coderabbit.yaml
	| "docs" // CONTRIBUTING.md, CODESTYLE.md, PULL_REQUEST_TEMPLATE.md, WORKFLOW.md
	| "diagrams" // .diagram/*, scripts/*diagram*
	| "codex" // codex-preflight, codex-learn, codex-enforced, codex environment
	| "git-hooks" // commit-msg validation, setup-git-hooks, prek hooks
	| "community" // ISSUE_TEMPLATE, CODEOWNERS, Makefile
	| "workflow" // WORKFLOW.md (governance workflow spec)
	| "project-brain" // .harness/knowledge/*, project brain templates
	| "other"; // Unclassified templates

export const ALL_SURFACES: readonly ScaffoldSurface[] = [
	"contract",
	"ci",
	"scripts",
	"config",
	"docs",
	"diagrams",
	"codex",
	"git-hooks",
	"community",
	"workflow",
	"project-brain",
	"other",
] as const;

// ---------------------------------------------------------------------------
// Surface classification
// ---------------------------------------------------------------------------

/**
 * Classify a template into its output surface based on its path.
 *
 * @param templatePath - The relative output path of the template.
 * @returns The surface classification for the template.
 */
export function classifySurface(templatePath: string): ScaffoldSurface {
	// Contract artifacts
	if (
		templatePath === "harness.contract.json" ||
		templatePath === "memory.json"
	) {
		return "contract";
	}

	// CI/CD artifacts
	if (
		templatePath.startsWith(".github/workflows/") ||
		templatePath.startsWith(".circleci/") ||
		templatePath === ".harness/ci-required-checks.json" ||
		templatePath === ".harness/ci-provider-transition-status.json"
	) {
		return "ci";
	}

	// Scripts
	if (templatePath.startsWith("scripts/")) {
		// Further classify script sub-categories
		if (
			templatePath.includes("diagram") ||
			templatePath === "scripts/refresh-diagram-context.sh" ||
			templatePath === "scripts/check-diagram-freshness.sh"
		) {
			return "diagrams";
		}
		if (
			templatePath === "scripts/codex-preflight.sh" ||
			templatePath === "scripts/codex-preflight-local-memory-legacy.sh" ||
			templatePath === "scripts/codex-learn" ||
			templatePath === "scripts/codex-enforced"
		) {
			return "codex";
		}
		if (
			templatePath === "scripts/validate-commit-msg.js" ||
			templatePath === "scripts/setup-git-hooks.js"
		) {
			return "git-hooks";
		}
		return "scripts";
	}

	// Config/tooling
	if (
		templatePath === "biome.json" ||
		templatePath === ".gitleaks.toml" ||
		templatePath === "prek.toml" ||
		templatePath === ".mise.toml" ||
		templatePath === ".npmrc" ||
		templatePath === ".coderabbit.yaml"
	) {
		return "config";
	}

	// Docs
	if (
		templatePath === "CONTRIBUTING.md" ||
		templatePath === "CODESTYLE.md" ||
		templatePath === ".github/PULL_REQUEST_TEMPLATE.md"
	) {
		return "docs";
	}

	// Workflow
	if (templatePath === "WORKFLOW.md") {
		return "workflow";
	}

	// Community/issue tracking
	if (
		templatePath.startsWith(".github/ISSUE_TEMPLATE") ||
		templatePath === ".github/CODEOWNERS" ||
		templatePath === "Makefile"
	) {
		return "community";
	}

	// Diagrams
	if (templatePath.startsWith(".diagram") || templatePath === ".diagramrc") {
		return "diagrams";
	}

	// Project brain
	if (
		templatePath.startsWith(".harness/knowledge") ||
		templatePath.startsWith(".harness/quality") ||
		templatePath.startsWith(".harness/decisions") ||
		templatePath.startsWith(".harness/review-log")
	) {
		return "project-brain";
	}

	return "other";
}

// ---------------------------------------------------------------------------
// Surface-based template querying
// ---------------------------------------------------------------------------

/**
 * Group templates by their output surface.
 *
 * @param templates - The full template array.
 * @returns A map from surface name to the templates in that surface.
 */
export function groupTemplatesBySurface(
	templates: readonly Template[],
): Map<ScaffoldSurface, Template[]> {
	const groups = new Map<ScaffoldSurface, Template[]>();

	for (const template of templates) {
		const surface = classifySurface(template.path);
		const existing = groups.get(surface);
		if (existing) {
			existing.push(template);
		} else {
			groups.set(surface, [template]);
		}
	}

	return groups;
}

/**
 * Get templates for a specific surface.
 *
 * Useful for independent testing of a single surface without
 * rendering all templates.
 *
 * @param templates - The full template array.
 * @param surface - The surface to filter by.
 * @returns Templates belonging to the requested surface.
 */
export function getTemplatesForSurface(
	templates: readonly Template[],
	surface: ScaffoldSurface,
): Template[] {
	return templates.filter((t) => classifySurface(t.path) === surface);
}

/**
 * Render all templates for a specific surface.
 *
 * Returns the rendered output for each template in the surface,
 * enabling independent validation of generated surfaces.
 *
 * @param templates - The full template array.
 * @param surface - The surface to render.
 * @param pm - The package manager name.
 * @param context - The template render context.
 * @returns An array of { path, content } objects for each template in the surface.
 */
export function renderSurface(
	templates: readonly Template[],
	surface: ScaffoldSurface,
	pm: string,
	context: Parameters<Template["render"]>[1],
): Array<{ path: string; content: string }> {
	const surfaceTemplates = getTemplatesForSurface(templates, surface);
	return surfaceTemplates.map((t) => ({
		path: t.path,
		content: t.render(pm, context),
	}));
}
