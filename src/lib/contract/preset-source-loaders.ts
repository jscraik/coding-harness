import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, normalize, sep } from "node:path";
import {
	redactUrlCredentials,
	secureFetch,
	validateRemoteUrl,
} from "../governance/url-validator.js";
import { IntegrityError, PresetFetchError } from "./errors.js";
import { validateNoDangerousKeys } from "./merger.js";
import type { HarnessContract, LocalPreset, RemotePreset } from "./types.js";
import { validateContract } from "./validator.js";

const MAX_REMOTE_PRESET_SIZE_BYTES = 1024 * 1024;
const SRI_SHA256_PATTERN = /^sha256-[A-Za-z0-9+/=]+$/;

function validatePresetData(source: string, data: unknown): HarnessContract {
	try {
		validateNoDangerousKeys(data);
	} catch (error) {
		throw new PresetFetchError(
			source,
			`Security violation: ${error instanceof Error ? error.message : "Dangerous keys detected"}`,
		);
	}

	const validationResult = validateContract(data);
	if (!validationResult.success) {
		throw new PresetFetchError(
			source,
			`Validation failed: ${validationResult.errors.map((error) => error.message).join(", ")}`,
		);
	}
	return validationResult.data as HarnessContract;
}

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

	return readStreamWithLimit(response.body, source, maxBytes);
}

async function readStreamWithLimit(
	body: ReadableStream<Uint8Array>,
	source: string,
	maxBytes: number,
): Promise<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let totalBytes = 0;
	let content = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
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

	return content + decoder.decode();
}

async function fetchRemotePresetContent(url: RemotePreset): Promise<string> {
	const validatedUrl = await validateRemoteUrl(url);
	const pinnedIp = validatedUrl.pinnedIp;
	if (!pinnedIp) {
		throw new PresetFetchError(
			redactUrlCredentials(url),
			"Failed to resolve IP for DNS rebinding protection",
		);
	}

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
		return content;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Load and validate a remote preset, using a caller-owned cache keyed by URL and integrity.
 */
export async function loadRemotePreset(args: {
	url: RemotePreset;
	integrity: string;
	cache: Map<string, HarnessContract>;
}): Promise<HarnessContract> {
	const cacheKey = `${args.url}#${args.integrity}`;
	const cached = args.cache.get(cacheKey);
	if (cached !== undefined) return cached;

	try {
		const content = await fetchRemotePresetContent(args.url);
		verifyIntegrityHash(args.url, content, args.integrity);
		const contract = validatePresetData(
			redactUrlCredentials(args.url),
			JSON.parse(content),
		);
		args.cache.set(cacheKey, contract);
		return contract;
	} catch (error) {
	} catch (error) {
		if (error instanceof PresetFetchError) throw error;
		if (error instanceof IntegrityError) throw error;
		const message = error instanceof Error ? error.message : "Unknown error";
		throw new PresetFetchError(
			redactUrlCredentials(args.url),
			message,
			error as Error,
		);
	}
}

function validateLocalPresetPath(presetPath: LocalPreset): void {
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
}

function resolveLocalPresetPath(
	presetPath: LocalPreset,
	contractDir: string,
): string {
	validateLocalPresetPath(presetPath);
	const resolvedPath = join(contractDir, presetPath);
	if (!existsSync(resolvedPath)) {
		throw new PresetFetchError(presetPath, "File not found");
	}

	let realResolvedPath: string;
	try {
		realResolvedPath = realpathSync(resolvedPath);
	} catch {
		throw new PresetFetchError(
			presetPath,
			"Failed to resolve path (broken symlink?)",
		);
	}

	const normalizedContractDir = normalize(realpathSync(contractDir));
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
	return realResolvedPath;
}

/**
 * Load and validate a local preset file relative to a contract directory.
 */
export function loadLocalPreset(
	presetPath: LocalPreset,
	contractDir: string,
): HarnessContract {
	const realResolvedPath = resolveLocalPresetPath(presetPath, contractDir);
	try {
		const content = readFileSync(realResolvedPath, "utf-8");
		return validatePresetData(presetPath, JSON.parse(content));
	} catch (error) {
		if (error instanceof PresetFetchError) throw error;
		const message = error instanceof Error ? error.message : "Unknown error";
		throw new PresetFetchError(
			presetPath,
			`Failed to load local preset: ${message}`,
			error instanceof Error ? error : undefined,
		);
	}
}
