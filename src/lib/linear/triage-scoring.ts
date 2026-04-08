export const TRIAGE_SCORE_WEIGHTS = {
	impact: 3,
	unblockValue: 3,
	urgency: 2,
	confidence: 1,
	effort: 2,
} as const;

export const TRIAGE_SCORE_DEFAULTS = {
	impact: 2,
	unblockValue: 1,
	urgency: 2,
	confidence: 1,
	effort: 3,
} as const;

export type TriageScoreBand =
	| "pull_now"
	| "next_pull"
	| "triage_hold"
	| "backlog_or_rescope";

export interface TriageScoreInput {
	impact: number;
	unblockValue: number;
	urgency: number;
	confidence: number;
	effort: number;
}

export type PartialTriageScoreInput = Partial<TriageScoreInput>;

export interface TriageScoreResult {
	score: number;
	band: TriageScoreBand;
	inputs: TriageScoreInput;
	metadata: {
		missingFields: Array<keyof TriageScoreInput>;
		providedFields: Array<keyof TriageScoreInput>;
		completeness: number;
		fallbackUsed: boolean;
	};
}

const SCORE_FIELDS: Array<keyof TriageScoreInput> = [
	"impact",
	"unblockValue",
	"urgency",
	"confidence",
	"effort",
];

const SCORE_FIELD_PATTERNS: Record<keyof TriageScoreInput, RegExp> = {
	impact: /(?:^|\n)\s*(?:[-*]\s*)?impact\s*[:=]\s*([1-5])\b/im,
	unblockValue:
		/(?:^|\n)\s*(?:[-*]\s*)?(?:unblock(?:[_\s-]?value)|unblocking(?:[_\s-]?value)?)\s*[:=]\s*([1-5])\b/im,
	urgency: /(?:^|\n)\s*(?:[-*]\s*)?urgency\s*[:=]\s*([1-5])\b/im,
	confidence: /(?:^|\n)\s*(?:[-*]\s*)?confidence\s*[:=]\s*([1-5])\b/im,
	effort: /(?:^|\n)\s*(?:[-*]\s*)?effort\s*[:=]\s*([1-5])\b/im,
};

function isValidScoreValue(value: number): boolean {
	return Number.isInteger(value) && value >= 1 && value <= 5;
}

function resolveBand(score: number): TriageScoreBand {
	if (score >= 13) {
		return "pull_now";
	}
	if (score >= 10) {
		return "next_pull";
	}
	if (score >= 7) {
		return "triage_hold";
	}
	return "backlog_or_rescope";
}

export function parseTriageScoreInputs(
	text: string | undefined,
): PartialTriageScoreInput {
	if (!text || text.trim().length === 0) {
		return {};
	}

	const parsed: PartialTriageScoreInput = {};
	for (const field of SCORE_FIELDS) {
		const match = text.match(SCORE_FIELD_PATTERNS[field]);
		if (!match?.[1]) {
			continue;
		}
		const parsedValue = Number.parseInt(match[1], 10);
		if (Number.isInteger(parsedValue)) {
			parsed[field] = parsedValue;
		}
	}

	return parsed;
}

export function scoreIssue(input: PartialTriageScoreInput): TriageScoreResult {
	const providedFields: Array<keyof TriageScoreInput> = [];
	for (const field of SCORE_FIELDS) {
		const value = input[field];
		if (value === undefined) {
			continue;
		}
		if (!isValidScoreValue(value)) {
			throw new RangeError(
				`Invalid ${field} value ${String(value)}. Expected an integer from 1 to 5.`,
			);
		}
		providedFields.push(field);
	}

	const missingFields = SCORE_FIELDS.filter(
		(field) => !providedFields.includes(field),
	);

	const normalized: TriageScoreInput = {
		impact: input.impact ?? TRIAGE_SCORE_DEFAULTS.impact,
		unblockValue: input.unblockValue ?? TRIAGE_SCORE_DEFAULTS.unblockValue,
		urgency: input.urgency ?? TRIAGE_SCORE_DEFAULTS.urgency,
		confidence: input.confidence ?? TRIAGE_SCORE_DEFAULTS.confidence,
		effort: input.effort ?? TRIAGE_SCORE_DEFAULTS.effort,
	};

	const score =
		TRIAGE_SCORE_WEIGHTS.impact * normalized.impact +
		TRIAGE_SCORE_WEIGHTS.unblockValue * normalized.unblockValue +
		TRIAGE_SCORE_WEIGHTS.urgency * normalized.urgency +
		TRIAGE_SCORE_WEIGHTS.confidence * normalized.confidence -
		TRIAGE_SCORE_WEIGHTS.effort * normalized.effort;

	return {
		score,
		band: resolveBand(score),
		inputs: normalized,
		metadata: {
			missingFields,
			providedFields,
			completeness: providedFields.length / SCORE_FIELDS.length,
			fallbackUsed: missingFields.length > 0,
		},
	};
}
