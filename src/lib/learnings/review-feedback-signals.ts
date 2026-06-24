import type {
	ReviewFeedbackCommentInput,
	ReviewFeedbackFailureClass,
} from "./review-feedback-classifier.js";

const DISCLOSURE_VERBS = "print|log|paste|expose|dump|disclose";
const BYPASS_VERBS = "ignore|bypass|disable|skip";
const SECRET_TERMS = String.raw`secrets?|tokens?|passwords?|(?:api|ssh|private)\s+keys?|credentials?`;

/** Build a repeat-bucket signal for review feedback aggregation. */
export function buildRepeatSignalKey(
	body: string,
	failureClass: ReviewFeedbackFailureClass,
): string {
	const haystack = body.toLowerCase();
	if (failureClass !== "validation_gap") return failureClass;
	const validationSignals = [
		["tests", /\btests?\b/],
		["typecheck", /\btypechecks?\b|\bpnpm run typecheck\b/],
		["lint", /\blint\b|\bpnpm run lint\b/],
		["quality", /\bpnpm run quality\b/],
		["check", /\bpnpm (?:run )?check\b/],
		["ci", /\bci\b/],
		["gate", /\bgates?\b/],
		["validation", /\bvalidate|validation\b/],
	] as const;
	for (const [signal, pattern] of validationSignals) {
		if (pattern.test(haystack)) return signal;
	}
	return failureClass;
}

/** Infer the bounded review feedback failure class from comment text. */
export function inferReviewFeedbackFailureClass(
	comment: ReviewFeedbackCommentInput,
): ReviewFeedbackFailureClass {
	const haystack = comment.body.toLowerCase();
	if (hasReviewNoiseSignal(haystack)) return "review_noise";
	if (hasInstalledCommandDriftSignal(haystack))
		return "installed_command_drift";
	if (hasSchemaTypeDriftSignal(haystack)) return "schema_type_drift";
	if (hasPathSafetySignal(haystack)) return "path_safety";
	if (hasValidationGapSignal(haystack)) return "validation_gap";
	return "unknown";
}

/** Detect unsafe review requests that must not become eval or guardrail seeds. */
export function isUnsafeReviewFeedback(body: string): boolean {
	const bodyWithoutSafeWarnings = body
		.replace(
			new RegExp(
				String.raw`(?:^|[.;]\s*)\b(?:do not|don't|never)\b(?![^.;]*\bbut\b)[^.;]*\b(?:${BYPASS_VERBS})\b[^.;]*\b(?:security|validation|guardrail)\b[^.;]*`,
				"gi",
			),
			"",
		)
		.replace(
			new RegExp(
				String.raw`(?:^|[.;]\s*)\b(?:do not|don't|never)\b(?![^.;]*\bbut\b)[^.;]*\b(?:${DISCLOSURE_VERBS})(?:\s+(?:or|and)\s+(?:${DISCLOSURE_VERBS}))*\b[^.;]*\b(?:${SECRET_TERMS})\b[^.;]*`,
				"gi",
			),
			"",
		);
	return new RegExp(
		String.raw`\b(?:${SECRET_TERMS})\b[\s\S]{0,80}\b(?:${DISCLOSURE_VERBS})\b|\b(?:${DISCLOSURE_VERBS})\b[\s\S]{0,80}\b(?:${SECRET_TERMS})\b|\b(?:${BYPASS_VERBS})\b[\s\S]{0,80}\b(?:security|validation|guardrail)\b`,
		"i",
	).test(bodyWithoutSafeWarnings);
}

function hasInstalledCommandDriftSignal(haystack: string): boolean {
	const hasMissingScriptPackageContext =
		/\bmissing script\b/.test(haystack) &&
		/\b(package(?:\.json)?\s+(?:scripts?|commands?)|installed|downstream|consumer (?:repos?|repositories)|harness commands?)\b/.test(
			haystack,
		);
	const hasExplicitCommandSignal =
		/\bpublic cli\b/.test(haystack) ||
		/\brunnable (?:public )?harness commands?\b/.test(haystack) ||
		/\bpublic harness commands?\b/.test(haystack) ||
		/\bpackage\s+(script|command|cli|producer)\b/.test(haystack) ||
		/\b(script|command|cli|producer)\s+(from|in|via|through)\s+package\b/.test(
			haystack,
		);
	const hasInstalledCommandContext =
		/\b(installed|downstream|consumer (?:repos?|repositories))\b/.test(
			haystack,
		) &&
		/\b(commands?|scripts?|cli|producers?|pnpm run|harness commands?)\b/.test(
			haystack,
		);
	return (
		hasExplicitCommandSignal ||
		hasMissingScriptPackageContext ||
		hasInstalledCommandContext
	);
}

function hasSchemaTypeDriftSignal(haystack: string): boolean {
	return (
		/\b(schema|json schema|typed artifact|required field|additionalproperties)\b/.test(
			haystack,
		) ||
		(/\b(contract|v1|compatib)\b/.test(haystack) &&
			/\b(schema|typed artifact|artifact|type|runtime packet|validator)\b/.test(
				haystack,
			)) ||
		(/\b(?:typescript\s+)?types?\b/.test(haystack) &&
			/\b(validator|runtime packet|schema|field|artifact)\b/.test(haystack))
	);
}

function hasPathSafetySignal(haystack: string): boolean {
	const hasRootBoundaryContext =
		/\b(?:repo(?:sitory)?|fixture)\s+root\b/.test(haystack) &&
		/\b(path|paths|contain|escape|escapes|escaped|travers|resolve|read|write|writes|file|files|absolute|outside)\b/.test(
			haystack,
		);
	return (
		/\b(path traversal|file inclusion|symlink|realpath)\b/.test(haystack) ||
		hasRootBoundaryContext ||
		/\babsolute paths?\b[\s\S]{0,80}\bescape\w*\b/.test(haystack) ||
		/\bescape\w*\b[\s\S]{0,80}\b(?:repo(?:sitory)?|fixture)\s+root\b/.test(
			haystack,
		) ||
		/\bwrites?\s+outside\b|\boutside\s+(?:the\s+)?(?:repo(?:sitory)?|fixture)\s+root\b/.test(
			haystack,
		)
	);
}

function hasValidationGapSignal(haystack: string): boolean {
	return (
		/\b(validate|validation|tests?|typechecks?|lint|gates?|ci)\b/.test(
			haystack,
		) ||
		/\bpnpm (?:run )?(quality(?::[\w-]+)?|test(?::[\w-]+)?|lint|typecheck|check)\b/.test(
			haystack,
		)
	);
}

function hasReviewNoiseSignal(haystack: string): boolean {
	return /\b(style|nit|simplify|duplicate|readability)\b/.test(haystack);
}
