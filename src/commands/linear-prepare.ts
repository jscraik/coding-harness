import { sanitizeError } from "../lib/input/sanitize.js";
import { buildLinearAutomationMetadata } from "../lib/linear/automation.js";
import { LinearAPIError, LinearClient } from "../lib/linear/client.js";
import {
	normalizeIssueReference,
	normalizeTeamMatch,
	normalizeToken,
	selectIssue,
} from "../lib/linear/utils.js";

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
