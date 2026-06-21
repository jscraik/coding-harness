import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
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
		ref: ".harness/active-artifacts.md",
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
	const target = realpathSync(resolve(base, requestedRepoRoot ?? "."));
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
	const digest = repoFileSha256(input.repoRoot, input.entry.ref);
	const present = digest !== null;
	const blockers: PromptContextDriftBlocker[] = present
		? []
		: [
				{
					blockerClass: input.entry.missingBlockerClass,
					reason: `${input.entry.ref} is missing or unreadable.`,
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
		sourceRefs: [
			{
				refId: input.entry.refId,
				surfaceId: input.entry.surfaceId,
				refKind: "repo_file",
				ref: input.entry.ref,
				hashAlgorithm: present ? "sha256" : null,
				sha256: digest,
				freshness: present ? "current" : "missing",
				evidenceUse: input.evidenceUse,
				requiredForClaimSupport: input.evidenceUse === "claim_support",
				requiresFilesystemExistence: present,
			},
		],
		blockers,
	};
}

function repoFileSha256(repoRoot: string, ref: string): string | null {
	const realRepoRoot = realpathSync(resolve(repoRoot));
	const resolved = resolve(realRepoRoot, ref);
	const containment = relative(realRepoRoot, resolved);
	if (containment.startsWith("..") || isAbsolute(containment)) return null;
	try {
		if (!statSync(resolved).isFile()) return null;
		return createHash("sha256").update(readFileSync(resolved)).digest("hex");
	} catch {
		return null;
	}
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
