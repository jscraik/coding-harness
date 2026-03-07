import { sanitizeError } from "../lib/input/sanitize.js";
import { buildLinearAutomationMetadata } from "../lib/linear/automation.js";
import {
	LinearAPIError,
	LinearClient,
	type LinearIssueSummary,
} from "../lib/linear/client.js";

export interface LinearPrepareOptions {
	issue?: string;
	token?: string;
	team?: string;
	branchPrefix?: string;
	field?:
		| "branch"
		| "pr-title"
		| "pr-body"
		| "link-line"
		| "closing-line"
		| "issue-url";
	json?: boolean;
}

export interface LinearPrepareOutput {
	issueIdentifier: string;
	issueTitle: string;
	issueUrl: string;
	branchName: string;
	prTitle: string;
	prBody: string;
	linkLine: string;
	closingLine: string;
}

export type LinearPrepareResult =
	| { ok: true; output: LinearPrepareOutput }
	| { ok: false; error: { code: string; message: string } };

const ISSUE_IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;

function normalizeToken(value: string | undefined): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (
		trimmed.length === 0 ||
		trimmed.toLowerCase() === "undefined" ||
		trimmed.toLowerCase() === "null"
	) {
		return undefined;
	}
	return trimmed;
}

function normalizeIssueReference(value: string): string {
	const trimmed = value.trim();
	const urlMatch = trimmed.match(/\/issue\/([A-Z][A-Z0-9]+-\d+)/i);
	if (urlMatch?.[1]) {
		return urlMatch[1].toUpperCase();
	}
	if (ISSUE_IDENTIFIER_PATTERN.test(trimmed)) {
		return trimmed.toUpperCase();
	}
	return trimmed;
}

function normalizeTeamMatch(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed.toLowerCase() : undefined;
}

function issueMatchesTeam(
	issue: LinearIssueSummary,
	team: string | undefined,
): boolean {
	if (!team) {
		return true;
	}
	return (
		issue.team.key.toLowerCase() === team ||
		issue.team.name.toLowerCase() === team
	);
}

function selectIssue(
	issues: LinearIssueSummary[],
	issueRef: string,
	team: string | undefined,
): LinearIssueSummary | undefined {
	const teamFiltered = issues.filter((issue) => issueMatchesTeam(issue, team));
	if (teamFiltered.length === 0) {
		return undefined;
	}

	const exactIdentifier = teamFiltered.find(
		(issue) => issue.identifier.toLowerCase() === issueRef.toLowerCase(),
	);
	if (exactIdentifier) {
		return exactIdentifier;
	}

	if (teamFiltered.length === 1) {
		return teamFiltered[0];
	}

	return undefined;
}

function readRequestedField(
	output: LinearPrepareOutput,
	field: NonNullable<LinearPrepareOptions["field"]>,
): string {
	switch (field) {
		case "branch":
			return output.branchName;
		case "pr-title":
			return output.prTitle;
		case "pr-body":
			return output.prBody;
		case "link-line":
			return output.linkLine;
		case "closing-line":
			return output.closingLine;
		case "issue-url":
			return output.issueUrl;
	}
}

export async function runLinearPrepare(
	options: LinearPrepareOptions,
): Promise<LinearPrepareResult> {
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
	const teamMatch = normalizeTeamMatch(options.team);
	const client = new LinearClient({ token });

	try {
		const issues = await client.searchIssues(issueRef);
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

		return {
			ok: true,
			output: buildLinearAutomationMetadata({
				identifier: issue.identifier,
				title: issue.title,
				url: issue.url,
				...(issue.branchName !== undefined
					? { branchName: issue.branchName }
					: {}),
				...(options.branchPrefix !== undefined
					? { branchPrefix: options.branchPrefix }
					: {}),
			}),
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
				message: `Failed to prepare Linear automation metadata: ${safeError}`,
			},
		};
	}
}

export async function runLinearPrepareCLI(
	options: LinearPrepareOptions,
): Promise<number> {
	const result = await runLinearPrepare(options);
	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(result.error.message);
		}
		switch (result.error.code) {
			case "NOT_FOUND":
				return 2;
			case "PERMISSION_DENIED":
				return 3;
			case "VALIDATION_ERROR":
				return 1;
			default:
				return 10;
		}
	}

	if (options.field) {
		console.info(readRequestedField(result.output, options.field));
		return 0;
	}

	if (options.json) {
		console.info(JSON.stringify(result.output, null, 2));
		return 0;
	}

	console.info(`issue: ${result.output.issueIdentifier}`);
	console.info(`url: ${result.output.issueUrl}`);
	console.info(`branch: ${result.output.branchName}`);
	console.info(`pr_title: ${result.output.prTitle}`);
	console.info(`link_line: ${result.output.linkLine}`);
	console.info(`closing_line: ${result.output.closingLine}`);
	console.info("pr_body:");
	console.info(result.output.prBody);
	return 0;
}
