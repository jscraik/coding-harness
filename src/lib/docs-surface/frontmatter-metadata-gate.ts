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

/**
 * Collects frontmatter metadata violations from changed policy Markdown files.
 *
 * Scans each changed file under `repoRoot` that is a policy-document candidate, parses its YAML frontmatter to find any of the tracked metadata keys, and reports files where those keys also appear in body headings or TOC entries (ignoring fenced code blocks).
 *
 * @param options - Function options
 * @param options.repoRoot - Repository root directory used to resolve candidate file paths
 * @param options.changedFiles - List of changed file paths (deduplicated and processed in sorted order)
 * @param options.deletedFiles - Optional set of file paths that should be treated as deleted and skipped
 * @returns An array of FrontmatterViolation records describing files that duplicate frontmatter metadata in body headings or TOC entries
 */

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

/**
 * Load a file's UTF-8 contents when the file exists.
 *
 * @param path - Filesystem path to the file
 * @returns The file contents as a string if the file exists, `null` otherwise
 */
function loadFileIfPresent(path: string): string | null {
	if (!existsSync(path)) return null;
	return readFileSync(path, "utf-8");
}

/**
 * Determine whether a file path refers to a policy-document candidate.
 *
 * @param file - The file path (typically relative to the repository root)
 * @returns `true` if the path matches a configured policy-doc prefix or filename, `false` otherwise.
 */
function isPolicyDocCandidate(file: string): boolean {
	return (
		POLICY_DOC_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
		POLICY_DOC_FILES.has(file)
	);
}

/**
 * Extracts top-level keys from a triple-dashed YAML-style frontmatter block and returns the remaining document body.
 *
 * @param content - The full Markdown document text
 * @returns An object with `keys` (a set of frontmatter key names found between the opening and closing `---` delimiters) and `body` (the markdown content after the closing delimiter); `null` if the document does not start with a well-formed `---` frontmatter block
 */
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

/**
 * Detects which frontmatter metadata keys appear as top-level Markdown headings or TOC entries in a document body.
 *
 * Scans the provided Markdown `body` for headings (levels 1–6) and TOC list entries (e.g., `- [text](#...)` or `* [text](#...)`) and reports which of the supplied machine-readable `metadataKeys` appear as exact normalized labels. Headings and TOC entries inside fenced code blocks are ignored.
 *
 * @param body - The Markdown content after the frontmatter section.
 * @param metadataKeys - Metadata keys (already normalized) to check for duplication in headings or TOC entries.
 * @returns A sorted array of unique metadata keys that were found in headings or TOC entries within `body`.
 */
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

/**
 * Normalize a metadata label for stable comparison.
 *
 * @param value - The label text to normalize
 * @returns The input with backticks removed, trimmed, lowercased, and runs of whitespace replaced by single underscores
 */
function normaliseMetadataLabel(value: string): string {
	return value.replace(/`/g, "").trim().toLowerCase().replace(/\s+/g, "_");
}
