import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sanitizeError } from "../input/sanitize.js";
import {
	type CIProvider,
	MANIFEST_FILE,
	type ManifestEntry,
	type ManifestResult,
	type RestoreManifest,
} from "./types.js";

type ManifestErrorResult = Extract<ManifestResult, { ok: false }>;

/** Options controlling restore-manifest load behavior. */
export interface LoadManifestOptions {
	requireMetadata?: boolean;
	operation?: string;
	preferredCiProvider?: CIProvider;
	dryRun?: boolean;
}

interface PathValidationResult {
	ok: boolean;
}

type AtomicWriteResult =
	| { ok: true; value: undefined }
	| { ok: false; error: { message: string } };

interface ManifestValidationDependencies {
	atomicWrite: (path: string, content: string) => AtomicWriteResult;
	calculateBackupHash: (relativePath: string) => string;
	resolveSafeWorkspaceSymlink: (
		base: string,
		relativePath: string,
	) => PathValidationResult;
	sanitizePath: (base: string, relativePath: string) => PathValidationResult;
}

function buildIncompleteManifestError(
	missingFields: string[],
	options: LoadManifestOptions,
): ManifestResult {
	const operationSuffix = options.operation ? ` for ${options.operation}` : "";
	return {
		ok: false,
		error: {
			code: "INCOMPLETE_MANIFEST",
			message: `Restore manifest is incomplete${operationSuffix}: missing ${missingFields.join(", ")}. Repair .harness/${MANIFEST_FILE} from a known-good tracked install, or remove .harness and re-run \`harness init --track\` when bootstrapping a fresh repo.`,
			path: MANIFEST_FILE,
		},
	};
}

function readContractProvider(targetDir: string): CIProvider | null {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return null;
	}

	try {
		const parsed = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			ciProviderPolicy?: { activeProvider?: string | undefined } | undefined;
		};
		const activeProvider = parsed.ciProviderPolicy?.activeProvider;
		if (activeProvider === "github-actions" || activeProvider === "circleci") {
			return activeProvider;
		}
	} catch {
		// Best-effort legacy detection only.
	}

	return null;
}

function inferLegacyManifestProvider(
	targetDir: string,
	preferredCiProvider?: CIProvider,
): { provider: CIProvider; source: string } | null {
	const contractProvider = readContractProvider(targetDir);
	if (contractProvider) {
		return {
			provider: contractProvider,
			source: "harness.contract.json ciProviderPolicy.activeProvider",
		};
	}

	const hasCircleCIConfig = existsSync(
		resolve(targetDir, ".circleci", "config.yml"),
	);
	const hasGitHubWorkflows = existsSync(
		resolve(targetDir, ".github", "workflows"),
	);

	if (hasCircleCIConfig && !hasGitHubWorkflows) {
		return { provider: "circleci", source: ".circleci/config.yml" };
	}
	if (hasGitHubWorkflows && !hasCircleCIConfig) {
		return { provider: "github-actions", source: ".github/workflows" };
	}
	if (preferredCiProvider) {
		return {
			provider: preferredCiProvider,
			source: "requested/default CI provider",
		};
	}

	return null;
}

function maybeRepairLegacyManifestProvider(
	targetDir: string,
	manifestPath: string,
	manifest: Record<string, unknown>,
	preferredCiProvider: CIProvider | undefined,
	dryRun: boolean | undefined,
	deps: ManifestValidationDependencies,
): ManifestResult | null {
	const inferred = inferLegacyManifestProvider(targetDir, preferredCiProvider);
	if (!inferred) {
		return null;
	}

	if (dryRun) {
		manifest.ciProvider = inferred.provider;
		return null;
	}

	const repairedManifest = {
		...manifest,
		ciProvider: inferred.provider,
	};
	const writeResult = deps.atomicWrite(
		manifestPath,
		JSON.stringify(repairedManifest, null, 2),
	);
	if (!writeResult.ok) {
		return {
			ok: false,
			error: {
				code: "WRITE_ERROR",
				message: `Failed to repair legacy restore manifest with inferred ciProvider "${inferred.provider}" from ${inferred.source}: ${writeResult.error.message}`,
				path: MANIFEST_FILE,
			},
		};
	}

	manifest.ciProvider = inferred.provider;
	return null;
}

function manifestError(
	message: string,
	path = MANIFEST_FILE,
): ManifestErrorResult {
	return {
		ok: false,
		error: {
			code: "WRITE_ERROR",
			message,
			path,
		},
	};
}

function parseManifestRecord(
	manifestPath: string,
): Record<string, unknown> | null {
	const content = readFileSync(manifestPath, "utf-8");
	const data = JSON.parse(content) as unknown;
	if (typeof data !== "object" || data === null) {
		return null;
	}
	return data as Record<string, unknown>;
}

function validateManifestFiles(
	targetDir: string,
	manifest: Record<string, unknown>,
	options: LoadManifestOptions,
	deps: ManifestValidationDependencies,
): ManifestErrorResult | { ok: true; value: ManifestEntry[] } {
	if (!Array.isArray(manifest.files)) {
		return manifestError("Restore manifest is corrupted: missing files array");
	}

	const validatedFiles: ManifestEntry[] = [];
	const allowSafeRepoSymlinks =
		options.operation === "check-updates" ||
		options.operation === "update" ||
		options.operation === "upgrade";
	for (const entry of manifest.files) {
		if (typeof entry !== "object" || entry === null) {
			return manifestError("Restore manifest is corrupted: invalid entry");
		}
		const e = entry as Record<string, unknown>;
		if (typeof e.path !== "string") {
			return manifestError("Restore manifest is corrupted: missing path");
		}

		const pathResult = deps.sanitizePath(targetDir, e.path);
		if (
			!pathResult.ok &&
			!(
				allowSafeRepoSymlinks &&
				deps.resolveSafeWorkspaceSymlink(targetDir, e.path).ok
			)
		) {
			return manifestError(
				`Path traversal blocked in manifest: ${e.path}`,
				e.path,
			);
		}

		if (e.action === "created") {
			validatedFiles.push({ path: e.path, action: "created" });
			continue;
		}
		if (e.action === "modified" && typeof e.backupHash === "string") {
			if (!/^[a-f0-9]{16}$/.test(e.backupHash)) {
				return manifestError(
					`Invalid backup hash format: ${e.backupHash}`,
					e.path,
				);
			}
			if (e.backupHash !== deps.calculateBackupHash(e.path)) {
				return manifestError(
					`Manifest backup hash mismatch for ${e.path}`,
					e.path,
				);
			}
			validatedFiles.push({
				path: e.path,
				action: "modified",
				backupHash: e.backupHash,
			});
			continue;
		}

		return manifestError(
			`Invalid manifest entry: action=${e.action}, backupHash=${e.backupHash}`,
			e.path,
		);
	}

	return { ok: true, value: validatedFiles };
}

function resolveManifestMetadata(
	manifest: Record<string, unknown>,
	options: LoadManifestOptions,
):
	| ManifestErrorResult
	| {
			ok: true;
			value: Pick<
				RestoreManifest,
				"harnessVersion" | "ciProvider" | "issueTracker" | "minimal"
			>;
	  } {
	const missingFields: string[] = [];
	if (
		typeof manifest.harnessVersion !== "string" ||
		manifest.harnessVersion.length === 0
	) {
		missingFields.push("harnessVersion");
	}
	if (
		manifest.ciProvider !== "github-actions" &&
		manifest.ciProvider !== "circleci"
	) {
		missingFields.push("ciProvider");
	}
	if (options.requireMetadata && missingFields.length > 0) {
		return buildIncompleteManifestError(missingFields, options);
	}

	const harnessVersion =
		typeof manifest.harnessVersion === "string"
			? manifest.harnessVersion
			: "0.0.0";
	const ciProvider =
		manifest.ciProvider === "circleci" ? "circleci" : "github-actions";
	const issueTracker =
		manifest.issueTracker === "github" || manifest.issueTracker === "none"
			? manifest.issueTracker
			: manifest.issueTracker === "linear"
				? "linear"
				: undefined;
	return {
		ok: true,
		value: {
			harnessVersion,
			ciProvider,
			...(manifest.minimal === true ? { minimal: true } : {}),
			...(issueTracker ? { issueTracker } : {}),
		},
	};
}

/**
 * Load, repair (legacy provider only), and validate rollback manifest content.
 *
 * @param targetDir - Repository root directory
 * @param manifestPath - Absolute manifest file path
 * @param options - Validation and metadata requirements
 * @param deps - Injected helpers from rollback orchestrator
 * @returns Validated restore manifest or structured error
 */
export function loadManifestData(
	targetDir: string,
	manifestPath: string,
	options: LoadManifestOptions,
	deps: ManifestValidationDependencies,
): ManifestResult {
	try {
		const manifest = parseManifestRecord(manifestPath);
		if (!manifest) {
			return manifestError("Restore manifest is corrupted: not an object");
		}

		const shouldRepairProvider =
			manifest.ciProvider !== "github-actions" &&
			manifest.ciProvider !== "circleci";
		if (shouldRepairProvider) {
			const repairResult = maybeRepairLegacyManifestProvider(
				targetDir,
				manifestPath,
				manifest,
				options.preferredCiProvider,
				options.dryRun,
				deps,
			);
			if (repairResult) {
				return repairResult;
			}
		}

		const filesResult = validateManifestFiles(
			targetDir,
			manifest,
			options,
			deps,
		);
		if (!filesResult.ok) {
			return filesResult;
		}

		const metadataResult = resolveManifestMetadata(manifest, options);
		if (!metadataResult.ok) {
			return metadataResult;
		}

		return {
			ok: true,
			value: {
				...metadataResult.value,
				files: filesResult.value,
			},
		};
	} catch (error) {
		return manifestError(`Failed to load manifest: ${sanitizeError(error)}`);
	}
}
