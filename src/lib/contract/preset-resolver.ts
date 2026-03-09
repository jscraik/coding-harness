/**
 * Preset Resolver - Orchestrates preset loading and merging
 *
 * Handles:
 * - Bundled preset resolution (built-in presets shipped with package)
 * - Remote preset loading with SSRF protection
 * - Circular inheritance detection
 * - Deep merge with security hardening
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
	isRemoteUrl,
	redactUrlCredentials,
	secureFetch,
	validateRemoteUrl,
} from "../governance/url-validator.js";
import {
	CircularInheritanceError,
	IntegrityError,
	PresetFetchError,
} from "./errors.js";
import { mergeContracts, validateNoDangerousKeys } from "./merger.js";
import type {
	BundledPreset,
	HarnessContract,
	HarnessContractWithPreset,
	LocalPreset,
	MergeResult,
	PresetReference,
	PresetSource,
	RemotePreset,
} from "./types.js";
import { DEFAULT_CONTRACT, MAX_INHERITANCE_DEPTH } from "./types.js";
import { validateContract } from "./validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BUNDLED_PRESET_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;
const MAX_REMOTE_PRESET_SIZE_BYTES = 1024 * 1024; // 1MB
const SRI_SHA256_PATTERN = /^sha256-[A-Za-z0-9+/=]+$/;

function verifyIntegrityHash(
	source: string,
	content: string,
	expectedIntegrity: string,
): void {
	if (!SRI_SHA256_PATTERN.test(expectedIntegrity)) {
		throw new PresetFetchError(
			redactUrlCredentials(source),
			`Invalid integrity format '${expectedIntegrity}'. Expected sha256-<base64>.`,
		);
	}

	const actualIntegrity = `sha256-${createHash("sha256").update(content, "utf-8").digest("base64")}`;
	if (actualIntegrity !== expectedIntegrity) {
		throw new IntegrityError(
			redactUrlCredentials(source),
			expectedIntegrity,
			actualIntegrity,
		);
	}
}

async function readResponseWithLimit(
	response: Response,
	source: string,
	maxBytes: number,
): Promise<string> {
	const contentLengthHeader = response.headers.get("content-length");
	if (contentLengthHeader) {
		const contentLength = Number.parseInt(contentLengthHeader, 10);
		if (Number.isFinite(contentLength) && contentLength > maxBytes) {
			throw new PresetFetchError(
				redactUrlCredentials(source),
				`Remote preset exceeds size limit (${contentLength} bytes > ${maxBytes} bytes)`,
			);
		}
	}

	if (!response.body) {
		const fallbackContent = await response.text();
		const fallbackBytes = Buffer.byteLength(fallbackContent, "utf-8");
		if (fallbackBytes > maxBytes) {
			throw new PresetFetchError(
				redactUrlCredentials(source),
				`Remote preset exceeds size limit (${fallbackBytes} bytes > ${maxBytes} bytes)`,
			);
		}
		return fallbackContent;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let totalBytes = 0;
	let content = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		if (!value) {
			continue;
		}
		totalBytes += value.byteLength;
		if (totalBytes > maxBytes) {
			await reader.cancel();
			throw new PresetFetchError(
				redactUrlCredentials(source),
				`Remote preset exceeds size limit (${totalBytes} bytes > ${maxBytes} bytes)`,
			);
		}
		content += decoder.decode(value, { stream: true });
	}

	content += decoder.decode();
	return content;
}

/**
 * Get the presets directory path.
 * In development: src/presets/
 * In production (dist): dist/presets/ (relative to this file)
 */
function getPresetsDirectory(): string {
	// Check if we're in development (src/) or production (dist/)
	const isDist = __dirname.includes("dist");
	if (isDist) {
		return join(__dirname, "..", "..", "presets");
	}
	// In development, presets are at src/presets/ relative to project root
	// __dirname is src/lib/contract/, so go up 2 levels then to src/presets
	return join(__dirname, "..", "..", "..", "src", "presets");
}

/**
 * Scan the presets directory for available preset files.
 * Returns sorted list of JSON filenames (without extension).
 */
function scanPresetsDirectory(): string[] {
	const presetsDir = getPresetsDirectory();

	if (!existsSync(presetsDir)) {
		return [];
	}

	try {
		const entries = readdirSync(presetsDir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
			.map((entry) => entry.name.replace(".json", ""))
			.sort();
	} catch {
		return [];
	}
}

/**
 * PresetResolver class with instance-level caches.
 *
 * This class provides preset resolution with:
 * - Instance-level caching for testability
 * - Configurable cache behavior
 * - Clear cache management
 */
export class PresetResolver {
	private presetCache = new Map<string, HarnessContract>();
	private remotePresetCache = new Map<string, HarnessContract>();

	/**
	 * Clear all caches.
	 */
	clearCache(): void {
		this.presetCache.clear();
		this.remotePresetCache.clear();
	}

	/**
	 * Get the list of available bundled preset names.
	 * Dynamically scans the presets directory.
	 */
	listBundledPresets(): string[] {
		return scanPresetsDirectory();
	}

	/**
	 * Load a bundled preset by name.
	 */
	getBundledPreset(name: string): HarnessContract | undefined {
		// Check cache first
		const cached = this.presetCache.get(name);
		if (cached !== undefined) {
			return JSON.parse(JSON.stringify(cached)); // Deep copy
		}

		const presetsDir = getPresetsDirectory();
		const presetPath = join(presetsDir, `${name}.json`);

		if (!existsSync(presetPath)) {
			return undefined;
		}

		try {
			const content = readFileSync(presetPath, "utf-8");
			const parsed = JSON.parse(content);

			// Validate for prototype pollution attempts before type casting
			try {
				validateNoDangerousKeys(parsed);
			} catch (error) {
				throw new PresetFetchError(
					name,
					`Security violation: ${error instanceof Error ? error.message : "Dangerous keys detected"}`,
				);
			}

			const preset = parsed as HarnessContract;

			// Validate the preset
			const validationResult = validateContract(preset);
			if (!validationResult.success) {
				throw new PresetFetchError(
					name,
					`Validation failed: ${validationResult.errors.map((e) => e.message).join(", ")}`,
				);
			}

			// Cache for future use
			this.presetCache.set(name, preset);

			return JSON.parse(JSON.stringify(preset)); // Deep copy
		} catch (error) {
			if (error instanceof PresetFetchError) {
				throw error;
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new PresetFetchError(name, `Failed to load preset: ${message}`);
		}
	}

	/**
	 * Check if source is a bundled preset name.
	 */
	private isBundledPresetName(source: string): source is BundledPreset {
		if (!BUNDLED_PRESET_NAME_PATTERN.test(source)) {
			return false;
		}
		return this.listBundledPresets().includes(source);
	}

	/**
	 * Load a bundled preset by name.
	 */
	private loadBundledPreset(name: BundledPreset): HarnessContract {
		const preset = this.getBundledPreset(name);
		if (!preset) {
			throw new PresetFetchError(
				name,
				`Unknown bundled preset: ${name}. Available: ${this.listBundledPresets().join(", ")}`,
			);
		}
		return preset;
	}

	/**
	 * Resolve a preset source to a contract.
	 */
	async resolvePreset(
		source: string,
		contractDir: string,
		visited: Set<string> = new Set(),
		depth = 0,
		reference?: PresetReference,
	): Promise<MergeResult> {
		// Depth check
		if (depth >= MAX_INHERITANCE_DEPTH) {
			throw new CircularInheritanceError([...visited, source]);
		}

		// Circular reference check
		const canonicalSource = this.getCanonicalSource(source, contractDir);
		if (visited.has(canonicalSource)) {
			throw new CircularInheritanceError([...visited, canonicalSource]);
		}
		visited.add(canonicalSource);

		// Determine source type and load
		let presetContract: HarnessContract;
		const sources: string[] = [source];

		if (this.isBundledPresetName(source)) {
			presetContract = this.loadBundledPreset(source as BundledPreset);
		} else if (isRemoteUrl(source)) {
			if (!reference?.integrity) {
				throw new PresetFetchError(
					redactUrlCredentials(source),
					"Remote preset references must include an integrity hash (sha256-...)",
				);
			}
			presetContract = await this.loadRemotePreset(
				source as RemotePreset,
				reference.integrity,
			);
		} else {
			presetContract = this.loadLocalPreset(source as LocalPreset, contractDir);
		}

		// Recursively resolve if this preset also extends others
		const contractWithExtends = presetContract as HarnessContractWithPreset;
		if (contractWithExtends.extends) {
			const extensions = normalizeExtends(contractWithExtends.extends);
			let merged: HarnessContract = { ...DEFAULT_CONTRACT };

			for (const ext of extensions) {
				const extResult = await this.resolvePreset(
					ext.source,
					contractDir,
					new Set(visited),
					depth + 1,
					ext,
				);
				merged = mergeContracts(merged, extResult.contract);
				sources.push(...extResult.sources);
			}

			// Merge this preset's overrides on top
			presetContract = mergeContracts(merged, presetContract);
		}

		return { contract: presetContract, sources };
	}

	/**
	 * Load a contract with full preset inheritance resolution.
	 */
	async loadContractWithInheritance(
		contractPath: string,
	): Promise<MergeResult> {
		const contractDir = dirname(contractPath);
		const canonicalPath = realpathSync(contractPath);

		// Load the base contract
		const content = readFileSync(contractPath, "utf-8");
		const data = JSON.parse(content);
		const validationResult = validateContract(data);

		if (!validationResult.success) {
			throw new Error(
				`Contract validation failed: ${validationResult.errors.map((e) => e.message).join(", ")}`,
			);
		}

		const contract = validationResult.data as HarnessContract;
		const contractWithExtends = contract as HarnessContractWithPreset;

		// Track sources for audit trail
		const sources: string[] = [contractPath];

		// If no extends, return as-is
		if (!contractWithExtends.extends) {
			return { contract, sources };
		}

		// Resolve all presets
		const extensions = normalizeExtends(contractWithExtends.extends);
		let merged: HarnessContract = { ...DEFAULT_CONTRACT };

		// Use canonical path for circular detection
		const visited = new Set<string>([canonicalPath]);

		for (const ext of extensions) {
			const presetResult = await this.resolvePreset(
				ext.source,
				contractDir,
				visited,
				0,
				ext,
			);
			merged = mergeContracts(merged, presetResult.contract);
			sources.push(...presetResult.sources);
		}

		// Merge current contract on top (highest priority)
		const finalContract = mergeContracts(merged, contract);

		// Post-merge validation: ensure the merged contract is still valid
		const postMergeValidation = validateContract(finalContract);
		if (!postMergeValidation.success) {
			throw new Error(
				`Post-merge contract validation failed: ${postMergeValidation.errors.map((e) => e.message).join(", ")}. This may indicate incompatible preset overrides.`,
			);
		}

		return { contract: finalContract, sources };
	}

	/**
	 * Load a remote preset with SSRF protection.
	 */
	private async loadRemotePreset(
		url: RemotePreset,
		integrity: string,
	): Promise<HarnessContract> {
		const cacheKey = `${url}#${integrity}`;
		// Check cache first
		const cached = this.remotePresetCache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		// Validate URL (SSRF protection with DNS rebinding protection)
		const validatedUrl = await validateRemoteUrl(url);
		const pinnedIp = validatedUrl.pinnedIp;

		if (!pinnedIp) {
			throw new PresetFetchError(
				redactUrlCredentials(url),
				"Failed to resolve IP for DNS rebinding protection",
			);
		}

		// Fetch with timeout using pinned IP (DNS rebinding protection)
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		try {
			const response = await secureFetch(validatedUrl.url, pinnedIp, {
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new PresetFetchError(
					redactUrlCredentials(url),
					`HTTP ${response.status}: ${response.statusText}`,
				);
			}

			const content = await readResponseWithLimit(
				response,
				url,
				MAX_REMOTE_PRESET_SIZE_BYTES,
			);
			verifyIntegrityHash(url, content, integrity);
			const data = JSON.parse(content);

			// Validate for prototype pollution attempts before type casting
			try {
				validateNoDangerousKeys(data);
			} catch (error) {
				throw new PresetFetchError(
					redactUrlCredentials(url),
					`Security violation: ${error instanceof Error ? error.message : "Dangerous keys detected"}`,
				);
			}

			const validationResult = validateContract(data);

			if (!validationResult.success) {
				throw new PresetFetchError(
					redactUrlCredentials(url),
					`Validation failed: ${validationResult.errors.map((e) => e.message).join(", ")}`,
				);
			}

			const contract = validationResult.data as HarnessContract;

			// Cache for session
			this.remotePresetCache.set(cacheKey, contract);

			return contract;
		} catch (error) {
			if (error instanceof PresetFetchError) {
				throw error;
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new PresetFetchError(
				redactUrlCredentials(url),
				message,
				error as Error,
			);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Load a local preset file with path traversal protection.
	 */
	private loadLocalPreset(
		presetPath: LocalPreset,
		contractDir: string,
	): HarnessContract {
		// Path traversal protection
		if (presetPath.includes("\0")) {
			throw new PresetFetchError(presetPath, "Null byte in path");
		}
		if (presetPath.startsWith("~")) {
			throw new PresetFetchError(
				presetPath,
				"Home directory expansion not allowed",
			);
		}
		if (isAbsolute(presetPath)) {
			throw new PresetFetchError(presetPath, "Absolute paths not allowed");
		}
		if (presetPath.includes("..")) {
			throw new PresetFetchError(presetPath, "Parent traversal not allowed");
		}

		// Resolve relative to contract directory
		const resolvedPath = join(contractDir, presetPath);

		// Check existence before resolving symlinks
		if (!existsSync(resolvedPath)) {
			throw new PresetFetchError(presetPath, "File not found");
		}

		// Resolve symlinks to get the real path
		// This prevents symlink-based path traversal attacks
		let realResolvedPath: string;
		try {
			realResolvedPath = realpathSync(resolvedPath);
		} catch {
			throw new PresetFetchError(
				presetPath,
				"Failed to resolve path (broken symlink?)",
			);
		}

		// Resolve the contract directory to its real path as well
		const realContractDir = realpathSync(contractDir);

		// Verify the real path (after symlink resolution) is within the contract directory
		// Normalize both paths and ensure the resolved path starts with contractDir + separator
		const normalizedContractDir = normalize(realContractDir);
		const normalizedResolved = normalize(realResolvedPath);
		const isWithinBase =
			normalizedResolved === normalizedContractDir ||
			normalizedResolved.startsWith(`${normalizedContractDir}${sep}`);

		if (!isWithinBase) {
			throw new PresetFetchError(
				presetPath,
				"Path escapes contract directory (symlink attack blocked)",
			);
		}

		// Load and validate using the resolved path
		const content = readFileSync(realResolvedPath, "utf-8");
		const data = JSON.parse(content);

		// Validate for prototype pollution attempts before type casting
		try {
			validateNoDangerousKeys(data);
		} catch (error) {
			throw new PresetFetchError(
				presetPath,
				`Security violation: ${error instanceof Error ? error.message : "Dangerous keys detected"}`,
			);
		}

		const validationResult = validateContract(data);

		if (!validationResult.success) {
			throw new PresetFetchError(
				presetPath,
				`Validation failed: ${validationResult.errors.map((e) => e.message).join(", ")}`,
			);
		}

		return validationResult.data as HarnessContract;
	}

	/**
	 * Get canonical source identifier for circular detection.
	 */
	private getCanonicalSource(source: string, contractDir: string): string {
		if (isRemoteUrl(source)) {
			return source;
		}
		if (this.isBundledPresetName(source)) {
			return `bundled:${source}`;
		}
		return realpathSync(join(contractDir, source));
	}
}

/**
 * Normalize extends field to PresetReference array.
 */
function normalizeExtends(
	extendsField:
		| PresetReference
		| PresetReference[]
		| PresetSource
		| PresetSource[],
): PresetReference[] {
	if (typeof extendsField === "string") {
		return [{ source: extendsField as PresetSource }];
	}
	if (Array.isArray(extendsField)) {
		return extendsField.map((ext) =>
			typeof ext === "string" ? { source: ext as PresetSource } : ext,
		);
	}
	return [extendsField];
}

// ============================================================================
// Backward-compatible function exports using singleton instance
// ============================================================================

const defaultResolver = new PresetResolver();

/**
 * Get the list of available bundled preset names.
 * @deprecated Use `new PresetResolver().listBundledPresets()` for testability
 */
export function listBundledPresets(): string[] {
	return defaultResolver.listBundledPresets();
}

/**
 * Load a bundled preset by name.
 * @deprecated Use `new PresetResolver().getBundledPreset()` for testability
 */
export function getBundledPreset(name: string): HarnessContract | undefined {
	return defaultResolver.getBundledPreset(name);
}

/**
 * Resolve a preset source to a contract.
 * @deprecated Use `new PresetResolver().resolvePreset()` for testability
 */
export async function resolvePreset(
	source: string,
	contractDir: string,
	visited?: Set<string>,
	depth?: number,
): Promise<MergeResult> {
	return defaultResolver.resolvePreset(source, contractDir, visited, depth);
}

/**
 * Load a contract with full preset inheritance resolution.
 * @deprecated Use `new PresetResolver().loadContractWithInheritance()` for testability
 */
export async function loadContractWithInheritance(
	contractPath: string,
): Promise<MergeResult> {
	return defaultResolver.loadContractWithInheritance(contractPath);
}

/**
 * Clear the remote preset cache (useful for testing).
 * @deprecated Use `new PresetResolver().clearCache()` for testability
 */
export function clearPresetCache(): void {
	defaultResolver.clearCache();
}

// PresetResolver is already exported as a class at line ~76
