import {
	type CodeqlFindingInput,
	type CodexFindingInput,
	normalizeCodeqlFinding,
	normalizeCodexFinding,
} from "../lib/remediation/finding-normalizer.js";
import type { CanonicalFinding } from "../lib/remediation/types.js";
import type { RemediateResult } from "./remediate.js";
import type { RemediateFinalize } from "./remediate-run-record.js";
import { EXIT_CODES } from "./remediate-runner-helpers.js";

/**
 * Parse findings from JSON input.
 * Accepts either a single finding or an array of findings.
 *
 * @param input - Raw JSON input supplied to the remediate command.
 * @returns One or more decoded finding payloads.
 */
function parseFindings(input: string): unknown[] {
	let data: unknown;
	try {
		data = JSON.parse(input);
	} catch (e) {
		throw new Error(
			`Failed to parse JSON: ${e instanceof Error ? e.message : "unknown error"}`,
		);
	}

	if (Array.isArray(data)) {
		return data;
	}
	return [data];
}

/**
 * Determine the source provider for a raw finding object.
 *
 * @param finding - Raw finding value to inspect; may be any JSON-decoded value.
 * @returns The detected provider name, or `null` when the shape is unknown.
 */
function detectProvider(finding: unknown): "codeql" | "codex" | null {
	if (typeof finding !== "object" || finding === null) {
		return null;
	}

	const f = finding as Record<string, unknown>;
	if (
		typeof f.location === "object" &&
		f.location !== null &&
		"startLine" in f.location
	) {
		return "codeql";
	}

	if (typeof f.filePath === "string" && typeof f.line === "number") {
		return "codex";
	}

	return null;
}

/**
 * Convert a raw finding input into a canonical finding representation.
 *
 * @param raw - The provider-specific finding payload to normalize.
 * @param repoRoot - Repository root path used to resolve or normalize file paths.
 * @returns A canonical finding or a human-readable normalization error.
 */
function normalizeFinding(
	raw: unknown,
	repoRoot: string,
): { ok: true; finding: CanonicalFinding } | { ok: false; error: string } {
	const provider = detectProvider(raw);

	if (provider === "codeql") {
		const result = normalizeCodeqlFinding(raw as CodeqlFindingInput, repoRoot);
		return result.ok
			? { ok: true, finding: result.finding }
			: { ok: false, error: result.error.message };
	}

	if (provider === "codex") {
		const result = normalizeCodexFinding(raw as CodexFindingInput, repoRoot);
		return result.ok
			? { ok: true, finding: result.finding }
			: { ok: false, error: result.error.message };
	}

	return { ok: false, error: "Unable to detect provider type" };
}

/**
 * Parse and normalize remediation findings, returning a finalized command result when no finding can be used.
 *
 * @param rawInput - Raw JSON findings input.
 * @param repoRoot - Repository root used by provider normalizers.
 * @param finalize - Remediate run-record finalizer used to preserve error evidence.
 * @returns Canonical findings or a finalized RemediateResult describing the validation failure.
 */
export function normalizeFindingsOrFail(
	rawInput: string,
	repoRoot: string,
	finalize: RemediateFinalize,
):
	| { ok: true; findings: CanonicalFinding[] }
	| { ok: false; result: RemediateResult } {
	let rawFindings: unknown[];
	try {
		rawFindings = parseFindings(rawInput);
	} catch (error) {
		return {
			ok: false,
			result: finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_VALIDATION",
							message: error instanceof Error ? error.message : String(error),
						},
					},
					exitCode: EXIT_CODES.USAGE,
				},
				{ stage: "parse_findings", error: "failed_to_parse_findings" },
			),
		};
	}

	const findings: CanonicalFinding[] = [];
	const parseErrors: Array<{ index: number; error: string }> = [];
	for (let i = 0; i < rawFindings.length; i++) {
		const result = normalizeFinding(rawFindings[i], repoRoot);
		if (result.ok) {
			findings.push(result.finding);
		} else {
			parseErrors.push({ index: i, error: result.error });
		}
	}

	if (findings.length === 0 && parseErrors.length > 0) {
		return {
			ok: false,
			result: finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_VALIDATION",
							message: `All findings failed to parse. First error: ${parseErrors[0]?.error}`,
							context: { parseErrors },
						},
					},
					exitCode: EXIT_CODES.USAGE,
				},
				{
					stage: "normalize_findings",
					error: "all_findings_invalid",
					parseErrorCount: parseErrors.length,
				},
			),
		};
	}
	return { ok: true, findings };
}
