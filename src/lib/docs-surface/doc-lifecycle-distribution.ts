import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRelative, walkFiles } from "./doc-lifecycle-paths.js";
import type {
	DocLifecycleManifestEntry,
	DocLifecycleViolation,
} from "./doc-lifecycle-types.js";

/** Block source-only lifecycle docs from leaking into downstream templates. */
export function collectDistributionBoundaryViolations(
	repoRoot: string,
	entries: DocLifecycleManifestEntry[],
): DocLifecycleViolation[] {
	const violations: DocLifecycleViolation[] = [];
	const sourceOnlyDocs = entries
		.filter((entry) => entry.distribution === "source-only")
		.map((entry) => entry.path)
		.filter((path) => path.startsWith("docs/") || path.startsWith(".agents/"));
	const templateRoot = join(repoRoot, "src/templates");
	if (!existsSync(templateRoot) || sourceOnlyDocs.length === 0)
		return violations;
	for (const templatePath of walkFiles(templateRoot)) {
		const content = readFileSync(templatePath, "utf-8");
		for (const sourceOnlyDoc of sourceOnlyDocs) {
			if (content.includes(sourceOnlyDoc)) {
				violations.push({
					path: repoRelative(repoRoot, templatePath),
					severity: "error",
					message:
						"Downstream template references a source-only document: " +
						sourceOnlyDoc,
					fix: "Move the reference to a packaged or generated surface, or reclassify the document distribution intentionally.",
				});
			}
		}
	}
	return violations;
}
