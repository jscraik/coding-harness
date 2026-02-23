import { readFileSync } from "node:fs";
import { PathTraversalError, validatePath } from "../input/validator.js";
import type { HarnessContract } from "./types.js";
import { DEFAULT_CONTRACT } from "./types.js";
import {
	type ValidationError,
	ValidationErrorCode,
	validateContract,
} from "./validator.js";

const MAX_CONTRACT_SIZE = 1024 * 1024; // 1MB
const MAX_JSON_DEPTH = 100;

export class ContractLoadError extends Error {
	constructor(
		message: string,
		public readonly path: string,
		public readonly errors: ValidationError[] = [],
	) {
		super(message);
		this.name = "ContractLoadError";
	}
}

/**
 * Parse JSON with depth limit to prevent stack overflow attacks.
 */
function safeParseJson(content: string): unknown {
	let depth = 0;
	return JSON.parse(content, (_key, value) => {
		if (typeof value === "object" && value !== null) {
			depth++;
			if (depth > MAX_JSON_DEPTH) {
				throw new Error(`JSON depth exceeds maximum (${MAX_JSON_DEPTH})`);
			}
		}
		return value;
	});
}

export function loadContract(path: string): HarnessContract {
	// Validate path stays within cwd (symlink-aware)
	const cwd = process.cwd();
	let validatedPath: string;
	try {
		validatedPath = validatePath(cwd, path);
	} catch (e) {
		if (e instanceof PathTraversalError) {
			throw new ContractLoadError("Path traversal detected", path, [
				{
					code: ValidationErrorCode.FORBIDDEN_KEY,
					path: "contract",
					message: "Contract path escapes working directory",
					fix: "Use a path within the current directory",
				},
			]);
		}
		throw e;
	}

	// Read with size limit
	const content = readFileSync(validatedPath, "utf-8");
	if (content.length > MAX_CONTRACT_SIZE) {
		throw new Error(`Contract file exceeds maximum size (1MB): ${path}`);
	}

	// Parse JSON with depth limit
	let data: unknown;
	try {
		data = safeParseJson(content);
	} catch (e) {
		const message = e instanceof Error ? e.message : "unknown error";
		throw new ContractLoadError(`Failed to parse JSON: ${message}`, path);
	}

	// Validate
	const result = validateContract(data);
	if (!result.success) {
		throw new ContractLoadError(
			`Contract validation failed with ${result.errors.length} error(s)`,
			path,
			result.errors,
		);
	}

	// Merge with defaults
	return {
		...DEFAULT_CONTRACT,
		...result.data,
	};
}
