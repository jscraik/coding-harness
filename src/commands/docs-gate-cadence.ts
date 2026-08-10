import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type {
	HarnessContract,
	SurfaceRegistration,
} from "../lib/contract/types.js";
import { validateContract } from "../lib/contract/validator.js";
import type {
	ChangedFilesResolution,
	DocsGateOptions,
} from "./docs-gate-types.js";
import { CONTRACT_PATH } from "./docs-gate-types.js";

const AGENT_FIRST_STATUS_SURFACE_ID = "agent-first-status-matrix";
const AGENT_FIRST_STATUS_DOCUMENT = "docs/roadmap/agent-first-status.md";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Return trusted-base candidates in precedence order for candidate comparison. */
export function resolveBaseRefCandidates(options: DocsGateOptions): string[] {
	return [
		options.mergeQueueBaseSha,
		options.trustedBaseRef,
		"origin/main",
		"origin/master",
	].filter((value): value is string => Boolean(value?.trim()));
}

/**
 * Detect the one narrow status-cadence registration paired with its governed
 * document. All broader contract changes remain contract-policy work.
 */
export function isAgentFirstStatusCadenceRegistration(
	options: DocsGateOptions,
	repoRoot: string,
	resolution: ChangedFilesResolution,
): boolean {
	if (!hasExactCadencePaths(resolution)) return false;
	const baseline = resolveTrustedBaseContract(options, repoRoot);
	const current = readWorkingContract(repoRoot);
	return (
		baseline !== null &&
		current !== null &&
		hasExactCadenceRegistrationChange(baseline, current)
	);
}

/** Require the cadence document and contract to be the complete changed-path set. */
function hasExactCadencePaths(resolution: ChangedFilesResolution): boolean {
	const changed = new Set(resolution.changedFiles);
	return (
		changed.size === 2 &&
		changed.has(CONTRACT_PATH) &&
		changed.has(AGENT_FIRST_STATUS_DOCUMENT) &&
		!resolution.deletedFiles.includes(CONTRACT_PATH) &&
		!resolution.deletedFiles.includes(AGENT_FIRST_STATUS_DOCUMENT)
	);
}

/** Read the trusted base contract for a fail-closed semantic cadence comparison. */
function resolveTrustedBaseContract(
	options: DocsGateOptions,
	repoRoot: string,
): HarnessContract | null {
	for (const baseRef of resolveBaseRefCandidates(options)) {
		try {
			const mergeBase = gitOutput(repoRoot, [
				"merge-base",
				baseRef,
				"HEAD",
			]).trim();
			if (!mergeBase) continue;
			return parseValidatedContract(
				gitOutput(repoRoot, ["show", `${mergeBase}:${CONTRACT_PATH}`]),
			);
		} catch {
			// A cadence exception must have a trusted, inspectable base contract.
		}
	}
	return null;
}

/** Read the contract as it exists in the working tree, including staged edits. */
function readWorkingContract(repoRoot: string): HarnessContract | null {
	try {
		return parseValidatedContract(
			readFileSync(join(repoRoot, CONTRACT_PATH), "utf-8"),
		);
	} catch {
		return null;
	}
}

/** Parse at the contract schema boundary before cadence policy reads its fields. */
function parseValidatedContract(content: string): HarnessContract | null {
	try {
		const validation = validateContract(JSON.parse(content));
		return validation.success && validation.data ? validation.data : null;
	} catch {
		return null;
	}
}

/** Locate the single surface eligible for the cadence-only exception. */
function findAgentFirstStatusSurface(
	contract: HarnessContract,
): SurfaceRegistration | null {
	const matches =
		contract.productSurface?.surfaces.filter(
			(surface) => surface.surfaceId === AGENT_FIRST_STATUS_SURFACE_ID,
		) ?? [];
	return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** Confirm that the selected surface has the registered document and cadence. */
function isRegisteredWeeklyStatusSurface(
	surface: SurfaceRegistration,
): boolean {
	return (
		surface.evidenceReference === AGENT_FIRST_STATUS_DOCUMENT &&
		surface.reviewCadence === "weekly" &&
		Array.isArray(surface.ownedPaths) &&
		surface.ownedPaths.includes(AGENT_FIRST_STATUS_DOCUMENT) &&
		typeof surface.lastReviewedAt === "string" &&
		ISO_DATE.test(surface.lastReviewedAt)
	);
}

/** Verify that only this exact registered surface review date changed. */
function hasExactCadenceRegistrationChange(
	baseline: HarnessContract,
	current: HarnessContract,
): boolean {
	const baselineSurface = findAgentFirstStatusSurface(baseline);
	const currentSurface = findAgentFirstStatusSurface(current);
	if (
		!baselineSurface ||
		!currentSurface ||
		!isRegisteredWeeklyStatusSurface(baselineSurface) ||
		!isRegisteredWeeklyStatusSurface(currentSurface) ||
		baselineSurface.lastReviewedAt === currentSurface.lastReviewedAt
	) {
		return false;
	}
	const restoredCurrent = structuredClone(current);
	const restoredSurface = findAgentFirstStatusSurface(restoredCurrent);
	if (!restoredSurface) return false;
	restoredSurface.lastReviewedAt = baselineSurface.lastReviewedAt;
	return isDeepStrictEqual(baseline, restoredCurrent);
}

function gitOutput(repoRoot: string, args: readonly string[]): string {
	return execFileSync("git", ["-C", repoRoot, ...args], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}
