import type { TriageLane } from "./triage-lanes.js";

export const TRIAGE_TYPE_LABELS = [
	"Bug",
	"Feature",
	"Improvement",
	"Policy",
	"Security",
] as const;

export type TriageTypeLabel = (typeof TRIAGE_TYPE_LABELS)[number];

interface TypeLabelMatcher {
	label: TriageTypeLabel;
	patterns: RegExp[];
}

const TYPE_LABEL_MATCHERS: TypeLabelMatcher[] = [
	{
		label: "Security",
		patterns: [
			/\bsecurity\b/i,
			/\b(osps|slsa|least privilege|cve|vuln(?:erability)?)\b/i,
		],
	},
	{
		label: "Policy",
		patterns: [/\bpolicy\b/i, /\bgovernance\b/i, /\bcontract\b/i],
	},
	{
		label: "Bug",
		patterns: [
			/\bbug\b/i,
			/\bfix\b/i,
			/\bregression\b/i,
			/\bfailing\b/i,
			/\berror\b/i,
		],
	},
	{
		label: "Feature",
		patterns: [
			/\bfeature\b/i,
			/\bimplement\b/i,
			/\badd\b/i,
			/\benable\b/i,
			/\bintroduce\b/i,
		],
	},
	{
		label: "Improvement",
		patterns: [/\bimprove(?:ment)?\b/i, /\brefactor\b/i, /\bhardening\b/i],
	},
];

const LANE_DEFAULT_TYPE_LABEL: Record<TriageLane, TriageTypeLabel> = {
	lane_a_active_stabilization: "Improvement",
	lane_b_adoption_path: "Feature",
	lane_c_architecture_foundations: "Policy",
	lane_d_security_trust: "Security",
	lane_e_docs_efficiency: "Improvement",
	lane_f_deferred_enhancements: "Improvement",
	unassigned: "Improvement",
};

function normalizeLabelName(value: string): string {
	return value.trim().toLowerCase();
}

function withOptionalDescription(description: string | null | undefined): {
	description?: string;
} {
	if (typeof description === "string") {
		return { description };
	}
	return {};
}

export function asCanonicalTypeLabel(
	labelName: string,
): TriageTypeLabel | undefined {
	const normalized = normalizeLabelName(labelName);
	for (const label of TRIAGE_TYPE_LABELS) {
		if (normalizeLabelName(label) === normalized) {
			return label;
		}
	}
	return undefined;
}

export function extractCurrentTypeLabels(labels: string[]): TriageTypeLabel[] {
	const found: TriageTypeLabel[] = [];
	for (const label of labels) {
		const canonical = asCanonicalTypeLabel(label);
		if (!canonical || found.includes(canonical)) {
			continue;
		}
		found.push(canonical);
	}
	return found;
}

export function inferTypeLabel(options: {
	title: string;
	description?: string;
	lane: TriageLane;
}): TriageTypeLabel {
	const haystack = `${options.title}\n${options.description ?? ""}`;
	for (const matcher of TYPE_LABEL_MATCHERS) {
		if (matcher.patterns.some((pattern) => pattern.test(haystack))) {
			return matcher.label;
		}
	}
	return LANE_DEFAULT_TYPE_LABEL[options.lane];
}

export interface TypeLabelPlan {
	expected: TriageTypeLabel;
	current: TriageTypeLabel[];
	needsLabel: boolean;
	needsNormalization: boolean;
	reason: string;
}

export function resolveTypeLabelPlan(options: {
	title: string;
	description?: string;
	labels: string[];
	lane: TriageLane;
}): TypeLabelPlan {
	const inferenceInput = {
		title: options.title,
		...withOptionalDescription(options.description),
		lane: options.lane,
	};
	const current = extractCurrentTypeLabels(options.labels);
	if (current.length === 1) {
		const existingTypeLabel = current[0];
		if (!existingTypeLabel) {
			throw new Error("Expected exactly one existing type label.");
		}
		return {
			expected: existingTypeLabel,
			current,
			needsLabel: false,
			needsNormalization: false,
			reason: "existing_type_label_present",
		};
	}

	if (current.length > 1) {
		const inferred = inferTypeLabel(inferenceInput);
		return {
			expected: inferred,
			current,
			needsLabel: !current.includes(inferred),
			needsNormalization: true,
			reason: "multiple_type_labels_present",
		};
	}

	const inferred = inferTypeLabel(inferenceInput);
	return {
		expected: inferred,
		current,
		needsLabel: true,
		needsNormalization: false,
		reason: "missing_type_label",
	};
}
