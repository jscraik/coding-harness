import { sanitizeError } from "../lib/input/sanitize.js";
import { validateLinearAutomationBranch } from "../lib/linear/automation.js";
import { LinearAPIError, LinearClient } from "../lib/linear/client.js";
import {
	normalizeIssueReference,
	normalizeTeamMatch,
	normalizeToken,
	selectIssue,
} from "../lib/linear/utils.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

const DEFAULT_STATE_BY_ACTION = {
	claim: "In Progress",
	handoff: "In Review",
	close: "Done",
} as const;

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LinearWorkflowAction = keyof typeof DEFAULT_STATE_BY_ACTION;

export interface LinearWorkflowOptions {
	action: LinearWorkflowAction;
	issue?: string;
	token?: string;
	team?: string;
	state?: string;
	assignee?: string;
	noAssign?: boolean;
	comment?: string;
	branch?: string;
	workspace?: string;
	prUrl?: string;
	evidenceUrls?: string[];
	links?: string[];
	json?: boolean;
}

export interface LinearWorkflowOutput {
	action: LinearWorkflowAction;
	issue: {
		identifier: string;
		title: string;
		url: string;
		teamKey: string;
		teamName: string;
	};
	state: {
		before: string;
		after: string;
		changed: boolean;
	};
	commentCreated: boolean;
	assignee?: string;
	attachments: Array<{ title: string; url: string }>;
}

export type LinearWorkflowResult =
	| { ok: true; output: LinearWorkflowOutput }
	| { ok: false; error: { code: string; message: string } };

function dedupeUrls(urls: Array<string | undefined>): string[] {
	const seen = new Set<string>();
	const deduped: string[] = [];
	for (const raw of urls) {
		const trimmed = raw?.trim();
		if (!trimmed || seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		deduped.push(trimmed);
	}
	return deduped;
}

function buildCommentBody(options: {
	action: LinearWorkflowAction;
	stateName: string;
	issueIdentifier: string;
	assigneeLabel: string | undefined;
	comment: string | undefined;
	branch: string | undefined;
	workspace: string | undefined;
	prUrl: string | undefined;
	evidenceUrls: string[] | undefined;
	links: string[] | undefined;
}): string {
	const introByAction: Record<LinearWorkflowAction, string> = {
		claim: `Claimed via \`harness linear claim\` for \`${options.issueIdentifier}\`.`,
		handoff: `Handed off via \`harness linear handoff\` for \`${options.issueIdentifier}\`.`,
		close: `Closed via \`harness linear close\` for \`${options.issueIdentifier}\`.`,
	};

	const lines = [options.comment?.trim(), introByAction[options.action]].filter(
		(value): value is string => Boolean(value && value.length > 0),
	);
	const bullets: string[] = [`target_state: \`${options.stateName}\``];
	if (options.assigneeLabel) {
		bullets.push(`assignee: ${options.assigneeLabel}`);
	}
	if (options.branch) {
		bullets.push(`branch: \`${options.branch}\``);
	}
	if (options.workspace) {
		bullets.push(`workspace: \`${options.workspace}\``);
	}
	if (options.prUrl) {
		bullets.push(`pr: ${options.prUrl}`);
	}
	for (const [index, url] of (options.evidenceUrls ?? []).entries()) {
		bullets.push(`evidence_${index + 1}: ${url}`);
	}
	for (const [index, url] of (options.links ?? []).entries()) {
		bullets.push(`link_${index + 1}: ${url}`);
	}
	return `${lines.join("\n\n")}\n\n${bullets.map((item) => `- ${item}`).join("\n")}`;
}

function resolveAttachmentTitles(options: {
	prUrl: string | undefined;
	evidenceUrls: string[];
	links: string[];
}): Array<{ title: string; url: string }> {
	const attachments: Array<{ title: string; url: string }> = [];
	if (options.prUrl?.trim()) {
		attachments.push({ title: "Pull request", url: options.prUrl.trim() });
	}
	for (const [index, url] of options.evidenceUrls.entries()) {
		attachments.push({
			title:
				options.evidenceUrls.length === 1
					? "Evidence"
					: `Evidence ${index + 1}`,
			url,
		});
	}
	for (const [index, url] of options.links.entries()) {
		attachments.push({ title: `Reference ${index + 1}`, url });
	}
	return attachments;
}

function resolveAssigneeUpdateInput(options: {
	action: LinearWorkflowAction;
	assignee: string | undefined;
	noAssign: boolean | undefined;
	viewerId: string;
	viewerLabel: string;
}): { assigneeId?: string; assigneeLabel?: string } {
	if (options.action !== "claim" || options.noAssign) {
		return {};
	}

	const requestedAssignee = options.assignee?.trim();
	if (!requestedAssignee || requestedAssignee.toLowerCase() === "me") {
		return { assigneeId: options.viewerId, assigneeLabel: options.viewerLabel };
	}

	if (!UUID_PATTERN.test(requestedAssignee)) {
		throw new LinearAPIError(
			"VALIDATION_ERROR",
			"--assignee currently supports me or a Linear user UUID.",
		);
	}

	return { assigneeId: requestedAssignee, assigneeLabel: requestedAssignee };
}

export async function runLinearWorkflow(
	options: LinearWorkflowOptions,
): Promise<LinearWorkflowResult> {
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

	const rawIssue = options.issue?.trim();
	if (!rawIssue) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "Missing required --issue value.",
			},
		};
	}

	const issueRef = normalizeIssueReference(rawIssue);
	const targetStateName =
		options.state?.trim() || DEFAULT_STATE_BY_ACTION[options.action];
	const teamMatch = normalizeTeamMatch(options.team);
	const evidenceUrls = dedupeUrls(options.evidenceUrls ?? []);
	const linkUrls = dedupeUrls(options.links ?? []);

	const client = new LinearClient({ token });

	try {
		const [issues, workflowStates, viewer] = await Promise.all([
			client.searchIssues(issueRef),
			client.listWorkflowStates(),
			client.getViewer(),
		]);

		const issue = selectIssue(issues, issueRef, teamMatch);
		if (!issue) {
			const matchingTeams = issues
				.map((candidate) => `${candidate.identifier} (${candidate.team.key})`)
				.join(", ");
			return {
				ok: false,
				error: {
					code: issues.length === 0 ? "NOT_FOUND" : "VALIDATION_ERROR",
					message:
						issues.length === 0
							? `Linear issue not found for ${issueRef}.`
							: `Could not resolve a unique Linear issue for ${issueRef}. Matches: ${matchingTeams}`,
				},
			};
		}

		if (options.branch) {
			const branchValidation = validateLinearAutomationBranch({
				branch: options.branch,
				issueIdentifier: issue.identifier,
			});
			if (!branchValidation.ok) {
				return {
					ok: false,
					error: {
						code: "VALIDATION_ERROR",
						message: branchValidation.errors.join(" "),
					},
				};
			}
		}

		const targetState = workflowStates.find(
			(state) =>
				state.team.id === issue.team.id &&
				state.name.toLowerCase() === targetStateName.toLowerCase(),
		);
		if (!targetState) {
			return {
				ok: false,
				error: {
					code: "NOT_FOUND",
					message: `Workflow state ${targetStateName} was not found for team ${issue.team.key}.`,
				},
			};
		}

		const assignee = resolveAssigneeUpdateInput({
			action: options.action,
			assignee: options.assignee,
			noAssign: options.noAssign,
			viewerId: viewer.id,
			viewerLabel: viewer.email || viewer.name,
		});

		const updateInput: Record<string, unknown> = {};
		if (issue.state.id !== targetState.id) {
			updateInput.stateId = targetState.id;
		}
		if (assignee.assigneeId) {
			updateInput.assigneeId = assignee.assigneeId;
		}

		if (Object.keys(updateInput).length > 0) {
			await client.updateIssue(issue.identifier, updateInput);
		}

		const attachments = resolveAttachmentTitles({
			prUrl: options.prUrl,
			evidenceUrls,
			links: linkUrls,
		});
		const commentBody = buildCommentBody({
			action: options.action,
			stateName: targetState.name,
			issueIdentifier: issue.identifier,
			assigneeLabel: assignee.assigneeLabel,
			comment: options.comment,
			branch: options.branch,
			workspace: options.workspace,
			prUrl: options.prUrl,
			evidenceUrls,
			links: linkUrls,
		});
		await client.createComment(issue.identifier, commentBody);
		for (const attachment of attachments) {
			await client.createAttachment({
				issueId: issue.identifier,
				title: attachment.title,
				url: attachment.url,
			});
		}

		return {
			ok: true,
			output: {
				action: options.action,
				issue: {
					identifier: issue.identifier,
					title: issue.title,
					url: issue.url,
					teamKey: issue.team.key,
					teamName: issue.team.name,
				},
				state: {
					before: issue.state.name,
					after: targetState.name,
					changed: issue.state.id !== targetState.id,
				},
				commentCreated: true,
				...(assignee.assigneeLabel ? { assignee: assignee.assigneeLabel } : {}),
				attachments,
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
			if (error.code === "VALIDATION_ERROR" || error.code === "INVALID_INPUT") {
				return {
					ok: false,
					error: {
						code: "VALIDATION_ERROR",
						message: safeError,
					},
				};
			}
		}

		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: `Failed to update Linear workflow: ${safeError}`,
			},
		};
	}
}

export async function runLinearWorkflowCLI(
	options: LinearWorkflowOptions,
): Promise<number> {
	const result = await runLinearWorkflow(options);
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
		console.info(
			`${result.output.action}: ${result.output.issue.identifier} ${result.output.state.before} -> ${result.output.state.after}`,
		);
		console.info(`  url: ${result.output.issue.url}`);
		console.info(`  team: ${result.output.issue.teamKey}`);
		console.info("  comment: created");
		if (result.output.assignee) {
			console.info(`  assignee: ${result.output.assignee}`);
		}
		if (result.output.attachments.length > 0) {
			console.info(`  attachments: ${result.output.attachments.length}`);
		}
	}
	return EXIT_CODES.SUCCESS;
}
