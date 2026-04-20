import { spawnSync } from "node:child_process";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
// We use CIRCLE_PROJECT_USERNAME and CIRCLE_PROJECT_REPONAME
// injected by CircleCI, or fallback to manual
const owner = process.env.CIRCLE_PROJECT_USERNAME || "jscraik";
const repo = process.env.CIRCLE_PROJECT_REPONAME || "coding-harness";

async function run() {
	if (!process.env.LINEAR_API_KEY) {
		console.info(
			"Skipping Linear sync because LINEAR_API_KEY is not configured.",
		);
		return;
	}

	let prTitle = "";
	let prBody = "";
	let prHeadRef = "";
	let prState = "";
	let merged = false;
	let prHtmlUrl = "";
	let prNumberStr = "";

	const circlePrUrl = process.env.CIRCLE_PULL_REQUEST;
	const isMain = process.env.CIRCLE_BRANCH === "main";

	if (circlePrUrl) {
		const defaultPrStr = circlePrUrl.split("/").pop();
		if (!defaultPrStr) return;
		const prNumber = Number.parseInt(defaultPrStr, 10);
		prNumberStr = prNumber.toString();
		const { data: pr } = await octokit.rest.pulls.get({
			owner,
			repo,
			pull_number: prNumber,
		});
		prTitle = pr.title;
		prBody = pr.body || "";
		prHeadRef = pr.head.ref;
		prState = pr.state;
		merged = pr.merged;
		prHtmlUrl = pr.html_url;
	} else if (isMain) {
		// If we're on main, look for the PR number in the commit message (e.g., from merge commit)
		const sha = process.env.CIRCLE_SHA1 as string;
		const { data: commit } = await octokit.rest.repos.getCommit({
			owner,
			repo,
			ref: sha,
		});
		const match = commit.commit.message.match(/\(#(\d+)\)/);
		if (!match) {
			console.info(
				"No PR number found in commit message on main branch. Skipping Linear sync.",
			);
			return;
		}
		const prNumber = Number.parseInt(match[1], 10);
		prNumberStr = prNumber.toString();
		const { data: pr } = await octokit.rest.pulls.get({
			owner,
			repo,
			pull_number: prNumber,
		});
		prTitle = pr.title;
		prBody = pr.body || "";
		prHeadRef = pr.head.ref;
		prState = pr.state;
		merged = pr.merged;
		prHtmlUrl = pr.html_url;
	} else {
		console.info("Not a PR and not on main branch. Skipping Linear sync.");
		return;
	}

	const text = [prTitle, prBody, prHeadRef].join("\n");
	const keyMatches = Array.from(
		text.matchAll(/\b([A-Z][A-Z0-9]+-\d+)\b/gi),
		(match) => match[1].toUpperCase(),
	);
	const issueKeys = Array.from(new Set(keyMatches));

	if (issueKeys.length === 0) {
		console.info(
			"Skipping Linear sync: no Linear key found in PR title/body/branch.",
		);
		return;
	}

	if (issueKeys.length > 1) {
		console.error(
			`Ambiguous Linear keys for PR #${prNumberStr}: ${issueKeys.join(", ")}. Refusing to sync automatically.`,
		);
		process.exit(1);
	}

	const issueKey = issueKeys[0];

	let linearAction = "";
	if (prState === "open") {
		linearAction = "handoff";
	} else if (prState === "closed" && merged) {
		linearAction = "close";
	} else if (prState === "closed" && !merged) {
		linearAction = "claim";
	} else {
		console.info(`No Linear sync mapping for PR state '${prState}'.`);
		return;
	}

	console.info(
		`Running Linear action: ${linearAction} for issue ${issueKey}...`,
	);

	const comment =
		linearAction === "close"
			? `PR #${prNumberStr} merged; auto-closing Linear issue.`
			: linearAction === "claim"
				? `PR #${prNumberStr} closed without merge; returning Linear issue to In Progress.`
				: `Synced from CircleCI pipeline for PR #${prNumberStr}.`;

	const cmdArgs = ["pnpm", "exec", "tsx", "src/cli.ts", "linear"];

	if (linearAction === "claim") {
		cmdArgs.push(
			"claim",
			"--issue",
			issueKey,
			"--state",
			"In Progress",
			"--no-assign",
			"--pr-url",
			prHtmlUrl,
			"--comment",
			comment,
			"--json",
		);
	} else {
		cmdArgs.push(
			linearAction,
			"--issue",
			issueKey,
			"--pr-url",
			prHtmlUrl,
			"--comment",
			comment,
			"--json",
		);
	}

	console.info(`Executing: ${cmdArgs.join(" ")}`);
	const [command, ...args] = cmdArgs;
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.status !== 0) {
		console.error("Linear CLI command failed");
		process.exit(1);
	}
}

run().catch((err) => {
	console.error("Failed to run Linear sync:", err);
	process.exit(1);
});
