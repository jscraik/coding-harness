import { readFileSync } from "node:fs";
import type { Template } from "./types.js";

/**
 * Load a packaged GitBook scaffold asset from the immutable template bundle.
 *
 * @param path - Template-bundle-relative path beneath `src/templates`.
 * @returns UTF-8 template content for deterministic downstream rendering.
 */
const load = (path: string): string =>
	readFileSync(new URL(`../../templates/${path}`, import.meta.url), "utf8");

export const GITBOOK_TEMPLATES: Template[] = [
	{ path: ".gitbook.yaml", render: () => load("gitbook.yaml") },
	{ path: "docs/public/README.md", render: () => load("gitbook/README.md") },
	{ path: "docs/public/SUMMARY.md", render: () => load("gitbook/SUMMARY.md") },
	{
		path: "docs/public/architecture.md",
		render: () => load("gitbook/architecture.md"),
	},
	{
		path: "docs/public/delivery-lifecycle.md",
		render: () => load("gitbook/delivery-lifecycle.md"),
	},
	{
		path: "docs/public/trust-and-privacy.md",
		render: () => load("gitbook/trust-and-privacy.md"),
	},
	{
		path: "scripts/check-gitbook-readiness.mjs",
		render: () => load("check-gitbook-readiness.mjs"),
	},
	{
		path: ".harness/project-context-ref.json",
		render: (_pm, context) => {
			const projectId = context.projectName?.trim() || "project";
			return `${JSON.stringify({ schema_version: "synaipse-project-context-ref/v1", project_id: projectId, registry: "jamie-brain-project-registry", catalog_required: true, gitbook: { required: true, source: "docs/public", state: "configured_unobserved" } }, null, 2)}\n`;
		},
	},
];
