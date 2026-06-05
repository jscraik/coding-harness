import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
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
	".diagram/",
	"AI/context/",
	"src/templates/",
];
const REFERENCE_METADATA_KEYS =
	"(?:path|depends_on|validated_by|source_ref|canonical_destination|superseded_by)";

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
	trackedFiles: readonly string[];
}

/** Load tracked documentation-like files from the git index or injected fixtures. */
export function scanArchiveCandidateSources(options: {
	repoRoot: string;
	trackedFiles?: readonly string[];
}): ArchiveCandidateScanResult {
	const repoRoot = resolve(options.repoRoot);
	const trackedFiles = options.trackedFiles ?? listGitTrackedFiles(repoRoot);
	const trackedFileSet = new Set(trackedFiles);
	const fileListSource: ArchiveCandidateFileListSource = options.trackedFiles
		? "injected-fixture"
		: "git-index";
	const files: ArchiveCandidateSourceFile[] = [];
	const ignoredFiles: ArchiveIgnoredFile[] = [];

	for (const path of trackedFiles) {
		const ignoredReason = ignoredReasonForPath(path);
		if (ignoredReason) {
			ignoredFiles.push({
				path,
				reason: ignoredReason,
				evidenceRefs: [path],
			});
			continue;
		}
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
				ignoredFiles.push({
					path,
					reason: "symlink_not_allowed",
					evidenceRefs: [path],
				});
				continue;
			}
			if (!stat.isFile() || !trackedFileSet.has(path)) continue;
			files.push({ path, content: readFileSync(resolved, "utf8") });
		} catch {
			ignoredFiles.push({
				path,
				reason: "metadata_unparseable",
				evidenceRefs: [path],
			});
		}
	}

	return { files, ignoredFiles, fileListSource, trackedFiles };
}

/** Return true when a tracked path is a documentation-like source. */
export function isSupportedDocumentPath(path: string): boolean {
	if (path.startsWith("/") || path.includes("\\") || path.includes("../")) {
		return false;
	}
	if (ignoredReasonForPath(path)) return false;
	const dotIndex = path.lastIndexOf(".");
	if (dotIndex < 0) return false;
	return DOCUMENT_EXTENSIONS.has(path.slice(dotIndex));
}

function ignoredReasonForPath(
	path: string,
): ArchiveIgnoredFile["reason"] | null {
	if (path.startsWith(".diagram/") || path.startsWith("AI/context/")) {
		return "generated_output_do_not_edit";
	}
	return IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix))
		? "unsupported_file_type"
		: null;
}

/** Extract repository-relative references from Markdown and config-like content. */
export function extractRepoPathReferences(
	path: string,
	content: string,
): readonly string[] {
	const refs = new Set<string>();
	const referenceContent = stripFencedMarkdownBlocks(content);
	for (const match of referenceContent.matchAll(
		/\[[^\]]*\]\(([^)#?:][^)]*)\)/g,
	)) {
		const ref = normaliseMarkdownReference(path, match[1] ?? "");
		if (ref) refs.add(ref);
	}
	for (const match of referenceContent.matchAll(
		new RegExp(
			`${REFERENCE_METADATA_KEYS}:[ \\t]*["']?([^"',\\]\\s]+)["']?`,
			"g",
		),
	)) {
		const ref = normaliseStructuredReference(match[1] ?? "");
		if (ref) refs.add(ref);
	}
	for (const ref of extractListMetadataReferences(referenceContent)) {
		refs.add(ref);
	}
	for (const match of referenceContent.matchAll(
		/["']((?:docs|\.harness|AI|src)\/[^"'#?]+)["']/g,
	)) {
		const ref = normaliseStructuredReference(match[1] ?? "");
		if (ref) refs.add(ref);
	}
	return [...refs].sort();
}

function stripFencedMarkdownBlocks(content: string): string {
	return content
		.replace(/^~~~[\s\S]*?^~~~\s*$/gm, "")
		.replace(/^```[\s\S]*?^```\s*$/gm, "");
}

function extractListMetadataReferences(content: string): readonly string[] {
	const refs = new Set<string>();
	let activeListKey = false;
	for (const line of content.split(/\r?\n/)) {
		if (new RegExp(`^${REFERENCE_METADATA_KEYS}:\\s*$`).test(line)) {
			activeListKey = true;
			continue;
		}
		if (/^[A-Za-z_][A-Za-z0-9_-]*:\s*/.test(line)) {
			activeListKey = false;
		}
		if (!activeListKey) continue;
		const item = line.match(/^\s*-\s*["']?([^"',\]\s]+)["']?/);
		if (!item) continue;
		const ref = normaliseStructuredReference(item[1] ?? "");
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
	const normalized = rawReference
		.replaceAll(sep, "/")
		.replace(/^(?:\.\/)+/, "");
	if (normalized.startsWith("../") || normalized.includes("/../")) return null;
	return normalized;
}

function isRepoRootReference(rawReference: string): boolean {
	return /^(?:AI|docs|src|\.harness)\//.test(rawReference);
}
