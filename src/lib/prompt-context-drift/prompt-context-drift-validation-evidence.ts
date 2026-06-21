import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { PROMPT_CONTEXT_DRIFT_SURFACES } from "./prompt-context-drift-types.js";
import {
	fail,
	failNull,
	isRecord,
} from "./prompt-context-drift-validation-utils.js";

const HEAD_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

type ContainedRepoFile = {
	realPath: string;
	relativePath: string;
};

/** Validate that a report ref points to a contained repo file with matching digest. */
export function validateRepoFileRef(
	ref: Record<string, unknown>,
	path: string,
	repoRoot: string,
	errors: string[],
): boolean {
	if (ref.refKind !== "repo_file") {
		if (ref.requiredForClaimSupport === true)
			errors.push(`${path}.refKind: required local evidence must be repo_file`);
		return false;
	}
	const root = realRoot(repoRoot, path, errors);
	if (!root) return false;
	const file = containedRepoFile(root, String(ref.ref), path, errors);
	if (!file) return false;
	return validateDigest(ref, root, file, path, errors);
}

function realRoot(
	repoRoot: string,
	path: string,
	errors: string[],
): string | null {
	try {
		return realpathSync(repoRoot);
	} catch {
		errors.push(`${path}.ref: repository root is not accessible`);
		return null;
	}
}

function containedRepoFile(
	root: string,
	refPath: string,
	path: string,
	errors: string[],
): ContainedRepoFile | null {
	if (
		refPath.length === 0 ||
		isAbsolute(refPath) ||
		refPath.split(/[\\/]+/u).includes("..")
	) {
		return failNull(errors, `${path}.ref: must be a valid repo-relative path`);
	}
	const resolvedRoot = resolve(root);
	const candidate = resolve(resolvedRoot, refPath);
	const relativePath = relative(resolvedRoot, candidate);
	if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
		return failNull(
			errors,
			`${path}.ref: resolved path escapes repository root`,
		);
	}
	if (!existsSync(candidate))
		return failNull(errors, `${path}.ref: required repo file does not exist`);
	try {
		const realPath = realpathSync(candidate);
		const realRelativePath = relative(resolvedRoot, realPath);
		if (escapesRepoRoot(realRelativePath)) {
			return failNull(
				errors,
				`${path}.ref: resolved path escapes repository root`,
			);
		}
		if (!statSync(realPath).isFile())
			return failNull(errors, `${path}.ref: required repo file is not a file`);
		return {
			realPath,
			relativePath: realRelativePath,
		};
	} catch {
		return failNull(
			errors,
			`${path}.ref: required repo file is not accessible`,
		);
	}
}

function validateDigest(
	ref: Record<string, unknown>,
	root: string,
	file: ContainedRepoFile,
	path: string,
	errors: string[],
): boolean {
	if (ref.hashAlgorithm !== "sha256" || !SHA256.test(String(ref.sha256)))
		return false;
	const relativePath = relative(root, file.realPath);
	if (
		relativePath.startsWith("..") ||
		escapesRepoRoot(relativePath) ||
		relativePath !== file.relativePath
	) {
		return fail(errors, `${path}.ref: resolved path escapes repository root`);
	}
	let content: Buffer;
	try {
		content = readFileSync(file.realPath);
	} catch {
		return fail(errors, `${path}.ref: required repo file is not readable`);
	}
	const actual = createHash("sha256").update(content).digest("hex");
	if (actual !== ref.sha256)
		return fail(errors, `${path}.sha256: digest mismatch`);
	return true;
}

/** Validate that a pass surface has current, hash-verified local evidence. */
export function validatePassSurfaceEvidence(
	surface: Record<string, unknown>,
	path: string,
	verifiedRefCount: number,
	errors: string[],
): void {
	if (surface.status !== "pass") return;
	if (surface.freshness !== "current")
		errors.push(`${path}.freshness: pass requires current`);
	if (Array.isArray(surface.blockers) && surface.blockers.length > 0) {
		errors.push(`${path}.blockers: pass requires no blockers`);
	}
	if (verifiedRefCount === 0) {
		errors.push(
			`${path}.sourceRefs: pass requires at least one repo-contained hash-verified ref`,
		);
	}
}

function escapesRepoRoot(repoRelativePath: string): boolean {
	return (
		repoRelativePath === ".." ||
		repoRelativePath.startsWith(`..${sep}`) ||
		isAbsolute(repoRelativePath)
	);
}

/** Validate claim-support report invariants across every required surface. */
export function validateClaimSupportReport(
	report: Record<string, unknown>,
	surfaces: Map<string, Record<string, unknown>>,
	errors: string[],
): void {
	if (report.overallStatus !== "pass")
		errors.push("overallStatus: claim support requires pass");
	if (!HEAD_SHA.test(String(report.currentHeadSha)))
		errors.push("currentHeadSha: claim support requires current head SHA");
	if (Array.isArray(report.blockers) && report.blockers.length > 0)
		errors.push("blockers: claim support requires no report blockers");
	for (const surfaceId of PROMPT_CONTEXT_DRIFT_SURFACES) {
		validateClaimSurface(surfaceId, surfaces.get(surfaceId), errors);
	}
}

function validateClaimSurface(
	surfaceId: string,
	surface: Record<string, unknown> | undefined,
	errors: string[],
): void {
	if (!surface) {
		errors.push(`surfaces: missing required local surface ${surfaceId}`);
		return;
	}
	if (surface.requiredForClaimSupport !== true)
		errors.push(
			"surfaces: required local surface " +
				surfaceId +
				" must set requiredForClaimSupport true",
		);
	if (surface.evidenceUse !== "claim_support")
		errors.push(
			"surfaces: required local surface " +
				surfaceId +
				" must use claim_support evidence",
		);
	if (surface.status !== "pass")
		errors.push(`surfaces: required local surface ${surfaceId} must pass`);
	if (surface.freshness !== "current")
		errors.push(
			`surfaces: required local surface ${surfaceId} must be current`,
		);
	if (Array.isArray(surface.blockers) && surface.blockers.length > 0)
		errors.push(
			"surfaces: required local surface " +
				surfaceId +
				" must not have blockers",
		);
	if (!hasClaimSupportLocalRef(surface)) {
		errors.push(
			"surfaces: required local surface " +
				surfaceId +
				" requires at least one repo-file claim-support ref with current sha256 evidence",
		);
	}
}

function hasClaimSupportLocalRef(surface: Record<string, unknown>): boolean {
	if (!Array.isArray(surface.sourceRefs)) return false;
	return surface.sourceRefs.some(
		(ref) =>
			isRecord(ref) &&
			ref.refKind === "repo_file" &&
			ref.requiredForClaimSupport === true &&
			ref.requiresFilesystemExistence === true &&
			ref.evidenceUse === "claim_support" &&
			ref.freshness === "current" &&
			ref.hashAlgorithm === "sha256" &&
			SHA256.test(String(ref.sha256)),
	);
}
