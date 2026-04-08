import { sanitizeError } from "../lib/input/sanitize.js";
import {
	LinearAPIError,
	LinearClient,
	type LinearLabelSummary,
	type LinearTeamIssue,
	type LinearTeamSummary,
} from "../lib/linear/client.js";
import {
	DEFAULT_TRIAGE_LANE_CAPACITY,
	type TriageLane,
	buildIssueLookup,
	evaluatePromotionGuards,
	parseDependencyKeys,
	resolveIssueLane,
} from "../lib/linear/triage-lanes.js";
import {
	type TriageScoreBand,
	parseTriageScoreInputs,
	scoreIssue,
} from "../lib/linear/triage-scoring.js";
import {
	type TriageTypeLabel,
	asCanonicalTypeLabel,
	resolveTypeLabelPlan,
} from "../lib/linear/triage-type-labels.js";
import {
	normalizeIssueReference,
	normalizeTeamMatch,
	normalizeToken,
} from "../lib/linear/utils.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

const PROMOTABLE_BANDS = new Set<TriageScoreBand>(["pull_now", "next_pull"]);

interface TeamIssueStateSummary {
	stateName: string;
	count: number;
}

export interface LinearTriageOptions {
	team?: string;
	project?: string;
	issue?: string;
	token?: string;
	limit?: number;
	metadataThreshold?: number;
	inProgressCap?: number;
	maxPromote?: number;
	apply?: boolean;
	confirm?: boolean;
	dryRun?: boolean;
	json?: boolean;
	syncTypeLabels?: boolean;
}

export interface LinearTriageRecommendation {
	issue: {
		identifier: string;
		title: string;
		url: string;
		state: string;
		lane: TriageLane;
	};
	score: {
		value: number;
		band: TriageScoreBand;
		completeness: number;
		fallbackUsed: boolean;
		missingFields: string[];
	};
	dependencies: {
		keys: string[];
		unresolved: string[];
	};
	typeLabel: {
		expected: TriageTypeLabel;
		current: TriageTypeLabel[];
		needsLabel: boolean;
		needsNormalization: boolean;
		reason: string;
		applied: boolean;
	};
	promotable: boolean;
	reasons: string[];
}

export interface LinearTriageOutput {
	team: {
		id: string;
		key: string;
		name: string;
	};
	summary: {
		totalIssues: number;
		stateCounts: TeamIssueStateSummary[];
		inProgressCap: number;
		maxPromote: number;
		metadataThreshold: number;
		recommendedPromotions: number;
		appliedPromotions: number;
		recommendedTypeLabels: number;
		appliedTypeLabels: number;
	};
	recommendations: LinearTriageRecommendation[];
	promotions: Array<{
		issueIdentifier: string;
		reason: string;
		applied: boolean;
	}>;
	dryRun: boolean;
}

export type LinearTriageResult =
	| { ok: true; output: LinearTriageOutput }
	| { ok: false; error: { code: string; message: string } };

interface EvaluatedTriageCandidate {
	issue: LinearTeamIssue;
	lane: TriageLane;
	score: ReturnType<typeof scoreIssue>;
	dependencies: string[];
	guards: ReturnType<typeof evaluatePromotionGuards>;
	promotable: boolean;
	typeLabel: {
		expected: TriageTypeLabel;
		current: TriageTypeLabel[];
		needsLabel: boolean;
		needsNormalization: boolean;
		reason: string;
		applied: boolean;
	};
}

function normalizeStateName(value: string): string {
	return value.trim().toLowerCase();
}

function isCandidateState(value: string): boolean {
	const normalized = normalizeStateName(value);
	return (
		normalized === "triage" || normalized === "todo" || normalized === "backlog"
	);
}

function isInProgress(value: string): boolean {
	return normalizeStateName(value) === "in progress";
}

function normalizeProjectMatch(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed.toLowerCase() : undefined;
}

function issueMatchesProject(
	issue: LinearTeamIssue,
	projectMatch: string,
): boolean {
	const project = issue.project;
	if (!project) {
		return false;
	}

	const projectName = project.name.toLowerCase();
	const projectId = project.id.toLowerCase();
	const projectSlugId = project.slugId?.toLowerCase();
	return (
		projectName === projectMatch ||
		projectId === projectMatch ||
		projectSlugId === projectMatch
	);
}

function toStateCounts(issues: LinearTeamIssue[]): TeamIssueStateSummary[] {
	const counts = new Map<string, number>();
	for (const issue of issues) {
		const key = issue.state.name;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	return Array.from(counts.entries())
		.map(([stateName, count]) => ({ stateName, count }))
		.sort(
			(a, b) => b.count - a.count || a.stateName.localeCompare(b.stateName),
		);
}

function resolveTeam(
	teams: LinearTeamSummary[],
	teamMatch: string,
): LinearTeamSummary | undefined {
	return teams.find(
		(team) =>
			team.key.toLowerCase() === teamMatch ||
			team.name.toLowerCase() === teamMatch,
	);
}

function dedupeLabelIds(labelIds: string[]): string[] {
	const deduped = new Set<string>();
	for (const labelId of labelIds) {
		deduped.add(labelId);
	}
	return Array.from(deduped);
}

function withOptionalDescription(description: string | null | undefined): {
	description?: string;
} {
	if (typeof description === "string") {
		return { description };
	}
	return {};
}

function buildLabelLookup(labels: LinearLabelSummary[]): Map<string, string> {
	const lookup = new Map<string, string>();
	for (const label of labels) {
		lookup.set(label.name.trim().toLowerCase(), label.id);
	}
	return lookup;
}

function requiresTypeLabelSync(typeLabel: {
	needsLabel: boolean;
	needsNormalization: boolean;
}): boolean {
	return typeLabel.needsLabel || typeLabel.needsNormalization;
}

async function ensureLabelId(options: {
	client: LinearClient;
	teamId: string;
	labelName: string;
	labelLookup: Map<string, string>;
}): Promise<string> {
	const normalized = options.labelName.trim().toLowerCase();
	const existingId = options.labelLookup.get(normalized);
	if (existingId) {
		return existingId;
	}

	const created = await options.client.createLabel({
		name: options.labelName,
		teamId: options.teamId,
	});
	options.labelLookup.set(created.name.trim().toLowerCase(), created.id);
	return created.id;
}

function createIssueComment(options: {
	score: number;
	band: TriageScoreBand;
	dependencies: string[];
	metadataCompleteness: number;
	typeLabel: TriageTypeLabel;
}): string {
	const dependencyLine =
		options.dependencies.length > 0 ? options.dependencies.join(", ") : "none";
	return [
		"Promoted via `harness linear triage --apply`.",
		"",
		`- triage_score: ${options.score}`,
		`- triage_band: ${options.band}`,
		`- metadata_completeness: ${options.metadataCompleteness.toFixed(2)}`,
		`- dependency_keys: ${dependencyLine}`,
		`- type_label: ${options.typeLabel}`,
	].join("\n");
}

export async function runLinearTriage(
	options: LinearTriageOptions,
): Promise<LinearTriageResult> {
	const token =
		normalizeToken(options.token) ?? normalizeToken(process.env.LINEAR_API_KEY);
	if (!token) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Missing Linear API key. Provide --token or set LINEAR_API_KEY.",
			},
		};
	}

	const teamMatch = normalizeTeamMatch(options.team);
	if (!teamMatch) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Missing required --team value. Use a team key or team name for deterministic triage.",
			},
		};
	}

	const limit = options.limit ?? 10;
	if (!Number.isInteger(limit) || limit < 1) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "--limit must be a positive integer.",
			},
		};
	}

	const metadataThreshold = options.metadataThreshold ?? 0.8;
	if (metadataThreshold < 0 || metadataThreshold > 1) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "--metadata-threshold must be between 0 and 1.",
			},
		};
	}

	const maxPromote =
		options.maxPromote ?? DEFAULT_TRIAGE_LANE_CAPACITY.maxPromotePerRun;
	if (!Number.isInteger(maxPromote) || maxPromote < 0) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "--max-promote must be a non-negative integer.",
			},
		};
	}

	const inProgressCap =
		options.inProgressCap ?? DEFAULT_TRIAGE_LANE_CAPACITY.globalInProgressCap;
	if (!Number.isInteger(inProgressCap) || inProgressCap < 1) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "--in-progress-cap must be a positive integer.",
			},
		};
	}

	const shouldSyncTypeLabels = options.syncTypeLabels ?? true;
	const projectFilter = normalizeProjectMatch(options.project);

	const issueFilter = options.issue?.trim()
		? normalizeIssueReference(options.issue)
		: undefined;

	const client = new LinearClient({ token });

	try {
		const teams = await client.listTeams();
		const team = resolveTeam(teams, teamMatch);
		if (!team) {
			return {
				ok: false,
				error: {
					code: "NOT_FOUND",
					message: `Linear team ${options.team ?? ""} was not found.`,
				},
			};
		}

		const allIssues = await client.listTeamIssues(team.id, { first: 250 });
		let filteredIssues = projectFilter
			? allIssues.filter((issue) => issueMatchesProject(issue, projectFilter))
			: allIssues;
		filteredIssues = issueFilter
			? filteredIssues.filter(
					(issue) =>
						issue.identifier.toLowerCase() === issueFilter.toLowerCase(),
				)
			: filteredIssues;

		if (filteredIssues.length === 0) {
			if (issueFilter && projectFilter) {
				return {
					ok: false,
					error: {
						code: "NOT_FOUND",
						message: `Linear issue ${issueFilter} was not found in project ${options.project ?? ""} for team ${team.key}.`,
					},
				};
			}
			if (projectFilter) {
				return {
					ok: false,
					error: {
						code: "NOT_FOUND",
						message: `No issues were found for project ${options.project ?? ""} in team ${team.key}.`,
					},
				};
			}
			return {
				ok: false,
				error: {
					code: "NOT_FOUND",
					message: issueFilter
						? `Linear issue ${issueFilter} was not found in team ${team.key}.`
						: `No issues were found for team ${team.key}.`,
				},
			};
		}

		const laneInProgressCounts = new Map<TriageLane, number>();
		let globalInProgressCount = 0;
		for (const issue of filteredIssues) {
			if (!isInProgress(issue.state.name)) {
				continue;
			}
			globalInProgressCount += 1;
			const lane = resolveIssueLane({
				labels: issue.labels.map((label) => label.name),
				...withOptionalDescription(issue.description),
			});
			laneInProgressCounts.set(lane, (laneInProgressCounts.get(lane) ?? 0) + 1);
		}

		const issueLookup = buildIssueLookup(allIssues);
		const triageCandidates = filteredIssues.filter((issue) =>
			isCandidateState(issue.state.name),
		);

		const evaluated: EvaluatedTriageCandidate[] = triageCandidates.map(
			(issue) => {
				const lane = resolveIssueLane({
					labels: issue.labels.map((label) => label.name),
					...withOptionalDescription(issue.description),
				});
				const parsedInputs = parseTriageScoreInputs(
					issue.description ?? undefined,
				);
				const score = scoreIssue(parsedInputs);
				const dependencies = parseDependencyKeys(
					issue.description ?? undefined,
				);
				const guards = evaluatePromotionGuards({
					issue: {
						identifier: issue.identifier,
						stateName: issue.state.name,
						stateType: issue.state.type,
						labels: issue.labels.map((label) => label.name),
						...withOptionalDescription(issue.description),
					},
					lane,
					dependencies,
					issueLookup,
					laneInProgressCounts,
					globalInProgressCount,
					capacity: {
						...DEFAULT_TRIAGE_LANE_CAPACITY,
						globalInProgressCap: inProgressCap,
						maxPromotePerRun: maxPromote,
					},
					metadataCompleteness: score.metadata.completeness,
					metadataThreshold,
				});

				const typeLabelPlan = resolveTypeLabelPlan({
					title: issue.title,
					...withOptionalDescription(issue.description),
					labels: issue.labels.map((label) => label.name),
					lane,
				});

				const promotable =
					guards.promotable && PROMOTABLE_BANDS.has(score.band);
				if (!PROMOTABLE_BANDS.has(score.band)) {
					guards.reasons.push(
						`score band ${score.band} is below promotion threshold`,
					);
				}

				return {
					issue,
					score,
					lane,
					dependencies,
					guards,
					promotable,
					typeLabel: {
						expected: typeLabelPlan.expected,
						current: typeLabelPlan.current,
						needsLabel: typeLabelPlan.needsLabel,
						needsNormalization: typeLabelPlan.needsNormalization,
						reason: typeLabelPlan.reason,
						applied: false,
					},
				};
			},
		);

		evaluated.sort(
			(a, b) =>
				b.score.score - a.score.score ||
				a.issue.identifier.localeCompare(b.issue.identifier),
		);

		const topEvaluated = evaluated.slice(0, limit);
		const projectedLaneCounts = new Map(laneInProgressCounts);
		let projectedInProgress = globalInProgressCount;
		const promotions: Array<{
			issueIdentifier: string;
			reason: string;
			applied: boolean;
			commentBody: string;
		}> = [];

		for (const candidate of topEvaluated) {
			if (!candidate.promotable) {
				continue;
			}
			if (promotions.length >= maxPromote) {
				break;
			}

			const incrementalGuards = evaluatePromotionGuards({
				issue: {
					identifier: candidate.issue.identifier,
					stateName: candidate.issue.state.name,
					stateType: candidate.issue.state.type,
					labels: candidate.issue.labels.map((label) => label.name),
					...withOptionalDescription(candidate.issue.description),
				},
				lane: candidate.lane,
				dependencies: candidate.dependencies,
				issueLookup,
				laneInProgressCounts: projectedLaneCounts,
				globalInProgressCount: projectedInProgress,
				capacity: {
					...DEFAULT_TRIAGE_LANE_CAPACITY,
					globalInProgressCap: inProgressCap,
					maxPromotePerRun: maxPromote,
				},
				metadataCompleteness: candidate.score.metadata.completeness,
				metadataThreshold,
			});
			if (!incrementalGuards.promotable) {
				candidate.guards.reasons.push(...incrementalGuards.reasons);
				candidate.promotable = false;
				continue;
			}

			projectedInProgress += 1;
			projectedLaneCounts.set(
				candidate.lane,
				(projectedLaneCounts.get(candidate.lane) ?? 0) + 1,
			);
			promotions.push({
				issueIdentifier: candidate.issue.identifier,
				reason: `score ${candidate.score.score} (${candidate.score.band})`,
				applied: false,
				commentBody: createIssueComment({
					score: candidate.score.score,
					band: candidate.score.band,
					dependencies: candidate.dependencies,
					metadataCompleteness: candidate.score.metadata.completeness,
					typeLabel: candidate.typeLabel.expected,
				}),
			});
		}

		const shouldApply = options.apply === true;
		const plannedMutationIssues = new Set<string>();
		for (const candidate of topEvaluated) {
			const hasPromotion = promotions.some(
				(item) => item.issueIdentifier === candidate.issue.identifier,
			);
			const hasTypeLabelMutation =
				shouldSyncTypeLabels && requiresTypeLabelSync(candidate.typeLabel);
			if (hasPromotion || hasTypeLabelMutation) {
				plannedMutationIssues.add(candidate.issue.identifier);
			}
		}

		if (
			shouldApply &&
			!options.dryRun &&
			plannedMutationIssues.size > 1 &&
			options.confirm !== true
		) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message:
						"Refusing multi-issue apply without explicit confirmation. Re-run with --confirm.",
				},
			};
		}

		if (shouldApply && !options.dryRun) {
			let inProgressStateId: string | undefined;
			const promotedIssueSet = new Set(
				promotions.map((item) => item.issueIdentifier),
			);
			if (promotions.length > 0) {
				const workflowStates = await client.listWorkflowStates();
				const inProgressState = workflowStates.find(
					(state) =>
						state.team.id === team.id &&
						state.name.toLowerCase() === "in progress",
				);
				if (!inProgressState) {
					return {
						ok: false,
						error: {
							code: "NOT_FOUND",
							message:
								"Workflow state In Progress was not found for the selected team.",
						},
					};
				}
				inProgressStateId = inProgressState.id;
			}

			let labelLookup = new Map<string, string>();
			if (shouldSyncTypeLabels) {
				labelLookup = buildLabelLookup(await client.listLabels(team.id));
			}

			for (const candidate of topEvaluated) {
				const promotion = promotions.find(
					(item) => item.issueIdentifier === candidate.issue.identifier,
				);
				const updateInput: Record<string, unknown> = {};

				if (promotion && inProgressStateId) {
					updateInput.stateId = inProgressStateId;
				}

				if (
					shouldSyncTypeLabels &&
					requiresTypeLabelSync(candidate.typeLabel)
				) {
					let expectedLabelId = candidate.issue.labels.find(
						(label) =>
							label.name.trim().toLowerCase() ===
							candidate.typeLabel.expected.toLowerCase(),
					)?.id;
					if (!expectedLabelId) {
						expectedLabelId = await ensureLabelId({
							client,
							teamId: team.id,
							labelName: candidate.typeLabel.expected,
							labelLookup,
						});
					}

					const retainedLabelIds = candidate.issue.labels
						.filter((label) => !asCanonicalTypeLabel(label.name))
						.map((label) => label.id);
					updateInput.labelIds = dedupeLabelIds([
						...retainedLabelIds,
						expectedLabelId,
					]);
					candidate.typeLabel.applied = true;
				}

				if (Object.keys(updateInput).length > 0) {
					await client.updateIssue(candidate.issue.identifier, updateInput);
				}

				if (promotion) {
					await client.createComment(
						candidate.issue.identifier,
						promotion.commentBody,
					);
					promotion.applied = true;
				}

				if (
					promotedIssueSet.has(candidate.issue.identifier) &&
					!promotion?.applied
				) {
					throw new Error(
						`Failed to apply promotion update for ${candidate.issue.identifier}.`,
					);
				}
			}
		}

		const recommendations: LinearTriageRecommendation[] = topEvaluated.map(
			(candidate) => ({
				issue: {
					identifier: candidate.issue.identifier,
					title: candidate.issue.title,
					url: candidate.issue.url,
					state: candidate.issue.state.name,
					lane: candidate.lane,
				},
				score: {
					value: candidate.score.score,
					band: candidate.score.band,
					completeness: candidate.score.metadata.completeness,
					fallbackUsed: candidate.score.metadata.fallbackUsed,
					missingFields: candidate.score.metadata.missingFields,
				},
				dependencies: {
					keys: candidate.dependencies,
					unresolved: candidate.guards.unresolvedDependencies,
				},
				typeLabel: {
					expected: candidate.typeLabel.expected,
					current: candidate.typeLabel.current,
					needsLabel: candidate.typeLabel.needsLabel,
					needsNormalization: candidate.typeLabel.needsNormalization,
					reason: candidate.typeLabel.reason,
					applied: candidate.typeLabel.applied,
				},
				promotable: candidate.promotable,
				reasons: candidate.guards.reasons,
			}),
		);

		return {
			ok: true,
			output: {
				team,
				summary: {
					totalIssues: filteredIssues.length,
					stateCounts: toStateCounts(filteredIssues),
					inProgressCap,
					maxPromote,
					metadataThreshold,
					recommendedPromotions: promotions.length,
					appliedPromotions: promotions.filter((item) => item.applied).length,
					recommendedTypeLabels: topEvaluated.filter((item) =>
						requiresTypeLabelSync(item.typeLabel),
					).length,
					appliedTypeLabels: topEvaluated.filter(
						(item) => item.typeLabel.applied,
					).length,
				},
				recommendations,
				promotions: promotions.map(({ issueIdentifier, reason, applied }) => ({
					issueIdentifier,
					reason,
					applied,
				})),
				dryRun: options.dryRun === true || !shouldApply,
			},
		};
	} catch (error) {
		const safeError = sanitizeError(error);
		if (error instanceof LinearAPIError) {
			if (
				error.code === "AUTHENTICATION_REQUIRED" ||
				error.code === "FORBIDDEN" ||
				error.code === "PERMISSION_DENIED"
			) {
				return {
					ok: false,
					error: {
						code: "PERMISSION_DENIED",
						message: `Linear API permission denied: ${safeError}`,
					},
				};
			}
			if (
				error.code === "VALIDATION_ERROR" ||
				error.code === "INVALID_INPUT" ||
				error.code === "NOT_FOUND"
			) {
				return {
					ok: false,
					error: {
						code: error.code === "NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR",
						message: safeError,
					},
				};
			}
		}

		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: `Failed to run Linear triage: ${safeError}`,
			},
		};
	}
}

function printHumanSummary(output: LinearTriageOutput): void {
	console.info(`team: ${output.team.key}`);
	console.info(`total_issues: ${output.summary.totalIssues}`);
	console.info(
		`recommended_promotions: ${output.summary.recommendedPromotions}`,
	);
	console.info(`applied_promotions: ${output.summary.appliedPromotions}`);
	console.info(
		`recommended_type_labels: ${output.summary.recommendedTypeLabels}`,
	);
	console.info(`applied_type_labels: ${output.summary.appliedTypeLabels}`);
	console.info("state_counts:");
	for (const state of output.summary.stateCounts) {
		console.info(`  - ${state.stateName}: ${state.count}`);
	}
	if (output.promotions.length > 0) {
		console.info("promotions:");
		for (const promotion of output.promotions) {
			console.info(
				`  - ${promotion.issueIdentifier}: ${promotion.reason} (${promotion.applied ? "applied" : "planned"})`,
			);
		}
	}
	if (output.recommendations.length > 0) {
		console.info("top_candidates:");
		for (const recommendation of output.recommendations.slice(0, 5)) {
			console.info(
				`  - ${recommendation.issue.identifier}: score=${recommendation.score.value} band=${recommendation.score.band} promotable=${recommendation.promotable} type_label=${recommendation.typeLabel.expected}`,
			);
		}
	}
}

export async function runLinearTriageCLI(
	options: LinearTriageOptions,
): Promise<number> {
	const result = await runLinearTriage(options);
	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(result.error.message);
		}
		switch (result.error.code) {
			case "NOT_FOUND":
				return EXIT_CODES.NOT_FOUND;
			case "PERMISSION_DENIED":
				return EXIT_CODES.PERMISSION_DENIED;
			case "VALIDATION_ERROR":
				return EXIT_CODES.VALIDATION_ERROR;
			default:
				return EXIT_CODES.SYSTEM_ERROR;
		}
	}

	if (options.json) {
		console.info(JSON.stringify(result.output, null, 2));
	} else {
		printHumanSummary(result.output);
	}
	return EXIT_CODES.SUCCESS;
}
