import { dirname, isAbsolute, normalize, resolve } from "node:path";
import type { BrainLintFinding } from "./lint-types.js";
import type { BrainMarkdownPage } from "./lint-pages.js";

const MARKDOWN_LINK_REGEX = /!?\[[^\]]*\]\(([^)]+)\)/g;
const LOCAL_ATTACHMENT_REGEX = /\.(avif|gif|jpe?g|pdf|png|svg|webp)$/i;

function isExternalOrAnchorLink(target: string): boolean {
	return (
		target.startsWith("#") ||
		/^[a-z][a-z0-9+.-]*:/i.test(target) ||
		target.startsWith("mailto:")
	);
}

function normalizeLocalLinkTarget(target: string): string {
	return target.split("#")[0]?.split("?")[0]?.trim() ?? "";
}

function resolveLocalAttachmentPath(
	harnessDir: string,
	page: BrainMarkdownPage,
	target: string,
): string {
	if (isAbsolute(target)) {
		return normalize(target);
	}
	const repoRoot = dirname(harnessDir);
	const baseDir = target.startsWith(".harness/")
		? repoRoot
		: resolve(harnessDir, dirname(page.path));
	return resolve(baseDir, target);
}

function isApprovedAttachmentTarget(
	harnessDir: string,
	resolvedPath: string,
): boolean {
	const mediaDir = resolve(harnessDir, "media");
	const normalizedPath = normalize(resolvedPath);
	return (
		normalizedPath === mediaDir || normalizedPath.startsWith(`${mediaDir}/`)
	);
}

/** Validate that local markdown attachments stay under the Project Brain media path. */
export function lintAttachmentPaths(
	harnessDir: string,
	pages: BrainMarkdownPage[],
	findings: BrainLintFinding[],
): void {
	for (const page of pages) {
		for (let index = 0; index < page.lines.length; index++) {
			const line = page.lines[index] ?? "";
			for (const match of line.matchAll(MARKDOWN_LINK_REGEX)) {
				const rawTarget = match[1]?.trim() ?? "";
				if (!rawTarget || isExternalOrAnchorLink(rawTarget)) continue;
				const target = normalizeLocalLinkTarget(rawTarget);
				if (!LOCAL_ATTACHMENT_REGEX.test(target)) continue;
				const resolvedPath = resolveLocalAttachmentPath(
					harnessDir,
					page,
					target,
				);
				if (!isApprovedAttachmentTarget(harnessDir, resolvedPath)) {
					findings.push({
						severity: "warning",
						kind: "attachment_outside_approved_path",
						path: page.path,
						line: index + 1,
						evidence: `Local attachment must live under .harness/media: ${target}`,
						owner: "project-brain",
					});
				}
			}
		}
	}
}
