/**
 * Durability classification for an evidence reference named in a PR body.
 */
export type EvidenceReferenceDurability =
	| "tracked_repo_path"
	| "ignored_local_path"
	| "untracked_local_path"
	| "ci_artifact_url"
	| "github_pr_comment"
	| "github_check_url"
	| "runtime_card_ref"
	| "evidence_receipt_ref"
	| "not_applicable"
	| "unknown";

/**
 * A normalized evidence reference and its recoverability class.
 */
export interface EvidenceReference {
	readonly value: string;
	readonly durability: EvidenceReferenceDurability;
}

/**
 * Result of checking whether local-only evidence has a durable mirror.
 */
export interface EvidenceReferenceValidation {
	readonly references: EvidenceReference[];
	readonly localOnlyReferences: string[];
	readonly durableReferences: string[];
	readonly errors: string[];
}

const URL_PATTERN = /^https?:\/\/\S+$/i;
const GITHUB_PR_COMMENT_PATTERN =
	/^https?:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+#(?:issuecomment-|discussion_r)\d+$/i;
const GITHUB_CHECK_PATTERN =
	/^https?:\/\/github\.com\/[^\s/]+\/[^\s/]+\/(?:actions\/runs|checks)\/\S+$/i;
const CI_ARTIFACT_PATTERN =
	/^https?:\/\/(?:circleci\.com|app\.circleci\.com|[^\s/]*buildkite\.com|[^\s/]*githubusercontent\.com)\/\S+/i;
const RUNTIME_CARD_PATTERN =
	/(?:^|\/)(?:runtime-card|runtime-card-handoff|runtime-evidence-bundle)(?:[\w.-]*)(?:\.json|\.jsonl)?$/i;
const EVIDENCE_RECEIPT_PATTERN =
	/(?:^|\/)(?:receipts|evidence-receipts|sync-receipts)(?:[\w.-]*)(?:\.json|\.jsonl)$/i;
const LOCAL_ONLY_PATH_PATTERN =
	/^(?:\.\/)?(?:artifacts\/|\.harness\/(?:artifacts|runs|evidence|media)\/)/i;
const TRACKED_PATH_PATTERN =
	/^(?:\.\/)?(?:AI\/|codestyle\/|contracts\/|docs\/|fixtures\/|scripts\/|src\/|test\/|tests\/|\.github\/|\.harness\/(?:active-artifacts\.md|decisions\/|knowledge\/|linear\/|plan\/|refactors\/|research\/(?:audits|deep)\/|specs\/|memory\/LEARNINGS\.md))/i;
const LOCAL_PATH_PATTERN =
	/^(?:\.\/)?(?:AI|artifacts|codestyle|contracts|docs|fixtures|scripts|src|test|tests|\.github|\.harness)\/[\w./-]+$/i;
const NOT_APPLICABLE_PATTERN =
	/^(?:n\.?a\.?|n\/a|not applicable|none)(?:\b|\s|[.;:,(])/i;
const AUTHORITY_PATTERN = /\b(?:source-of-truth|retained context)\b/i;
const DIGEST_PATTERN =
	/\b(?:sha256:[a-f0-9]{12,}|digest\s*:?\s*(?:sha256:)?[a-f0-9]{12,})\b/i;
const PRODUCER_PATTERN =
	/\b(?:producer command|producer|produced by)\s*:?\s*(?:`[^`]+`|\S.{2,})/i;
const REPLAY_PATTERN =
	/\b(?:replay command|replay)\s*:?\s*(?:`[^`]+`|n\.?a\.?|n\/a|not applicable|\S.{2,})/i;
const SCHEMA_VERSION_PATTERN =
	/\b(?:schema\/version|schema|version)\s*:?\s*(?:`[^`]+`|[\w./:-]+\/v\d+|v\d+|\S.{2,})/i;

const REFERENCE_TOKEN_PATTERN =
	/(https?:\/\/[^\s)\]>]+|(?:\.\/)?(?:AI|artifacts|codestyle|contracts|docs|fixtures|scripts|src|test|tests|\.github|\.harness)\/[\w./-]+|(?:runtime-card|runtime-card-handoff|runtime-evidence-bundle|receipts|evidence-receipts|sync-receipts)[\w./-]*(?:\.json|\.jsonl)?)/gi;

function normaliseReferenceToken(token: string): string {
	return token.replace(/[.,;:]+$/g, "").trim();
}

/**
 * Classify a single evidence reference by the kind of proof a later agent can recover.
 *
 * @param reference - URL, repo path, runtime-card reference, receipt reference, or n.a. marker.
 * @returns The durability class used by PR-template validation.
 */
export function classifyEvidenceReference(
	reference: string,
): EvidenceReferenceDurability {
	const value = normaliseReferenceToken(reference);
	if (value.length === 0) {
		return "unknown";
	}
	if (NOT_APPLICABLE_PATTERN.test(value)) {
		return "not_applicable";
	}
	if (GITHUB_PR_COMMENT_PATTERN.test(value)) {
		return "github_pr_comment";
	}
	if (GITHUB_CHECK_PATTERN.test(value)) {
		return "github_check_url";
	}
	if (CI_ARTIFACT_PATTERN.test(value)) {
		return "ci_artifact_url";
	}
	if (URL_PATTERN.test(value)) {
		return "unknown";
	}
	if (RUNTIME_CARD_PATTERN.test(value)) {
		return "runtime_card_ref";
	}
	if (EVIDENCE_RECEIPT_PATTERN.test(value)) {
		return "evidence_receipt_ref";
	}
	if (LOCAL_ONLY_PATH_PATTERN.test(value)) {
		return "ignored_local_path";
	}
	if (TRACKED_PATH_PATTERN.test(value)) {
		return "tracked_repo_path";
	}
	if (LOCAL_PATH_PATTERN.test(value)) {
		return "untracked_local_path";
	}
	return "unknown";
}

/**
 * Extract path-like and URL-like evidence references from free-form PR text.
 *
 * @param text - PR field text to scan.
 * @returns Normalized evidence references in encounter order.
 */
export function extractEvidenceReferences(text: string): EvidenceReference[] {
	return Array.from(text.matchAll(REFERENCE_TOKEN_PATTERN), (match) => {
		const value = normaliseReferenceToken(match[0] ?? "");
		return {
			value,
			durability: classifyEvidenceReference(value),
		};
	}).filter((reference) => reference.value.length > 0);
}

/** Return true when a reference can mirror retained artifact content. */
function isDurableEvidenceMirror(reference: EvidenceReference): boolean {
	return [
		"ci_artifact_url",
		"github_pr_comment",
		"github_check_url",
		"runtime_card_ref",
		"evidence_receipt_ref",
	].includes(reference.durability);
}

function uniqueReferenceValues(references: EvidenceReference[]): string[] {
	return Array.from(new Set(references.map((reference) => reference.value)));
}

/** Split a compact evidence table row without dropping intentionally blank cells. */
function splitCompactEvidenceTableCells(line: string): string[] | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
		return null;
	}
	if (/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)) {
		return null;
	}
	return trimmed
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
}

/** Extract only references that can mirror a local artifact on this map entry. */
function extractDurableMirrorReferences(line: string): EvidenceReference[] {
	const tableCells = splitCompactEvidenceTableCells(line);
	if (tableCells && tableCells.length >= 7) {
		return extractEvidenceReferences(tableCells[1] ?? "").filter((reference) =>
			isDurableEvidenceMirror(reference),
		);
	}

	const withoutCommandFields = line.replace(
		/\b(?:producer command|producer|produced by|replay command|replay)\s*:?\s*(?:`[^`]+`|[^;|]+)/giu,
		"",
	);
	return extractEvidenceReferences(withoutCommandFields).filter((reference) =>
		isDurableEvidenceMirror(reference),
	);
}

/**
 * Finds required compact evidence columns that are present but intentionally blank.
 *
 * @param line Candidate table row from the durable evidence map.
 * @returns Required compact evidence field labels with empty table cells.
 */
function collectBlankCompactEvidenceTableFields(line: string): string[] {
	const cells = splitCompactEvidenceTableCells(line);
	if (!cells) {
		return [];
	}
	const offset = cells.length >= 7 ? 2 : 1;
	const fields: ReadonlyArray<readonly [string, string | undefined]> = [
		["schema/version", cells[offset]],
		["producer command", cells[offset + 1]],
		["digest", cells[offset + 2]],
		["replay command", cells[offset + 3]],
		["authority", cells[offset + 4]],
	];
	return fields.flatMap(([label, value]) =>
		value !== undefined && value.length === 0 ? [label] : [],
	);
}

/**
 * Collects local artifact paths that have an accepted durable mirror on the same row.
 *
 * @param mapValue Durable evidence map text from a PR body.
 * @returns Local artifact references paired with durable proof.
 */
function collectPairedLocalReferences(mapValue: string): Set<string> {
	const paired = new Set<string>();
	for (const line of mapValue.split(/\r?\n/)) {
		const lineReferences = extractEvidenceReferences(line);
		if (
			!lineReferences.some(
				(reference) => reference.durability === "ignored_local_path",
			)
		) {
			continue;
		}
		if (extractDurableMirrorReferences(line).length === 0) {
			continue;
		}
		for (const reference of lineReferences) {
			if (reference.durability === "ignored_local_path") {
				paired.add(reference.value);
			}
		}
	}
	return paired;
}

/** Find retained local artifact map entries missing compact evidence-index fields. */
function collectCompactEvidenceIndexErrors(mapValue: string): string[] {
	const errors: string[] = [];
	for (const line of mapValue.split(/\r?\n/)) {
		const lineReferences = extractEvidenceReferences(line);
		const localReferences = lineReferences.filter(
			(reference) => reference.durability === "ignored_local_path",
		);
		if (localReferences.length === 0) {
			continue;
		}
		if (extractDurableMirrorReferences(line).length === 0) {
			continue;
		}

		const missingFields = [
			...collectBlankCompactEvidenceTableFields(line),
			...collectMissingCompactEvidenceFields(line),
		];

		if (missingFields.length > 0) {
			for (const reference of localReferences) {
				errors.push(
					"Durable evidence map entry for " +
						reference.value +
						" must include schema/version, producer command, digest, replay command, and authority (`source-of-truth` or `retained context`); missing: " +
						missingFields.join(", ") +
						".",
				);
			}
		}
	}
	return errors;
}

/**
 * Reports which required compact evidence fields are absent from a line.
 *
 * @param line Evidence-map line to inspect, including optional table cells.
 * @returns Required field labels that are not present in prose or table form.
 */
function collectMissingCompactEvidenceFields(line: string): string[] {
	const requiredFields: ReadonlyArray<readonly [string, RegExp]> = [
		["schema/version", SCHEMA_VERSION_PATTERN],
		["producer command", PRODUCER_PATTERN],
		["digest", DIGEST_PATTERN],
		["replay command", REPLAY_PATTERN],
		["authority", AUTHORITY_PATTERN],
	];
	const tableFields = parseCompactEvidenceTableFields(line);
	return requiredFields
		.filter(([label, pattern]) => {
			if (!tableFields && pattern.test(line)) {
				return false;
			}
			const tableValue = tableFields?.[label];
			return tableValue === undefined || !pattern.test(tableValue);
		})
		.map(([label]) => label);
}

/**
 * Extracts named compact evidence fields from a Markdown table row.
 *
 * @param line Candidate table row containing durable evidence metadata cells.
 * @returns A field map when the row has the expected compact evidence shape.
 */
function parseCompactEvidenceTableFields(
	line: string,
): Record<string, string> | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
		return null;
	}
	if (/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)) {
		return null;
	}

	const cells = splitCompactEvidenceTableCells(line) ?? [];
	if (cells.length < 6) {
		return null;
	}
	const lowerCells = cells.map((cell) => cell.toLowerCase());
	if (
		lowerCells.some((cell) => cell.includes("schema")) &&
		lowerCells.some((cell) => cell.includes("producer"))
	) {
		return null;
	}

	const offset = cells.length >= 7 ? 2 : 1;
	return {
		"schema/version": `schema/version: ${cells[offset] ?? ""}`,
		"producer command": `producer command: ${cells[offset + 1] ?? ""}`,
		digest: `digest: ${cells[offset + 2] ?? ""}`,
		"replay command": `replay command: ${cells[offset + 3] ?? ""}`,
		authority: `authority: ${cells[offset + 4] ?? ""}`,
	};
}

/**
 * Validate that ignored local artifact references are mirrored by durable evidence.
 *
 * @param input - Durable evidence map field plus the review artifacts field.
 * @returns Reference classifications and user-facing validation errors.
 */
export function validateDurableEvidenceMap(input: {
	readonly durableEvidenceMap: string | null;
	readonly evidenceText?: string | null;
	readonly reviewArtifacts?: string | null;
}): EvidenceReferenceValidation {
	const mapValue = input.durableEvidenceMap?.trim() ?? "";
	const evidenceText =
		input.evidenceText?.trim() ?? input.reviewArtifacts?.trim() ?? "";
	const references = extractEvidenceReferences(
		[mapValue, evidenceText].join("\n"),
	);
	const evidenceReferences = extractEvidenceReferences(evidenceText);
	const localOnlyReferences = uniqueReferenceValues(
		references.filter(
			(reference) => reference.durability === "ignored_local_path",
		),
	);
	const durableReferences = uniqueReferenceValues(
		mapValue
			.split(/\r?\n/)
			.flatMap((line) => extractDurableMirrorReferences(line)),
	);
	const errors: string[] = [];

	if (mapValue.length === 0 || NOT_APPLICABLE_PATTERN.test(mapValue)) {
		if (
			evidenceReferences.some(
				(reference) => reference.durability === "ignored_local_path",
			)
		) {
			errors.push(
				"Durable evidence map cannot be n.a. when PR evidence fields cite ignored local artifact paths.",
			);
		}
		return { references, localOnlyReferences, durableReferences, errors };
	}

	const pairedLocalReferences = collectPairedLocalReferences(mapValue);
	for (const localReference of localOnlyReferences) {
		if (!pairedLocalReferences.has(localReference)) {
			errors.push(
				"Durable evidence map must pair local-only artifact reference " +
					localReference +
					" with durable evidence on the same map entry.",
			);
		}
	}

	if (localOnlyReferences.length > 0 && durableReferences.length === 0) {
		errors.push(
			"Durable evidence map must pair ignored local artifact paths with a tracked receipt, runtime card, PR comment, GitHub check, or CI artifact URL.",
		);
	}

	errors.push(...collectCompactEvidenceIndexErrors(mapValue));

	return { references, localOnlyReferences, durableReferences, errors };
}
