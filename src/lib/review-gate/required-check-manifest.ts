import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import type { HarnessContract } from "../contract/types.js";
import { sanitizeError } from "../input/sanitize.js";
import {
	type NormalizedRequiredChecksManifest,
	normalizeRequiredChecksManifest,
} from "../policy/required-checks.js";

const DEFAULT_REQUIRED_CHECK_MANIFEST_PATH = ".harness/ci-required-checks.json";

/** Raised when review-gate cannot parse or normalize a required-check manifest. */
export class RequiredChecksManifestError extends Error {
	readonly manifestPath: string;

	constructor(manifestPath: string, reason: string) {
		super(`Invalid required-check manifest '${manifestPath}': ${reason}`);
		this.name = "RequiredChecksManifestError";
		this.manifestPath = manifestPath;
	}
}

/** Resolve the configured required-check manifest path relative to the contract. */
export function resolveRequiredChecksManifestPath(
	contract: HarnessContract,
	contractPath?: string,
): string {
	const manifestPath =
		contract.ciProviderPolicy?.requiredCheckManifestPath ??
		DEFAULT_REQUIRED_CHECK_MANIFEST_PATH;
	const resolvedContractPath =
		typeof contractPath === "string" && contractPath.trim().length > 0
			? resolvePath(contractPath)
			: undefined;
	const contractDir = resolvedContractPath
		? dirname(resolvedContractPath)
		: process.cwd();
	if (isAbsolute(manifestPath)) {
		return manifestPath;
	}
	const manifestFromContractDir = resolvePath(contractDir, manifestPath);
	if (existsSync(manifestFromContractDir)) {
		return manifestFromContractDir;
	}
	if (manifestPath !== DEFAULT_REQUIRED_CHECK_MANIFEST_PATH) {
		return manifestFromContractDir;
	}
	let cursor = contractDir;
	while (true) {
		if (existsSync(resolvePath(cursor, ".git"))) {
			const manifestFromRepoRoot = resolvePath(cursor, manifestPath);
			if (existsSync(manifestFromRepoRoot)) {
				return manifestFromRepoRoot;
			}
		}
		const parent = dirname(cursor);
		if (parent === cursor) {
			return manifestFromContractDir;
		}
		cursor = parent;
	}
}

/** Load and normalize the active required-check manifest when present. */
export function loadNormalizedRequiredChecksManifest(
	contract: HarnessContract,
	contractPath?: string,
): NormalizedRequiredChecksManifest | undefined {
	const resolvedManifestPath = resolveRequiredChecksManifestPath(
		contract,
		contractPath,
	);
	if (!existsSync(resolvedManifestPath)) {
		return undefined;
	}
	let parsedManifest: unknown;
	try {
		parsedManifest = JSON.parse(readFileSync(resolvedManifestPath, "utf-8"));
	} catch (error) {
		throw new RequiredChecksManifestError(
			resolvedManifestPath,
			`malformed JSON (${sanitizeError(error)})`,
		);
	}
	const normalized = normalizeRequiredChecksManifest(parsedManifest);
	if (!normalized.ok) {
		throw new RequiredChecksManifestError(
			resolvedManifestPath,
			normalized.error,
		);
	}
	return normalized.value;
}
