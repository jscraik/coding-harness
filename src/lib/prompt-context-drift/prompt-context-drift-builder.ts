import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { assessActiveRouteRefs } from "../agent-readiness/active-route-refs.js";
import {
	PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION,
	type PromptContextDriftBlocker,
	type PromptContextDriftBlockerClass,
	type PromptContextDriftEvidenceUse,
	type PromptContextDriftNextActionClass,
	type PromptContextDriftReport,
	type PromptContextDriftSurface,
	type PromptContextDriftSurfaceId,
} from "./prompt-context-drift-report.js";

/** Options for producing the canonical prompt-context drift report. */
export interface PromptContextDriftReportBuildOptions {
	repoRoot?: string | undefined;
	generatedAt?: Date | undefined;
	producer?: string | undefined;
	evidenceUse?: PromptContextDriftEvidenceUse | undefined;
}

const HEAD_SHA = /^[0-9a-f]{40}$/u;

const ACTIVE_ARTIFACTS_PATH = ".harness/active-artifacts.md";
const RUNTIME_CARD_REFS = [
	".harness/runtime/runtime-card.json",
	".harness/runtime-card.json",
	"artifacts/runtime-card.json",
	"artifacts/runtime/runtime-card.json",
	"artifacts/runtime-cards/runtime-card.json",
] as const;

const DEFAULT_PROMPT_CONTEXT_DRIFT_REFS = [
	{
		surfaceId: "prompt_context",
		refId: "orientation:prompt_context",
		ref: "AGENTS.md",
		missingBlockerClass: "stale_prompt_context",
		nextActionClass: "refresh_prompt_context",
	},
	{
		surfaceId: "active_artifacts",
		refId: "orientation:active_artifacts",
		ref: ACTIVE_ARTIFACTS_PATH,
		missingBlockerClass: "stale_active_route",
		nextActionClass: "refresh_active_artifacts",
	},
	{
		surfaceId: "active_route",
		refId: "orientation:active_route",
		ref: "docs/goals/codex-runtime-evidence-verifier-cockpit/current-route.json",
		missingBlockerClass: "stale_active_route",
		nextActionClass: "refresh_active_artifacts",
	},
	{
		surfaceId: "project_brain_memory",
		refId: "orientation:project_brain_memory",
		ref: ".harness/memory/LEARNINGS.md",
		missingBlockerClass: "missing_project_brain_ref",
		nextActionClass: "refresh_project_brain",
	},
	{
		surfaceId: "project_brain_knowledge",
		refId: "orientation:project_brain_knowledge",
		ref: ".harness/knowledge/INDEX.md",
		missingBlockerClass: "missing_project_brain_ref",
		nextActionClass: "refresh_project_brain",
	},
	{
		surfaceId: "runtime_card_or_handoff",
		refId: "orientation:runtime_card",
		ref: "artifacts/runtime-card.json",
		missingBlockerClass: "stale_runtime_card",
		nextActionClass: "refresh_runtime_card",
	},
	{
		surfaceId: "receipt_head_sha",
		refId: "orientation:receipt_head_sha",
		ref: "harness.contract.json",
		missingBlockerClass: "missing_source_hash",
		nextActionClass: "refresh_receipts",
	},
] as const satisfies readonly {
	surfaceId: PromptContextDriftSurfaceId;
	refId: string;
	ref: string;
	missingBlockerClass: PromptContextDriftBlockerClass;
	nextActionClass: PromptContextDriftNextActionClass;
}[];

/** Build a repo-local orientation report with current file digests. */
export function buildPromptContextDriftReport(
	options: PromptContextDriftReportBuildOptions = {},
): PromptContextDriftReport {
	const repoRoot = resolveRepoRoot(options.repoRoot);
	const generatedAt = options.generatedAt ?? new Date();
	const evidenceUse = options.evidenceUse ?? "orientation";
	const currentHeadSha = readCurrentHeadSha(repoRoot);
	const surfaces = DEFAULT_PROMPT_CONTEXT_DRIFT_REFS.map((entry) =>
		buildPromptContextDriftSurface({
			entry,
			repoRoot,
			currentHeadSha,
			evidenceUse,
		}),
	);
	const blockers = surfaces.flatMap((surface) => surface.blockers);

	return {
		schemaVersion: PROMPT_CONTEXT_DRIFT_REPORT_SCHEMA_VERSION,
		generatedAt: generatedAt.toISOString(),
		producer:
			options.producer ?? "scripts/write-prompt-context-drift-report.cjs",
		repoRootRef: "repo:.",
		currentHeadSha,
		evidenceUse,
		overallStatus: blockers.length === 0 ? "pass" : "warn",
		surfaces,
		blockers,
		nextAction:
			blockers.length === 0
				? "none"
				: "Refresh missing or stale prompt-context orientation surfaces.",
	};
}

function resolveRepoRoot(requestedRepoRoot: string | undefined): string {
	const base = realpathSync(resolve(process.cwd()));
	const requested = requestedRepoRoot ?? ".";
	const targetCandidate = isAbsolute(requested)
		? requested
		: repoAbsolutePath(base, normalizeRepoRelativePath(requested) ?? ".");
	const target = realpathSync(targetCandidate);
	const containment = relative(base, target);
	if (containment.startsWith("..") || isAbsolute(containment)) {
		throw new Error("repoRoot must stay inside the current working directory");
	}
	return target;
}

function buildPromptContextDriftSurface(input: {
	entry: (typeof DEFAULT_PROMPT_CONTEXT_DRIFT_REFS)[number];
	repoRoot: string;
	currentHeadSha: string | null;
	evidenceUse: PromptContextDriftEvidenceUse;
}): PromptContextDriftSurface {
	const sourceRoute = sourceRouteForEntry(input.entry, input.repoRoot);
	const refs = sourceRoute.refs;
	const sourceRefs = refs.map((ref) => {
		const digest = repoFileSha256(input.repoRoot, ref);
		return {
			refId: `${input.entry.refId}:${ref}`,
			surfaceId: input.entry.surfaceId,
			refKind: "repo_file" as const,
			ref,
			hashAlgorithm: digest === null ? null : ("sha256" as const),
			sha256: digest,
			freshness: digest === null ? ("missing" as const) : ("current" as const),
			evidenceUse: input.evidenceUse,
			requiredForClaimSupport: input.evidenceUse === "claim_support",
			requiresFilesystemExistence: digest !== null,
		};
	});
	const present =
		sourceRefs.length > 0 &&
		sourceRefs.every((ref) => ref.sha256 !== null) &&
		sourceRoute.staleReasons.length === 0;
	const blockers: PromptContextDriftBlocker[] = present
		? []
		: [
				{
					blockerClass: input.entry.missingBlockerClass,
					reason:
						sourceRoute.staleReasons[0] ??
						`${input.entry.ref} evidence is missing or unreadable.`,
					nextActionClass: input.entry.nextActionClass,
				},
			];
	return {
		surfaceId: input.entry.surfaceId,
		status: present ? "pass" : "warn",
		evidenceUse: input.evidenceUse,
		freshness: present ? "current" : "missing",
		requiredForClaimSupport: input.evidenceUse === "claim_support",
		observedHeadSha: input.currentHeadSha,
		currentHeadSha: input.currentHeadSha,
		sourceRefs,
		blockers,
	};
}

interface SourceRoute {
	refs: string[];
	staleReasons: string[];
}

function sourceRouteForEntry(
	entry: (typeof DEFAULT_PROMPT_CONTEXT_DRIFT_REFS)[number],
	repoRoot: string,
): SourceRoute {
	if (entry.surfaceId === "active_route") {
		return (
			activeRouteSourceRoute(repoRoot) ?? {
				refs: [entry.ref],
				staleReasons: [],
			}
		);
	}
	if (entry.surfaceId === "runtime_card_or_handoff") {
		return {
			refs: [firstExistingRepoRef(repoRoot, RUNTIME_CARD_REFS) ?? entry.ref],
			staleReasons: [],
		};
	}
	return { refs: [entry.ref], staleReasons: [] };
}

function activeRouteSourceRoute(repoRoot: string): SourceRoute | undefined {
	const activeArtifactsText = repoFileText(repoRoot, ACTIVE_ARTIFACTS_PATH);
	if (activeArtifactsText.length === 0) return undefined;
	const assessment = assessActiveRouteRefs({
		repoRoot,
		activeArtifactsText,
		activeArtifactsPath: ACTIVE_ARTIFACTS_PATH,
	});
	const refs = uniqueStrings([
		...assessment.evidenceRefs,
		...assessment.missingRefs.map((ref) => ref.normalizedPath),
	]);
	return refs.length > 0
		? { refs, staleReasons: assessment.staleReasons }
		: undefined;
}

function firstExistingRepoRef(
	repoRoot: string,
	candidates: readonly string[],
): string | undefined {
	return candidates.find(
		(candidate) => repoFileSha256(repoRoot, candidate) !== null,
	);
}

function repoFileSha256(repoRoot: string, ref: string): string | null {
	const repoRelativePath = normalizeRepoRelativePath(ref);
	if (repoRelativePath === null) return null;
	const resolved = repoAbsolutePath(repoRoot, repoRelativePath);
	try {
		const content = repoFileBytes(resolved);
		return content === null
			? null
			: createHash("sha256").update(content).digest("hex");
	} catch {
		return null;
	}
}

function repoFileText(repoRoot: string, ref: string): string {
	const repoRelativePath = normalizeRepoRelativePath(ref);
	if (repoRelativePath === null) return "";
	const resolved = repoAbsolutePath(repoRoot, repoRelativePath);
	try {
		return repoFileBytes(resolved)?.toString("utf8") ?? "";
	} catch {
		return "";
	}
}

function repoFileBytes(resolvedRepoFilePath: string): Buffer | null {
	const result = spawnSync("/bin/cat", [resolvedRepoFilePath], {
		encoding: "buffer",
		maxBuffer: 1024 * 1024,
		stdio: ["ignore", "pipe", "ignore"],
	});
	return result.status === 0 ? result.stdout : null;
}

function normalizeRepoRelativePath(value: string): string | null {
	if (value.trim().length === 0) return null;
	const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
	if (
		normalized.length === 0 ||
		normalized === "." ||
		normalized.startsWith("/") ||
		normalized.startsWith("..") ||
		normalized.includes("/../") ||
		/[\r\n\0]/u.test(normalized)
	) {
		return null;
	}
	return normalized;
}

function repoAbsolutePath(
	realRepoRoot: string,
	repoRelativePath: string,
): string {
	return [realRepoRoot, ...repoRelativePath.split("/")].join(sep);
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values)];
}

function readCurrentHeadSha(repoRoot: string): string | null {
	const result = spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	const value = result.status === 0 ? result.stdout.trim() : "";
	return HEAD_SHA.test(value) ? value : null;
}
