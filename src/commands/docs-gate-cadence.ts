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

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };
type RawSurface = JsonObject;
type RawProductSurface = JsonObject & { surfaces?: RawSurface[] };
type ValidatedRawContract = JsonObject & {
	productSurface?: RawProductSurface;
};

interface ParsedContract {
	normalized: HarnessContract;
	raw: ValidatedRawContract;
}

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
	if (
		!hasExactCadencePaths(resolution) ||
		hasUncommittedCadenceChanges(repoRoot)
	) {
		return false;
	}
	const baseline = resolveTrustedBaseContract(options, repoRoot);
	const current = readWorkingContract(repoRoot);
	return (
		baseline !== null &&
		current !== null &&
		hasExactCadenceRegistrationChange(baseline, current)
	);
}

/** Keep a cadence exception bound to content that is staged or committed. */
function hasUncommittedCadenceChanges(repoRoot: string): boolean {
	const unstaged = gitOutput(repoRoot, [
		"diff",
		"--name-only",
		"--diff-filter=ACMRDT",
		"--",
		CONTRACT_PATH,
		AGENT_FIRST_STATUS_DOCUMENT,
	]).trim();
	const untracked = gitOutput(repoRoot, [
		"ls-files",
		"--others",
		"--exclude-standard",
		"--",
		CONTRACT_PATH,
		AGENT_FIRST_STATUS_DOCUMENT,
	]).trim();
	return Boolean(unstaged || untracked);
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
): ParsedContract | null {
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
function readWorkingContract(repoRoot: string): ParsedContract | null {
	try {
		const workingContent = readFileSync(join(repoRoot, CONTRACT_PATH), "utf-8");
		const stagedContent = readStagedContract(repoRoot);
		if (stagedContent !== undefined && stagedContent !== workingContent) {
			return null;
		}
		return parseValidatedContract(workingContent);
	} catch {
		return null;
	}
}

/** Read the staged contract when the index contains a contract change. */
function readStagedContract(repoRoot: string): string | undefined {
	const stagedPaths = gitOutput(repoRoot, [
		"diff",
		"--cached",
		"--name-only",
		"--",
		CONTRACT_PATH,
	]).trim();
	if (!stagedPaths) return undefined;
	return gitOutput(repoRoot, ["show", `:${CONTRACT_PATH}`]);
}

/** Parse at the contract schema boundary before cadence policy reads its fields. */
function parseValidatedContract(content: string): ParsedContract | null {
	try {
		const parsed: unknown = JSON.parse(content);
		const validation = validateContract(parsed);
		return validation.success && validation.data
			? { normalized: validation.data, raw: parsed as ValidatedRawContract }
			: null;
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
		isCalendarDate(surface.lastReviewedAt)
	);
}

/** Reject impossible calendar dates before granting the cadence exception. */
function isCalendarDate(value: string): boolean {
	if (!ISO_DATE.test(value)) return false;
	const year = Number(value.slice(0, 4));
	const month = Number(value.slice(5, 7));
	const day = Number(value.slice(8, 10));
	if (month < 1 || month > 12 || day < 1) return false;
	const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth = [
		31,
		leapYear ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	];
	if (day > (daysInMonth[month - 1] ?? 0)) return false;
	const today = new Date().toISOString().slice(0, 10);
	return value <= today;
}

/** Locate the same registered surface without losing raw optional fields. */
function findRawAgentFirstStatusSurface(
	contract: ValidatedRawContract,
): RawSurface | null {
	const productSurface = contract.productSurface;
	const surfaces = productSurface?.surfaces;
	if (!surfaces) return null;
	const matches = surfaces.filter(
		(surface) => surface.surfaceId === AGENT_FIRST_STATUS_SURFACE_ID,
	);
	return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** Verify that only this exact registered surface review date changed. */
function hasExactCadenceRegistrationChange(
	baseline: ParsedContract,
	current: ParsedContract,
): boolean {
	const baselineSurface = findAgentFirstStatusSurface(baseline.normalized);
	const currentSurface = findAgentFirstStatusSurface(current.normalized);
	if (
		!baselineSurface ||
		!currentSurface ||
		!isRegisteredWeeklyStatusSurface(baselineSurface) ||
		!isRegisteredWeeklyStatusSurface(currentSurface) ||
		baselineSurface.lastReviewedAt === currentSurface.lastReviewedAt
	) {
		return false;
	}
	const baselineRawSurface = findRawAgentFirstStatusSurface(baseline.raw);
	const restoredCurrent = structuredClone(current.raw);
	const restoredSurface = findRawAgentFirstStatusSurface(restoredCurrent);
	if (
		!baselineRawSurface ||
		!restoredSurface ||
		typeof baselineRawSurface.lastReviewedAt !== "string"
	) {
		return false;
	}
	restoredSurface.lastReviewedAt = baselineRawSurface.lastReviewedAt;
	return isDeepStrictEqual(baseline.raw, restoredCurrent);
}

function gitOutput(repoRoot: string, args: readonly string[]): string {
	return execFileSync("git", ["-C", repoRoot, ...args], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}
