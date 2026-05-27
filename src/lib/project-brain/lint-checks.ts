import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
	BrainLintFinding,
	BrainLintFindingKind,
	BrainLintResult,
	BrainLintSeverity,
} from "./lint-types.js";
import {
	collectBrainMarkdownPages,
	parseBrainFrontmatter,
	parseBrainFrontmatterList,
	type BrainMarkdownPage,
} from "./lint-pages.js";
import { lintAttachmentPaths } from "./lint-attachments.js";

const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
const STALE_REVIEWED_DAYS = 90;
const REQUIRED_FRONTMATTER_FIELDS = [
	"type",
	"status",
	"sources",
	"aliases",
	"confidence",
	"reviewed",
	"sensitivity",
] as const;
const VALID_SENSITIVITY = new Set([
	"public",
	"internal",
	"confidential",
	"restricted",
]);

function pushFinding(
	findings: BrainLintFinding[],
	options: {
		severity?: BrainLintSeverity;
		kind: BrainLintFindingKind;
		path: string;
		line?: number;
		evidence: string;
	},
): void {
	findings.push({
		severity: options.severity ?? "warning",
		kind: options.kind,
		path: options.path,
		line: options.line,
		evidence: options.evidence,
		owner: "project-brain",
	});
}

function isPlaceholderValue(value: string): boolean {
	return /^(\(not yet\)|not yet|todo|tbd|manual|unknown)$/i.test(value.trim());
}

function isValidSourceValue(value: string): boolean {
	if (!value || isPlaceholderValue(value)) return false;
	return (
		/^[A-Za-z0-9._/-]+(?::\d+)?(?:#[A-Za-z0-9._/-]+)?$/.test(value) ||
		/^https?:\/\//.test(value)
	);
}

function parseReviewedDate(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return null;
	}
	return date;
}

function lintFrontmatterSources(
	page: BrainMarkdownPage,
	findings: BrainLintFinding[],
	frontmatter: Map<string, string>,
): void {
	const sources = parseBrainFrontmatterList(frontmatter.get("sources"));
	if (sources.length === 0) {
		pushFinding(findings, {
			kind: "missing_source",
			path: page.path,
			evidence:
				"Frontmatter sources must include at least one source reference.",
		});
		return;
	}
	for (const source of sources) {
		if (!isValidSourceValue(source)) {
			pushFinding(findings, {
				kind: "malformed_source",
				path: page.path,
				evidence: `Frontmatter source is not a durable path, URL, or anchored reference: ${source}`,
			});
		}
	}
}

function lintReviewedDate(
	page: BrainMarkdownPage,
	findings: BrainLintFinding[],
	frontmatter: Map<string, string>,
): void {
	const reviewed = frontmatter.get("reviewed");
	if (!reviewed) return;
	const reviewedDate = parseReviewedDate(reviewed);
	if (!reviewedDate) {
		pushFinding(findings, {
			kind: "stale_reviewed_date",
			path: page.path,
			evidence: "Reviewed date must use YYYY-MM-DD.",
		});
		return;
	}
	const ageMs = Date.now() - reviewedDate.getTime();
	const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
	if (ageDays > STALE_REVIEWED_DAYS) {
		pushFinding(findings, {
			kind: "stale_reviewed_date",
			path: page.path,
			evidence: `Reviewed date is ${String(ageDays)} days old; refresh or mark the page inactive.`,
		});
	}
}

function pageRequiresFrontmatter(path: string): boolean {
	return (
		/^knowledge\/[^/]+\/(knowledge|rules)\.md$/.test(path) ||
		path === "quality/criteria.md"
	);
}

function lintFrontmatter(
	page: BrainMarkdownPage,
	findings: BrainLintFinding[],
): void {
	if (!pageRequiresFrontmatter(page.path)) return;
	const frontmatter = parseBrainFrontmatter(page);
	if (!frontmatter) {
		pushFinding(findings, {
			kind: "missing_frontmatter",
			path: page.path,
			line: 1,
			evidence: "Page is missing Project Brain YAML frontmatter.",
		});
		return;
	}
	for (const field of REQUIRED_FRONTMATTER_FIELDS) {
		if (!frontmatter.has(field)) {
			pushFinding(findings, {
				kind:
					field === "sensitivity"
						? "missing_sensitivity"
						: "missing_frontmatter",
				path: page.path,
				evidence: `Frontmatter is missing ${field}.`,
			});
		}
	}
	const sensitivity = frontmatter.get("sensitivity");
	if (sensitivity && !VALID_SENSITIVITY.has(sensitivity)) {
		pushFinding(findings, {
			kind: "missing_sensitivity",
			path: page.path,
			evidence:
				"Sensitivity must be public, internal, confidential, or restricted.",
		});
	}
	lintFrontmatterSources(page, findings, frontmatter);
	lintReviewedDate(page, findings, frontmatter);
}

function lintSources(
	page: BrainMarkdownPage,
	findings: BrainLintFinding[],
): void {
	if (!/^knowledge\/[^/]+\/(knowledge|rules)\.md$/.test(page.path)) return;
	let pendingClaim:
		| { lineNumber: number; text: string; sourceSeen: boolean }
		| undefined;
	let section: "confirmed_facts" | "active_rules" | undefined;
	const flushPendingClaim = (): void => {
		if (!pendingClaim || pendingClaim.sourceSeen) return;
		pushFinding(findings, {
			kind: "missing_source",
			path: page.path,
			line: pendingClaim.lineNumber,
			evidence: "Claim has no adjacent Source field.",
		});
	};
	for (let index = 0; index < page.lines.length; index++) {
		const line = page.lines[index] ?? "";
		const lineNumber = index + 1;
		if (/^##\s+/.test(line)) {
			flushPendingClaim();
			pendingClaim = undefined;
			if (/^##\s+Confirmed facts\s*$/i.test(line)) section = "confirmed_facts";
			else if (/^##\s+Active rules\s*$/i.test(line)) section = "active_rules";
			else section = undefined;
		}
		const isClaim =
			(section === "confirmed_facts" && /^-\s+\S+/.test(line)) ||
			(section === "active_rules" && /^- \*\*R-[^*]+\*\*:/.test(line));
		if (isClaim) {
			flushPendingClaim();
			pendingClaim = { lineNumber, text: line.trim(), sourceSeen: false };
			continue;
		}
		const sourceMatch = /^\s+- Source:\s*(\S.*)$/.exec(line);
		if (pendingClaim && sourceMatch) {
			pendingClaim.sourceSeen = true;
			const source = sourceMatch[1]?.trim() ?? "";
			if (!isValidSourceValue(source)) {
				pushFinding(findings, {
					kind: "malformed_source",
					path: page.path,
					line: lineNumber,
					evidence: `Claim source is not a durable path, URL, or anchored reference: ${source}`,
				});
			}
		}
	}
	flushPendingClaim();
}

function normalizeWikiTarget(target: string): string {
	return target.replace(/\.md$/, "");
}

function buildWikiTargets(pages: BrainMarkdownPage[]): Set<string> {
	const targets = new Set<string>();
	for (const page of pages) {
		if (!page.path.startsWith("knowledge/")) continue;
		targets.add(normalizeWikiTarget(page.path.slice("knowledge/".length)));
	}
	return targets;
}

function collectWikiAliases(
	pages: BrainMarkdownPage[],
	findings: BrainLintFinding[],
): Map<string, string> {
	const aliases = new Map<string, string>();
	for (const page of pages) {
		const frontmatter = parseBrainFrontmatter(page);
		const aliasesForPage = parseBrainFrontmatterList(
			frontmatter?.get("aliases"),
		);
		for (const aliasValue of aliasesForPage) {
			const alias = normalizeWikiTarget(aliasValue);
			const existing = alias ? aliases.get(alias) : undefined;
			if (alias && existing && existing !== page.path) {
				pushFinding(findings, {
					kind: "duplicate_alias",
					path: page.path,
					evidence: `Alias ${alias} is already used by ${existing}.`,
				});
			} else if (alias) {
				aliases.set(alias, page.path);
			}
		}
	}
	return aliases;
}

function lintWikilinks(
	pages: BrainMarkdownPage[],
	findings: BrainLintFinding[],
): void {
	const targets = buildWikiTargets(pages);
	const aliases = collectWikiAliases(pages, findings);
	for (const page of pages) {
		for (let index = 0; index < page.lines.length; index++) {
			const line = page.lines[index] ?? "";
			for (const match of line.matchAll(WIKILINK_REGEX)) {
				const target = normalizeWikiTarget(match[1] ?? "");
				if (target && !targets.has(target) && !aliases.has(target)) {
					pushFinding(findings, {
						kind: "broken_wikilink",
						path: page.path,
						line: index + 1,
						evidence: `Wikilink target not found: ${target}`,
					});
				}
			}
		}
	}
}

function domainFromPagePath(path: string): string | null {
	const match = /^knowledge\/([^/]+)\//.exec(path);
	return match?.[1] ?? null;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function indexReferencesDomain(content: string, domain: string): boolean {
	const escaped = escapeRegExp(domain);
	return new RegExp(
		`(?:\\]\\(\\./${escaped}/\\)|\\]\\(knowledge/${escaped}/\\)|\\[\\[${escaped}(?:/|\\]|#|\\|))`,
		"i",
	).test(content);
}

function lintOrphanDomains(
	pages: BrainMarkdownPage[],
	findings: BrainLintFinding[],
): void {
	const index = pages.find((page) => page.path === "knowledge/INDEX.md");
	if (!index) return;
	const domains = new Map<string, string[]>();
	for (const page of pages) {
		const domain = domainFromPagePath(page.path);
		if (!domain) continue;
		const paths = domains.get(domain) ?? [];
		paths.push(page.path);
		domains.set(domain, paths);
	}
	for (const [domain, paths] of domains) {
		if (indexReferencesDomain(index.content, domain)) continue;
		pushFinding(findings, {
			kind: "orphan_page",
			path: paths[0] ?? `knowledge/${domain}`,
			evidence: `Knowledge domain ${domain} is not referenced by knowledge/INDEX.md.`,
		});
	}
}

function summarizeLint(
	harnessDir: string,
	findings: BrainLintFinding[],
	filesScanned: number,
): BrainLintResult {
	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;
	const info = findings.filter((f) => f.severity === "info").length;
	return {
		schema_version: "project-brain-lint/v1",
		status: errors > 0 ? "fail" : warnings > 0 ? "warn" : "pass",
		harnessDir,
		findings,
		summary: { errors, warnings, info, filesScanned },
	};
}

/** Run read-only Project Brain lint checks for wiki-trust metadata. */
export function runBrainLintChecks(harnessDir: string): BrainLintResult {
	const findings: BrainLintFinding[] = [];
	if (!existsSync(harnessDir)) {
		pushFinding(findings, {
			severity: "error",
			kind: "unsupported_assertion",
			path: ".harness",
			evidence: "No .harness directory found.",
		});
		return summarizeLint(harnessDir, findings, 0);
	}
	const pages = collectBrainMarkdownPages(harnessDir);
	for (const page of pages) {
		lintFrontmatter(page, findings);
		lintSources(page, findings);
	}
	lintWikilinks(pages, findings);
	lintOrphanDomains(pages, findings);
	lintAttachmentPaths(harnessDir, pages, findings);
	if (!existsSync(join(harnessDir, "knowledge", "LOG.md"))) {
		pushFinding(findings, {
			kind: "missing_mutation_log",
			path: "knowledge/LOG.md",
			evidence: "Project Brain has no knowledge mutation log.",
		});
	}
	return summarizeLint(harnessDir, findings, pages.length);
}
