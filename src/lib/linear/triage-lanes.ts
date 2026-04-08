import type { LinearIssueSummary } from "./client.js";

export type TriageLane =
	| "lane_a_active_stabilization"
	| "lane_b_adoption_path"
	| "lane_c_architecture_foundations"
	| "lane_d_security_trust"
	| "lane_e_docs_efficiency"
	| "lane_f_deferred_enhancements"
	| "unassigned";

export interface TriageLaneCapacityConfig {
	globalInProgressCap: number;
	maxPromotePerRun: number;
	laneCaps: Record<Exclude<TriageLane, "unassigned">, number>;
}

export const DEFAULT_TRIAGE_LANE_CAPACITY: TriageLaneCapacityConfig = {
	globalInProgressCap: 3,
	maxPromotePerRun: 2,
	laneCaps: {
		lane_a_active_stabilization: 3,
		lane_b_adoption_path: 2,
		lane_c_architecture_foundations: 2,
		lane_d_security_trust: 2,
		lane_e_docs_efficiency: 1,
		lane_f_deferred_enhancements: 0,
	},
};

const TERMINAL_STATE_TYPES = new Set(["completed", "canceled"]);
const TERMINAL_STATE_NAMES = new Set(["done", "canceled", "duplicate"]);

const LANE_MATCHERS: Array<{
	lane: Exclude<TriageLane, "unassigned">;
	patterns: RegExp[];
}> = [
	{
		lane: "lane_a_active_stabilization",
		patterns: [/lane\s*a/i, /active\s*stabilization/i],
	},
	{
		lane: "lane_b_adoption_path",
		patterns: [/lane\s*b/i, /adoption\s*path/i],
	},
	{
		lane: "lane_c_architecture_foundations",
		patterns: [/lane\s*c/i, /architecture.*foundations?/i, /policy\s*chain/i],
	},
	{
		lane: "lane_d_security_trust",
		patterns: [/lane\s*d/i, /security/i, /trust\s*posture/i],
	},
	{
		lane: "lane_e_docs_efficiency",
		patterns: [/lane\s*e/i, /instruction/i, /docs?\s*surface/i],
	},
	{
		lane: "lane_f_deferred_enhancements",
		patterns: [/lane\s*f/i, /deferred\s*enhancements?/i],
	},
];

export interface TriageIssueView {
	identifier: string;
	stateName: string;
	stateType: string;
	labels: string[];
	description?: string;
}

export interface PromotionGuardResult {
	promotable: boolean;
	reasons: string[];
	unresolvedDependencies: string[];
}

function normalizeText(value: string | undefined): string {
	return value?.toLowerCase() ?? "";
}

export function resolveIssueLane(options: {
	labels: string[];
	description?: string;
}): TriageLane {
	const labelsText = options.labels.join("\n");
	const descriptionText = options.description ?? "";

	for (const matcher of LANE_MATCHERS) {
		for (const pattern of matcher.patterns) {
			if (pattern.test(labelsText) || pattern.test(descriptionText)) {
				return matcher.lane;
			}
		}
	}

	return "unassigned";
}

export function parseDependencyKeys(description: string | undefined): string[] {
	if (!description || description.trim().length === 0) {
		return [];
	}

	const keys = new Set<string>();
	const lines = description.split(/\r?\n/);
	for (const line of lines) {
		if (!/(depend|blocked\s*by|prereq)/i.test(line)) {
			continue;
		}
		const matches = line.match(/\b[A-Z][A-Z0-9]+-\d+\b/g);
		for (const match of matches ?? []) {
			keys.add(match.toUpperCase());
		}
	}

	return Array.from(keys);
}

export function isTerminalIssueState(issue: {
	stateName: string;
	stateType: string;
}): boolean {
	return (
		TERMINAL_STATE_TYPES.has(normalizeText(issue.stateType)) ||
		TERMINAL_STATE_NAMES.has(normalizeText(issue.stateName))
	);
}

export function buildIssueLookup(
	issues: Array<
		Pick<LinearIssueSummary, "identifier"> & {
			state: { name: string; type: string };
		}
	>,
): Map<string, { stateName: string; stateType: string }> {
	const lookup = new Map<string, { stateName: string; stateType: string }>();
	for (const issue of issues) {
		lookup.set(issue.identifier.toUpperCase(), {
			stateName: issue.state.name,
			stateType: issue.state.type,
		});
	}
	return lookup;
}

export function evaluatePromotionGuards(options: {
	issue: TriageIssueView;
	lane: TriageLane;
	dependencies: string[];
	issueLookup: Map<string, { stateName: string; stateType: string }>;
	laneInProgressCounts: Map<TriageLane, number>;
	globalInProgressCount: number;
	capacity: TriageLaneCapacityConfig;
	metadataCompleteness: number;
	metadataThreshold: number;
}): PromotionGuardResult {
	const reasons: string[] = [];

	if (options.metadataCompleteness < options.metadataThreshold) {
		reasons.push(
			`metadata completeness ${options.metadataCompleteness.toFixed(2)} is below threshold ${options.metadataThreshold.toFixed(2)}`,
		);
	}

	const unresolvedDependencies: string[] = [];
	for (const dependency of options.dependencies) {
		const dependencyIssue = options.issueLookup.get(dependency.toUpperCase());
		if (!dependencyIssue) {
			unresolvedDependencies.push(dependency.toUpperCase());
			continue;
		}
		if (!isTerminalIssueState(dependencyIssue)) {
			unresolvedDependencies.push(dependency.toUpperCase());
		}
	}
	if (unresolvedDependencies.length > 0) {
		reasons.push(
			`unresolved dependencies: ${unresolvedDependencies.join(", ")}`,
		);
	}

	if (options.globalInProgressCount >= options.capacity.globalInProgressCap) {
		reasons.push(
			`global in-progress cap reached (${options.globalInProgressCount}/${options.capacity.globalInProgressCap})`,
		);
	}

	if (options.lane !== "unassigned") {
		const laneCount = options.laneInProgressCounts.get(options.lane) ?? 0;
		const laneCap = options.capacity.laneCaps[options.lane];
		if (laneCount >= laneCap) {
			reasons.push(
				`lane cap reached for ${options.lane} (${laneCount}/${laneCap})`,
			);
		}
	}

	return {
		promotable: reasons.length === 0,
		reasons,
		unresolvedDependencies,
	};
}
