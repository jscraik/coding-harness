import {
	type HeValidationError,
	toValidationError,
} from "../decision/validators.js";

const MAX_RUNTIME_CARD_REF_LENGTH = 512;

const COMPACT_RUNTIME_CARD_REF_PREFIXES = [
	"./",
	"/",
	"AI/",
	"artifacts/",
	".harness/",
	"docs/",
	"src/",
	"test/",
	"tests/",
	"command:",
	"artifact:",
	"artifact://",
	"codex://",
	"codex-runtime://",
	"codex-review_state://",
	"codex-stale-state://",
	"codex-source://",
	"codex-mcp://",
	"session-collector:",
	"api:",
	"input:",
	"path:",
	"git:",
	"pr:",
	"linear:",
	"http://",
	"https://",
] as const;

const ALLOWED_RUNTIME_CARD_COMMAND_PREFIXES = [
	"pnpm ",
	"npm ",
	"yarn ",
	"bun ",
	"git ",
	"gh ",
	"bash ",
	"node ",
	"tsx ",
	"python ",
	"python3 ",
	"uv ",
	"make ",
	"harness ",
	"./",
] as const;

function payloadMarkers(value: string): boolean {
	const trimmed = value.trim();
	const lower = trimmed.toLowerCase();
	const markerText = lower.replace(/[+_-]+/g, " ");
	return (
		trimmed.startsWith("{") ||
		trimmed.startsWith("[") ||
		trimmed.includes("{") ||
		trimmed.includes("[") ||
		trimmed.includes("}") ||
		trimmed.includes("]") ||
		trimmed.includes("\n") ||
		trimmed.includes("\r") ||
		trimmed.includes("\\n") ||
		trimmed.includes("\\r") ||
		markerText.includes("schemaversion") ||
		markerText.includes("review thread") ||
		markerText.includes("full review") ||
		markerText.includes("reviewer says") ||
		markerText.includes("raw packet")
	);
}

function decodedPayloadLikeRef(value: string): boolean {
	if (!/%[0-9a-fA-F]{2}/.test(value)) return false;
	let decoded = value;
	try {
		for (let attempt = 0; attempt < 4; attempt += 1) {
			if (!/%[0-9a-fA-F]{2}/.test(decoded)) return false;
			const nextDecoded = decodeURIComponent(decoded);
			if (payloadMarkers(nextDecoded)) return true;
			if (nextDecoded === decoded) return false;
			decoded = nextDecoded;
		}
		return /%[0-9a-fA-F]{2}/.test(decoded);
	} catch {
		return true;
	}
}

function rawPayloadLikeRef(value: string): boolean {
	return payloadMarkers(value) || decodedPayloadLikeRef(value);
}

function compactPathLikeReference(value: string): boolean {
	return !/\s/.test(value) && /^[A-Za-z0-9._~:/@#?&=%+-]+$/.test(value);
}

function compactCommandReference(value: string): boolean {
	const command = value.startsWith("command:")
		? value.slice("command:".length)
		: value;
	return ALLOWED_RUNTIME_CARD_COMMAND_PREFIXES.some((prefix) =>
		command.startsWith(prefix),
	);
}

function compactReferenceShape(value: string): boolean {
	const trimmed = value.trim();
	if (trimmed.startsWith("command:")) return compactCommandReference(trimmed);
	if (compactCommandReference(trimmed)) return true;
	if (/^[a-f0-9]{40}$/.test(trimmed)) return true;
	return (
		compactPathLikeReference(trimmed) &&
		COMPACT_RUNTIME_CARD_REF_PREFIXES.some((prefix) =>
			trimmed.startsWith(prefix),
		)
	);
}

/** Validate one compact runtime-card evidence reference without embedded payloads. */
export function validateRuntimeCardReference(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (typeof value !== "string" || value.trim().length === 0) {
		errors.push(
			toValidationError(`${field} must be a non-empty string`, field),
		);
		return;
	}
	if (
		value.length > MAX_RUNTIME_CARD_REF_LENGTH ||
		rawPayloadLikeRef(value) ||
		!compactReferenceShape(value)
	) {
		errors.push(
			toValidationError(
				field +
					" must be a compact evidence reference or known command/path, not embedded payload prose",
				field,
			),
		);
	}
}

/** Validate an array of compact runtime-card evidence references. */
export function validateRuntimeCardReferenceArray(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!Array.isArray(value)) {
		errors.push(toValidationError(`${field} must be an array`, field));
		return;
	}
	for (const [index, ref] of value.entries()) {
		validateRuntimeCardReference(ref, `${field}.${String(index)}`, errors);
	}
}
