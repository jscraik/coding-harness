import { execFileSync } from "node:child_process";
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
				findingKind: "repair_finding",
				code: "repair_generated_source_link",
				message:
					"Generated documentation projections are ignored by archive-candidate reporting.",
				suggestedAction: "repair_generated_source_link",
				actionAuthority: "advisory_only",
				requiresReviewedDecision: true,
				evidenceRefs: [file.path],
			});
			continue;
		}

		const metadata = parseMetadata(file.content);
		const protectionReasons = collectProtectionReasons(
			file.path,
			metadata,
			activeArtifacts.verifiedPaths,
		);
		if (protectionReasons.length > 0) {
			protectedFiles.push({
				path: file.path,
				reasons: protectionReasons,
				evidenceRefs: [file.path],
			});
			continue;
		}

		const candidate = classifyCandidate(file.path, metadata, references);
		if (candidate) candidates.push(candidate);
	}

	const summary = {
		candidateCount: candidates.length,
		repairFindingCount: repairFindings.length,
		protectedFileCount: protectedFiles.length,
		ignoredFileCount: ignoredFiles.length,
		fileListSource: scan.fileListSource,
		actionAuthority: "advisory_only" as const,
		mutationSupported: false as const,
	};
	const report: DocsArchiveCandidatesReport = {
		schema: DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA,
		advisoryStatus:
			candidates.length > 0 || repairFindings.length > 0 ? "warn" : "pass",
		generatedAt: now.toISOString(),
		repoRef: ".",
		headSha: readHeadSha(repoRoot),
		advisoryOnly: true,
		scannedFiles: summary,
		summary,
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
			lines.push(
				`- ${finding.path}: ${finding.code}; action=${finding.suggestedAction}`,
			);
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
					findingKind: "repair_finding",
					code: "active_reference_stale_or_unverified",
					message:
						"Active artifacts index is unavailable; it cannot protect execution inputs.",
					suggestedAction: "refresh_active_artifact_route",
					actionAuthority: "advisory_only",
					requiresReviewedDecision: true,
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
			findingKind: "repair_finding",
			code: "active_reference_stale_or_unverified",
			message:
				"Active artifacts index references paths that are missing from this checkout.",
			suggestedAction: "refresh_active_artifact_route",
			actionAuthority: "advisory_only",
			requiresReviewedDecision: true,
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
): ArchiveProtectedFile["reasons"] {
	const reasons: ArchiveProtectedFile["reasons"][number][] = [];
	if (ROOT_CANONICAL_DOCS.has(path)) reasons.push("root_entrypoint");
	if (metadata.authority === "canon" || metadata.canon_class === "canonical") {
		reasons.push("canon_or_canonical");
	}
	if (
		metadata.authority === "execution-input" ||
		metadata.lifecycle_status === "execution-input"
	) {
		reasons.push("execution_input");
	}
	if (activeArtifactPaths.has(path)) reasons.push("active_artifact_reference");
	if (
		metadata.authority === "secondary-context" ||
		path.includes("/research/")
	) {
		reasons.push("research_value_retained");
	}
	return [...new Set(reasons)];
}

function classifyCandidate(
	path: string,
	metadata: Record<string, string | string[]>,
	references: Set<string>,
): ArchiveCandidate | null {
	const reasons: ArchiveCandidate["reasons"][number][] = [];
	if (
		metadata.lifecycle_state === "superseded" ||
		metadata.lifecycle_status === "superseded"
	) {
		reasons.push("superseded_status");
	}
	if (metadata.lifecycle_state === "archived" && references.has(path)) {
		reasons.push("archived_status_without_index");
	}
	if (
		metadata.lifecycle_status === "execution-input" &&
		!references.has(path)
	) {
		reasons.push("not_active_artifact");
	}
	if (
		(metadata.lifecycle_status === "raw" ||
			metadata.source_type === "research") &&
		!metadata.canonical_destination
	) {
		reasons.push("raw_research_without_admission");
	}
	if (
		reasons.length === 0 &&
		isSupportingDocument(metadata) &&
		!references.has(path)
	) {
		reasons.push("no_inbound_references");
	}
	if (reasons.length === 0) return null;
	const candidate: ArchiveCandidate = {
		path,
		kind: "archive_candidate",
		reasons: [...new Set(reasons)],
		confidence: reasons.includes("superseded_status") ? "medium" : "low",
		suggestedAction: suggestedActionFor(reasons),
		actionAuthority: "advisory_only",
		requiresReviewedDecision: true,
		evidenceRefs: [path],
	};
	const status = lifecycleStatus(metadata);
	if (status) {
		candidate.lifecycleStatus = status;
	}
	return candidate;
}

function suggestedActionFor(
	reasons: readonly ArchiveCandidate["reasons"][number][],
): ArchiveCandidate["suggestedAction"] {
	if (reasons.includes("raw_research_without_admission")) {
		return "add_research_admission_pointer";
	}
	if (reasons.includes("not_active_artifact")) {
		return "refresh_active_artifact_route";
	}
	if (reasons.includes("archived_status_without_index")) {
		return "repair_archive_index_reference";
	}
	if (reasons.includes("superseded_status")) {
		return "create_separate_archive_decision";
	}
	return "review_for_retention";
}

function lifecycleStatus(
	metadata: Record<string, string | string[]>,
): string | undefined {
	const value =
		metadata.lifecycle_state ?? metadata.lifecycle_status ?? metadata.status;
	return typeof value === "string" ? value : undefined;
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

function readHeadSha(repoRoot: string): string | null {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: repoRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

function sortByPath<T extends { path: string }>(items: readonly T[]): T[] {
	return [...items].sort((left, right) => left.path.localeCompare(right.path));
}
