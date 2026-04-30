import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Stable learning ID promoted into the frontmatter metadata validator. */
export const FRONTMATTER_METADATA_LEARNING_ID =
	"coderabbit.coding-harness.docs-frontmatter-machine-readable";

/** Rule ID emitted for frontmatter metadata body/TOC duplication. */
export const FRONTMATTER_METADATA_RULE_ID =
	"docs.frontmatter.metadata_not_prose";

/** Machine-readable frontmatter keys that must stay out of body prose headings. */
export const FRONTMATTER_METADATA_KEYS = [
	"schema_version",
	"status",
	"applies_to",
] as const;

/** Path-specific frontmatter metadata violation. */
export interface FrontmatterMetadataViolation {
	/** Markdown policy document containing the violation. */
	path: string;
	/** Frontmatter keys duplicated in body headings or Table of Contents entries. */
	violatedKeys: string[];
	/** Actionable remediation for the path. */
	fix: string;
	/** Source learning promoted into this durable validator. */
	sourceLearningId: typeof FRONTMATTER_METADATA_LEARNING_ID;
}

const POLICY_DOC_PREFIXES = ["docs/"] as const;
const POLICY_DOC_FILES = new Set(["AGENTS.md", "CONTRIBUTING.md", "README.md"]);

/** Collect policy-doc frontmatter metadata violations for changed Markdown files. */
export function collectFrontmatterMetadataViolations(options: {
	repoRoot: string;
	changedFiles: string[];
	deletedFiles?: Set<string>;
}): FrontmatterMetadataViolation[] {
	const deletedFiles = options.deletedFiles ?? new Set<string>();
	const violations: FrontmatterMetadataViolation[] = [];
	for (const file of [...new Set(options.changedFiles)].sort()) {
		if (
			deletedFiles.has(file) ||
			!file.endsWith(".md") ||
			!isPolicyDocCandidate(file)
		) {
			continue;
		}
import { join, resolve, sep } from "node:path";

// ... other code ...

export function collectFrontmatterMetadataViolations(options: {
  repoRoot: string;
  changedFiles: readonly string[];
  // ... other options
}): FrontmatterViolation[] {
  const violations: FrontmatterViolation[] = [];
  const repoRootResolved = resolve(options.repoRoot);
  
  for (const file of [...new Set(options.changedFiles)].sort()) {
    if (!isPolicyDocCandidate(file)) continue;
    
    const candidatePath = resolve(join(options.repoRoot, file));
    const withinRepo =
      candidatePath === repoRootResolved ||
      candidatePath.startsWith(`${repoRootResolved}${sep}`);
    if (!withinRepo) continue;
    
    const content = loadFileIfPresent(candidatePath);
    if (!content) continue;
    
    // ... rest of processing ...
  }
  
  return violations;
}
		const parsed = parseMarkdownFrontmatter(content);
		if (!parsed) continue;
		const metadataKeys = FRONTMATTER_METADATA_KEYS.filter((key) =>
			parsed.keys.has(key),
		);
		if (metadataKeys.length === 0) continue;
		const violatedKeys = findFrontmatterMetadataBodyViolations(
			parsed.body,
			metadataKeys,
		);
		if (violatedKeys.length === 0) continue;
		violations.push({
			path: file,
			violatedKeys,
			fix: `Move frontmatter keys out of body headings/TOC entries: ${violatedKeys.join(", ")}`,
			sourceLearningId: FRONTMATTER_METADATA_LEARNING_ID,
		});
	}
	return violations;
}

function loadFileIfPresent(path: string): string | null {
	if (!existsSync(path)) return null;
	return readFileSync(path, "utf-8");
}

function isPolicyDocCandidate(file: string): boolean {
	return (
		POLICY_DOC_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
		POLICY_DOC_FILES.has(file)
	);
}

function parseMarkdownFrontmatter(
	content: string,
): { keys: Set<string>; body: string } | null {
	if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
		return null;
	}
	const lines = content.split(/\r?\n/);
	const closingIndex = lines.findIndex(
		(line, index) => index > 0 && line === "---",
	);
	if (closingIndex < 0) return null;
	const keys = new Set<string>();
	for (const line of lines.slice(1, closingIndex)) {
		const key = line.match(/^([A-Za-z0-9_-]+):/)?.[1];
		if (key) keys.add(key);
	}
	return {
		keys,
		body: lines.slice(closingIndex + 1).join("\n"),
	};
}

function findFrontmatterMetadataBodyViolations(
	body: string,
	metadataKeys: readonly string[],
): string[] {
	const violations = new Set<string>();
	let inFence = false;
	for (const line of body.split(/\r?\n/)) {
		if (/^\s*(`{3,}|~{3,})/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const headingText = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)?.[1];
		const tocEntryText = line.match(/^\s*[-*]\s+\[([^\]]+)\]\(#[^)]+\)/)?.[1];
		for (const key of metadataKeys) {
			if (headingText && normaliseMetadataLabel(headingText) === key) {
				violations.add(key);
			}
			if (tocEntryText && normaliseMetadataLabel(tocEntryText) === key) {
				violations.add(key);
			}
		}
	}
	return [...violations].sort();
}

function normaliseMetadataLabel(value: string): string {
	return value.replace(/`/g, "").trim().toLowerCase().replace(/\s+/g, "_");
}
