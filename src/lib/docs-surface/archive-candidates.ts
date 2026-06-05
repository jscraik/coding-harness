import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA,
	type ArchiveCandidate,
	type ArchiveIgnoredFile,
	type ArchiveProtectedFile,
	type ArchiveRepairFinding,
	type DocsArchiveCandidatesReport,
	type RunDocsArchiveCandidatesOptions,
} from "./archive-candidates-contract.js";
import {
	extractRepoPathReferences,
	scanArchiveCandidateSources,
} from "./archive-candidates-scanner.js";
import { parseMarkdownFrontmatter } from "./doc-lifecycle-frontmatter.js";

const ACTIVE_ARTIFACTS_PATH = ".harness/active-artifacts.md";
const ROOT_CANONICAL_DOCS = new Set([
	"README.md",
	"AGENTS.md",
	"ARCHITECTURE.md",
	"CONTRIBUTING.md",
	"SECURITY.md",
	"CODESTYLE.md",
	"UBIQUITOUS_LANGUAGE.md",
	"docs/README.md",
]);
const GENERATED_PREFIXES = ["AI/context/", "artifacts/"];
const GENERATED_METADATA_VALUES = new Set([
	"generated",
	"generated-runtime",
	"backup-scratch",
]);

/** Run the advisory stale-document archive-candidate analysis. */
export function runDocsArchiveCandidates(
	options: RunDocsArchiveCandidatesOptions,
): DocsArchiveCandidatesReport {
	const repoRoot = resolve(options.repoRoot);
	const scanOptions: Parameters<typeof scanArchiveCandidateSources>[0] = {
		repoRoot,
	};
	if (options.trackedFiles) {
		scanOptions.trackedFiles = options.trackedFiles;
	}
	const scan = scanArchiveCandidateSources(scanOptions);
	const references = collectReferences(scan.files);
	const activeArtifacts = readActiveArtifacts(options, repoRoot);
	const candidates: ArchiveCandidate[] = [];
	const protectedFiles: ArchiveProtectedFile[] = [];
	const repairFindings: ArchiveRepairFinding[] = [...activeArtifacts.findings];
	const ignoredFiles: ArchiveIgnoredFile[] = [...scan.ignoredFiles];
	const now = options.now ?? new Date();

	for (const file of scan.files) {
		if (isGeneratedProjection(file.path, file.content)) {
			ignoredFiles.push({
				path: file.path,
				reason: "generated_output_do_not_edit",
				evidenceRefs: [file.path],
			});
			repairFindings.push({
				path: file.path,
				code: "repair_generated_source_link",
				message:
					"Generated documentation projections are ignored by archive-candidate reporting.",
				fix: "Update the source artifact or generator contract instead of editing the generated projection.",
				evidenceRefs: [file.path],
			});
			continue;
		}

		const metadata = parseMetadata(file.content);
		const protectionReasons = collectProtectionReasons(
			file.path,
			metadata,
			activeArtifacts.verifiedPaths,
			now,
		);
		if (protectionReasons.length > 0) {
			protectedFiles.push({
				path: file.path,
				reasons: protectionReasons,
				evidenceRefs: [file.path],
			});
			continue;
		}

		const candidate = classifyCandidate(file.path, metadata, references, now);
		if (candidate) candidates.push(candidate);
	}

	const report: DocsArchiveCandidatesReport = {
		schema: DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA,
		status: "pass",
		generatedAt: now.toISOString(),
		repoRoot,
		summary: {
			candidateCount: candidates.length,
			repairFindingCount: repairFindings.length,
			protectedFileCount: protectedFiles.length,
			ignoredFileCount: ignoredFiles.length,
			fileListSource: scan.fileListSource,
			actionAuthority: "advisory-only",
			mutationSupported: false,
		},
		candidates: sortByPath(candidates),
		repairFindings: sortByPath(repairFindings),
		protectedFiles: sortByPath(protectedFiles),
		ignoredFiles: sortByPath(ignoredFiles),
		evidenceRefs: ["docs/doc-lifecycle-manifest.json", ACTIVE_ARTIFACTS_PATH],
	};
	return report;
}

/** Render a compact human-readable archive-candidate report. */
export function formatDocsArchiveCandidatesText(
	report: DocsArchiveCandidatesReport,
): string {
	const lines = [
		"docs archive candidates: advisory-only",
		`candidates=${report.summary.candidateCount} repair_findings=${report.summary.repairFindingCount} protected=${report.summary.protectedFileCount} ignored=${report.summary.ignoredFileCount}`,
		`file_list_source=${report.summary.fileListSource} mutation_supported=false`,
	];
	if (report.candidates.length > 0) {
		lines.push("", "candidate samples:");
		for (const candidate of report.candidates.slice(0, 5)) {
			lines.push(
				`- ${candidate.path}: ${candidate.reasons.join(", ")}; action=${candidate.suggestedAction}; confidence=${candidate.confidence}`,
			);
		}
		if (report.candidates.length > 5) {
			lines.push(`- ... ${report.candidates.length - 5} more candidates`);
		}
	}
	if (report.repairFindings.length > 0) {
		lines.push("", "repair finding samples:");
		for (const finding of report.repairFindings.slice(0, 5)) {
			lines.push(`- ${finding.path}: ${finding.code}; ${finding.fix}`);
		}
		if (report.repairFindings.length > 5) {
			lines.push(
				`- ... ${report.repairFindings.length - 5} more repair findings`,
			);
		}
	}
	lines.push(
		"",
		"Full protected and ignored details are available with --json.",
	);
	return `${lines.join("\n")}\n`;
}

function collectReferences(
	files: readonly { path: string; content: string }[],
): Set<string> {
	const references = new Set<string>();
	for (const file of files) {
		for (const reference of extractRepoPathReferences(
			file.path,
			file.content,
		)) {
			references.add(reference);
		}
	}
	return references;
}

function readActiveArtifacts(
	options: RunDocsArchiveCandidatesOptions,
	repoRoot: string,
): { verifiedPaths: Set<string>; findings: ArchiveRepairFinding[] } {
	const path = options.activeArtifactsPath ?? ACTIVE_ARTIFACTS_PATH;
	const content =
		options.activeArtifactsContent !== undefined
			? options.activeArtifactsContent
			: existsSync(resolve(repoRoot, path))
				? readFileSync(resolve(repoRoot, path), "utf8")
				: null;
	if (content === null) {
		return {
			verifiedPaths: new Set(),
			findings: [
				{
					path,
					code: "active_artifacts_missing",
					message:
						"Active artifacts index is unavailable; it cannot protect execution inputs.",
					fix: "Repair .harness/active-artifacts.md before relying on it for route evidence.",
					evidenceRefs: [path],
				},
			],
		};
	}
	const linkedPaths = [...content.matchAll(/\((\.?\.?\/?[^)#]+)\)/g)]
		.map((match) => match[1] ?? "")
		.map((value) => value.replace(/^\.\//, ""))
		.filter((value) => value.startsWith(".harness/"));
	const stalePaths = linkedPaths.filter(
		(linkedPath) => !existsSync(resolve(repoRoot, linkedPath)),
	);
	const stalePathSet = new Set(stalePaths);
	const findings: ArchiveRepairFinding[] = [];
	if (stalePaths.length > 0) {
		findings.push({
			path,
			code: "active_artifacts_stale",
			message:
				"Active artifacts index references paths that are missing from this checkout.",
			fix: "Refresh the active artifact route before using it as execution-input evidence.",
			evidenceRefs: [path, ...stalePaths.slice(0, 3)],
		});
	}
	return {
		verifiedPaths: new Set(
			linkedPaths.filter((linkedPath) => !stalePathSet.has(linkedPath)),
		),
		findings,
	};
}

function parseMetadata(content: string): Record<string, string | string[]> {
	return (parseMarkdownFrontmatter(content) ?? {}) as Record<
		string,
		string | string[]
	>;
}

function collectProtectionReasons(
	path: string,
	metadata: Record<string, string | string[]>,
	activeArtifactPaths: Set<string>,
	now: Date,
): ArchiveProtectedFile["reasons"] {
	const reasons: ArchiveProtectedFile["reasons"][number][] = [];
	if (ROOT_CANONICAL_DOCS.has(path)) reasons.push("canonical_source");
	if (
		metadata.authority === "canon" ||
		metadata.canon_class === "canonical" ||
		metadata.lifecycle_state === "active"
	) {
		reasons.push("active_lifecycle_state");
	}
	if (
		metadata.authority === "execution-input" ||
		metadata.lifecycle_status === "execution-input"
	) {
		reasons.push("execution_input");
	}
	if (activeArtifactPaths.has(path)) reasons.push("active_artifact_verified");
	if (
		metadata.authority === "secondary-context" ||
		path.includes("/research/")
	) {
		reasons.push("research_value_retained");
	}
	if (
		metadata.last_reviewed &&
		daysBetween(metadata.last_reviewed, now) <= 90
	) {
		reasons.push("recently_reviewed");
	}
	return [...new Set(reasons)];
}

function classifyCandidate(
	path: string,
	metadata: Record<string, string | string[]>,
	references: Set<string>,
	now: Date,
): ArchiveCandidate | null {
	const reasons: ArchiveCandidate["reasons"][number][] = [];
	if (
		metadata.lifecycle_state === "superseded" ||
		metadata.lifecycle_status === "superseded"
	) {
		reasons.push("superseded_status");
	}
	if (metadata.lifecycle_state === "archived" && references.has(path)) {
		reasons.push("archived_status_still_active");
	}
	if (
		metadata.lifecycle_status === "execution-input" &&
		!references.has(path)
	) {
		reasons.push("stale_execution_input");
	}
	if (
		metadata.remove_after &&
		Date.parse(String(metadata.remove_after)) < now.getTime()
	) {
		reasons.push("expired_remove_after");
	}
	if (
		(metadata.lifecycle_status === "raw" ||
			metadata.source_type === "research") &&
		!metadata.canonical_destination
	) {
		reasons.push("raw_research_without_promotion");
	}
	if (
		reasons.length === 0 &&
		isSupportingDocument(metadata) &&
		!references.has(path)
	) {
		reasons.push("unreferenced_supporting_document");
	}
	if (reasons.length === 0) return null;
	return {
		path,
		reasons: [...new Set(reasons)],
		confidence:
			reasons.includes("superseded_status") ||
			reasons.includes("expired_remove_after")
				? "medium"
				: "low",
		suggestedAction: suggestedActionFor(reasons),
		evidenceRefs: [path],
	};
}

function suggestedActionFor(
	reasons: readonly ArchiveCandidate["reasons"][number][],
): ArchiveCandidate["suggestedAction"] {
	if (reasons.includes("raw_research_without_promotion")) {
		return "promote_or_archive_research";
	}
	if (reasons.includes("stale_execution_input")) return "repair_index";
	return "review_archive_candidate";
}

function isSupportingDocument(
	metadata: Record<string, string | string[]>,
): boolean {
	return (
		metadata.authority === "supporting" ||
		metadata.canon_class === "supporting" ||
		metadata.authority === "historical" ||
		metadata.canon_class === "historical"
	);
}

function isGeneratedProjection(path: string, content: string): boolean {
	if (GENERATED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
	const metadata = parseMetadata(content);
	return Object.values(metadata).some((value) =>
		Array.isArray(value)
			? value.some((item) => GENERATED_METADATA_VALUES.has(item))
			: GENERATED_METADATA_VALUES.has(value),
	);
}

function daysBetween(date: string | string[], now: Date): number {
	if (Array.isArray(date)) return Number.POSITIVE_INFINITY;
	const parsed = Date.parse(date);
	if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
	return Math.floor((now.getTime() - parsed) / 86_400_000);
}

function sortByPath<T extends { path: string }>(items: readonly T[]): T[] {
	return [...items].sort((left, right) => left.path.localeCompare(right.path));
}
