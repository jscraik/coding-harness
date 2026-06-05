import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type {
	ArchiveCandidateFileListSource,
	ArchiveIgnoredFile,
} from "./archive-candidates-contract.js";

const DOCUMENT_EXTENSIONS = new Set([
	".md",
	".mdx",
	".json",
	".yaml",
	".yml",
	".toml",
]);

const IGNORED_PREFIXES = [
	"node_modules/",
	"dist/",
	"coverage/",
	".cache/",
	"artifacts/",
	"src/templates/",
];

/** One tracked documentation-like source loaded for archive-candidate analysis. */
export interface ArchiveCandidateSourceFile {
	path: string;
	content: string;
}

/** Scanner output used by the advisory archive-candidate classifier. */
export interface ArchiveCandidateScanResult {
	files: readonly ArchiveCandidateSourceFile[];
	ignoredFiles: readonly ArchiveIgnoredFile[];
	fileListSource: ArchiveCandidateFileListSource;
}

/** Load tracked documentation-like files from the git index or injected fixtures. */
export function scanArchiveCandidateSources(options: {
	repoRoot: string;
	trackedFiles?: readonly string[];
}): ArchiveCandidateScanResult {
	const repoRoot = resolve(options.repoRoot);
	const trackedFiles = options.trackedFiles ?? listGitTrackedFiles(repoRoot);
	const fileListSource: ArchiveCandidateFileListSource = options.trackedFiles
		? "injected-fixture"
		: "git-index";
	const files: ArchiveCandidateSourceFile[] = [];
	const ignoredFiles: ArchiveIgnoredFile[] = [];

	for (const path of trackedFiles) {
		if (!isSupportedDocumentPath(path)) {
			ignoredFiles.push({
				path,
				reason: "unsupported_file_type",
				evidenceRefs: [path],
			});
			continue;
		}
		const resolved = resolve(repoRoot, path);
		if (!resolved.startsWith(repoRoot + sep) && resolved !== repoRoot) {
			ignoredFiles.push({
				path,
				reason: "path_outside_repo",
				evidenceRefs: [path],
			});
			continue;
		}
		try {
			const stat = lstatSync(resolved);
			if (stat.isSymbolicLink()) {
				const realPath = realpathSync(resolved);
				if (!realPath.startsWith(repoRoot + sep)) {
					ignoredFiles.push({
						path,
						reason: "path_outside_repo",
						evidenceRefs: [path],
					});
					continue;
				}
			}
			if (!stat.isFile() && !stat.isSymbolicLink()) continue;
			files.push({ path, content: readFileSync(resolved, "utf8") });
		} catch {
			ignoredFiles.push({
				path,
				reason: "metadata_unparseable",
				evidenceRefs: [path],
			});
		}
	}

	return { files, ignoredFiles, fileListSource };
}

/** Return true when a tracked path is a documentation-like source. */
export function isSupportedDocumentPath(path: string): boolean {
	if (path.startsWith("/") || path.includes("\\") || path.includes("../")) {
		return false;
	}
	if (IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
	const dotIndex = path.lastIndexOf(".");
	if (dotIndex < 0) return false;
	return DOCUMENT_EXTENSIONS.has(path.slice(dotIndex));
}

/** Extract repository-relative references from Markdown and config-like content. */
export function extractRepoPathReferences(
	path: string,
	content: string,
): readonly string[] {
	const refs = new Set<string>();
	for (const match of content.matchAll(/\[[^\]]*\]\(([^)#?:][^)]*)\)/g)) {
		const ref = normaliseMarkdownReference(path, match[1] ?? "");
		if (ref) refs.add(ref);
	}
	for (const match of content.matchAll(
		/(?:path|depends_on|validated_by|source_ref|canonical_destination|superseded_by):\s*["']?([^"',\]\s]+)["']?/g,
	)) {
		const ref = normaliseStructuredReference(match[1] ?? "");
		if (ref) refs.add(ref);
	}
	for (const match of content.matchAll(
		/["']((?:docs|\.harness|AI|src)\/[^"'#?]+)["']/g,
	)) {
		const ref = normaliseStructuredReference(match[1] ?? "");
		if (ref) refs.add(ref);
	}
	return [...refs].sort();
}

function listGitTrackedFiles(repoRoot: string): readonly string[] {
	const output = execFileSync("git", ["ls-files", "-z"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	return output.split("\0").filter(Boolean).sort();
}

function normaliseMarkdownReference(
	sourcePath: string,
	rawReference: string,
): string | null {
	const withoutAnchor = cleanReference(rawReference);
	if (!withoutAnchor) return null;
	if (isRepoRootReference(withoutAnchor)) {
		return normaliseRepoReference(withoutAnchor);
	}
	const sourceDirectory = sourcePath.includes("/")
		? sourcePath.slice(0, sourcePath.lastIndexOf("/"))
		: "";
	const joined = sourceDirectory
		? join(sourceDirectory, withoutAnchor)
		: withoutAnchor;
	return normaliseRepoReference(joined);
}

function normaliseStructuredReference(rawReference: string): string | null {
	const withoutAnchor = cleanReference(rawReference);
	if (!withoutAnchor) return null;
	return normaliseRepoReference(withoutAnchor);
}

function cleanReference(rawReference: string): string | null {
	const trimmed = rawReference.trim();
	if (
		!trimmed ||
		trimmed.startsWith("http://") ||
		trimmed.startsWith("https://") ||
		trimmed.startsWith("mailto:") ||
		trimmed.startsWith("#") ||
		trimmed.startsWith("/")
	) {
		return null;
	}
	const withoutAnchor = trimmed.split("#")[0]?.split("?")[0] ?? "";
	if (!withoutAnchor || withoutAnchor.includes("\\")) return null;
	return withoutAnchor;
}

function normaliseRepoReference(rawReference: string): string | null {
	const normalized = rawReference.replaceAll(sep, "/");
	if (normalized.startsWith("../") || normalized.includes("/../")) return null;
	return normalized;
}

function isRepoRootReference(rawReference: string): boolean {
	return /^(?:AI|docs|src|\.harness)\//.test(rawReference);
}
