import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.CIRCLE_PROJECT_USERNAME || "jscraik";
const repo = process.env.CIRCLE_PROJECT_REPONAME || "coding-harness";

const STALE_ISSUE_DAYS = 60;
const STALE_PR_DAYS = 30;
const CLOSE_AFTER_DAYS = 7;
const STALE_LABEL = "stale";

const EXEMPT_ISSUE_LABELS = new Set([
	"pinned",
	"security",
	"help-wanted",
	"good-first-issue",
]);
const EXEMPT_PR_LABELS = new Set(["pinned", "security", "work-in-progress"]);

function daysSince(dateStr: string): number {
	return Math.floor(
		(Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
	);
}

function hasExemptLabel(
	labels: Array<{ name?: string }>,
	exemptions: Set<string>,
): boolean {
	return labels.some((l) => l.name && exemptions.has(l.name));
}

async function run() {
	if (!process.env.GITHUB_TOKEN) {
		console.info("GITHUB_TOKEN not set, skipping stale management.");
		return;
	}

	// Process issues
	const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
		owner,
		repo,
		state: "open",
		sort: "updated",
		direction: "asc",
		per_page: 100,
	});

	for (const issue of issues) {
		if (issue.pull_request) continue;
		if (
			hasExemptLabel(
				issue.labels as Array<{ name?: string }>,
				EXEMPT_ISSUE_LABELS,
			)
		)
			continue;
		if (issue.milestone) continue;

		const age = daysSince(issue.updated_at);
		const isStale = (issue.labels as Array<{ name?: string }>).some(
			(l) => l.name === STALE_LABEL,
		);

		if (isStale && age >= CLOSE_AFTER_DAYS) {
			console.info(`Closing stale issue #${issue.number}`);
			await octokit.rest.issues.createComment({
				owner,
				repo,
				issue_number: issue.number,
				body: "This issue was closed because it has been stalled for too long with no activity.",
			});
			await octokit.rest.issues.update({
				owner,
				repo,
				issue_number: issue.number,
				state: "closed",
			});
		} else if (!isStale && age >= STALE_ISSUE_DAYS) {
			console.info(`Marking issue #${issue.number} as stale`);
			await octokit.rest.issues.addLabels({
				owner,
				repo,
				issue_number: issue.number,
				labels: [STALE_LABEL],
			});
			await octokit.rest.issues.createComment({
				owner,
				repo,
				issue_number: issue.number,
				body: "This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs.",
			});
		}
	}

	// Process PRs
	const prs = await octokit.paginate(octokit.rest.pulls.list, {
		owner,
		repo,
		state: "open",
		sort: "updated",
		direction: "asc",
		per_page: 100,
	});

	for (const pr of prs) {
		if (hasExemptLabel(pr.labels as Array<{ name?: string }>, EXEMPT_PR_LABELS))
			continue;
		if (pr.milestone) continue;

		const age = daysSince(pr.updated_at);
		const isStale = (pr.labels as Array<{ name?: string }>).some(
			(l) => l.name === STALE_LABEL,
		);

		if (isStale && age >= CLOSE_AFTER_DAYS) {
			console.info(`Closing stale PR #${pr.number}`);
			await octokit.rest.issues.createComment({
				owner,
				repo,
				issue_number: pr.number,
				body: "This PR was closed because it has been stalled for too long with no activity.",
			});
			await octokit.rest.pulls.update({
				owner,
				repo,
				pull_number: pr.number,
				state: "closed",
			});
		} else if (!isStale && age >= STALE_PR_DAYS) {
			console.info(`Marking PR #${pr.number} as stale`);
			await octokit.rest.issues.addLabels({
				owner,
				repo,
				issue_number: pr.number,
				labels: [STALE_LABEL],
			});
			await octokit.rest.issues.createComment({
				owner,
				repo,
				issue_number: pr.number,
				body: "This PR has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs.",
			});
		}
	}

	console.info("Stale management complete.");
}

run().catch((err) => {
	console.error("Stale management failed:", err);
	process.exit(1);
});
