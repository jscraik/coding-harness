const DEFAULT_BRANCH_PREFIX = "codex";
const MAX_BRANCH_NAME_LENGTH = 72;

export interface LinearAutomationMetadataInput {
	identifier: string;
	title: string;
	url: string;
	branchName?: string | null;
	branchPrefix?: string;
}

export interface LinearAutomationMetadata {
	issueIdentifier: string;
	issueTitle: string;
	issueUrl: string;
	branchName: string;
	prTitle: string;
	prBody: string;
	linkLine: string;
	closingLine: string;
}

export interface BranchAutomationValidationResult {
	ok: boolean;
	errors: string[];
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

function normalizeBranchPrefix(prefix: string | undefined): string {
	const trimmed = prefix?.trim().replace(/\/+$/g, "");
	return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_BRANCH_PREFIX;
}

function deriveBranchStem(input: LinearAutomationMetadataInput): string {
	const issueKey = input.identifier.toLowerCase();
	const fromLinear = input.branchName?.split("/").slice(1).join("/") ?? "";
	const preferred = slugify(fromLinear);
	if (preferred.includes(issueKey)) {
		return preferred;
	}
	const fallback = slugify(`${issueKey}-${input.title}`);
	return fallback.length > 0 ? fallback : issueKey;
}

function truncateBranchStem(stem: string, prefix: string): string {
	const maxStemLength = Math.max(1, MAX_BRANCH_NAME_LENGTH - prefix.length - 1);
	if (stem.length <= maxStemLength) {
		return stem;
	}
	return stem.slice(0, maxStemLength).replace(/-+$/g, "");
}

export function buildLinearAutomationMetadata(
	input: LinearAutomationMetadataInput,
): LinearAutomationMetadata {
	const prefix = normalizeBranchPrefix(input.branchPrefix);
	const branchStem = truncateBranchStem(deriveBranchStem(input), prefix);
	const branchName = `${prefix}/${branchStem}`;
	const prTitle = `${input.identifier}: ${input.title}`;
	const linkLine = `Refs ${input.identifier}`;
	const closingLine = `Fixes ${input.identifier}`;
	const prBody = `${linkLine}\n\nLinear: ${input.url}`;

	return {
		issueIdentifier: input.identifier,
		issueTitle: input.title,
		issueUrl: input.url,
		branchName,
		prTitle,
		prBody,
		linkLine,
		closingLine,
	};
}

export function validateLinearAutomationBranch(options: {
	branch: string;
	issueIdentifier: string;
	branchPrefix?: string;
}): BranchAutomationValidationResult {
	const errors: string[] = [];
	const prefix = normalizeBranchPrefix(options.branchPrefix);
	const normalizedBranch = options.branch.trim().toLowerCase();
	const issueKey = options.issueIdentifier.toLowerCase();

	if (!normalizedBranch.startsWith(`${prefix}/`)) {
		errors.push(`Branch must start with ${prefix}/.`);
	}
	if (!normalizedBranch.includes(issueKey)) {
		errors.push(
			`Branch must include the Linear issue key ${options.issueIdentifier} to enable branch and PR linking.`,
		);
	}

	return {
		ok: errors.length === 0,
		errors,
	};
}
