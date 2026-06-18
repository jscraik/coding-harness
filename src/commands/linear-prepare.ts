import { sanitizeError } from "../lib/input/sanitize.js";
import { buildLinearAutomationMetadata } from "../lib/linear/automation.js";
import { LinearAPIError, LinearClient } from "../lib/linear/client.js";
import {
	normalizeIssueReference,
	normalizeTeamMatch,
	normalizeToken,
	selectIssue,
} from "../lib/linear/utils.js";

/** Options for resolving a Linear issue into branch and pull request metadata. */
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

/** Branch, pull request, and issue metadata produced by linear-prepare. */
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

/** Result returned by the Linear prepare command implementation. */
export type LinearPrepareResult =
	| { ok: true; output: LinearPrepareOutput }
	| { ok: false; error: { code: string; message: string } };

type LinearPrepareError = Extract<LinearPrepareResult, { ok: false }>;

interface LinearPrepareInputs {
	token: string;
	issueRef: string;
}

type LinearPrepareInputsResult =
	| { ok: true; inputs: LinearPrepareInputs }
	| LinearPrepareError;

function linearPrepareError(code: string, message: string): LinearPrepareError {
	return { ok: false, error: { code, message } };
}

function validateLinearPrepareInputs(
	options: LinearPrepareOptions,
): LinearPrepareInputsResult {
	const token =
		normalizeToken(options.token) ?? normalizeToken(process.env.LINEAR_API_KEY);
	if (!token) {
		return linearPrepareError(
			"VALIDATION_ERROR",
			"Missing Linear API key. Provide --token or set LINEAR_API_KEY.",
		);
	}

	const rawIssue = options.issue?.trim();
	return rawIssue
		? {
				ok: true,
				inputs: { token, issueRef: normalizeIssueReference(rawIssue) },
			}
		: linearPrepareError("VALIDATION_ERROR", "Missing required --issue value.");
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

/**
 * Resolves a Linear issue and builds automation-ready branch and pull request metadata.
 *
 * @param options - Linear issue lookup, authentication, formatting, and output options
 * @returns Structured metadata on success or a machine-readable error result
 */
export async function runLinearPrepare(
	options: LinearPrepareOptions,
): Promise<LinearPrepareResult> {
	const inputs = validateLinearPrepareInputs(options);
	if (!inputs.ok) return inputs;

	const { token, issueRef } = inputs.inputs;
	const teamMatch = normalizeTeamMatch(options.team);
	const client = new LinearClient({ token });

	try {
		const issues = await client.searchIssues(issueRef);
		const issue = selectIssue(issues, issueRef, teamMatch);
		if (!issue) {
			return linearIssueNotFoundResult(issues, issueRef);
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
		return linearPrepareCaughtError(error);
	}
}

function linearIssueNotFoundResult(
	issues: Awaited<ReturnType<LinearClient["searchIssues"]>>,
	issueRef: string,
): LinearPrepareResult {
	if (issues.length === 0) {
		return linearPrepareError(
			"NOT_FOUND",
			`Linear issue not found for ${issueRef}.`,
		);
	}
	const matchingTeams = issues
		.map((candidate) => `${candidate.identifier} (${candidate.team.key})`)
		.join(", ");
	return linearPrepareError(
		"VALIDATION_ERROR",
		`Could not resolve a unique Linear issue for ${issueRef}. Matches: ${matchingTeams}`,
	);
}

function linearPrepareCaughtError(error: unknown): LinearPrepareResult {
	const safeError = sanitizeError(error);
	if (error instanceof LinearAPIError) {
		if (isLinearPermissionError(error.code)) {
			return linearPrepareError(
				"PERMISSION_DENIED",
				`Linear API permission denied: ${safeError}`,
			);
		}
		if (error.code === "VALIDATION_ERROR" || error.code === "INVALID_INPUT") {
			return linearPrepareError("VALIDATION_ERROR", safeError);
		}
	}
	return linearPrepareError(
		"SYSTEM_ERROR",
		`Failed to prepare Linear automation metadata: ${safeError}`,
	);
}

function isLinearPermissionError(code: string): boolean {
	return ["AUTHENTICATION_REQUIRED", "FORBIDDEN", "PERMISSION_DENIED"].includes(
		code,
	);
}

/**
 * Executes the linear-prepare command and writes the requested output format.
 *
 * @param options - Linear issue lookup, authentication, formatting, and output options
 * @returns Process-style exit code for success, validation, not-found, permission, or system errors
 */
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
