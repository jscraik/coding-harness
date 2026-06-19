import type {
	PrCloseoutCheckInput,
	PrCloseoutToolInput,
} from "../lib/pr-closeout.js";
import { formatGitHubCliFailure, resolveGitHubCli } from "../lib/github/cli.js";
import type { PrCloseoutCLIOptions } from "./pr-closeout/args.js";
import type { CommandRunner } from "./pr-closeout/types.js";

const CHECK_PROOF_PAGE_SIZE = 100;

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function payloadArray(value: unknown, key: string): unknown[] {
	if (Array.isArray(value)) return value;
	const nested = asRecord(value)?.[key];
	return Array.isArray(nested) ? nested : [];
}

function parseJsonObject(
	value: string,
	source: string,
): Record<string, unknown> {
	const parsed = JSON.parse(value) as unknown;
	const record = asRecord(parsed);
	if (!record) {
		throw new Error(`${source} must contain a JSON object`);
	}
	return record;
}

function checkProofKey(name: string, url: string | null): string {
	return `${name}\0${url ?? ""}`;
}

function normalizeGhRepo(value: Record<string, unknown>): {
	owner: string;
	repo: string;
} {
	const ownerValue = asRecord(value.owner);
	const owner = asString(value.owner) ?? asString(ownerValue?.login);
	const repo = asString(value.name);
	if (!owner || !repo) {
		throw new Error("gh repo view must include owner.login and name");
	}
	return { owner, repo };
}

function fetchRepoInfo(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
): { owner: string; repo: string } {
	const githubCli = resolveGitHubCli(env);
	const args = ["repo", "view", "--json", "owner,name"];
	return normalizeGhRepo(
		parseJsonObject(
			runner(githubCli.command, args, {
				cwd: options.repoRoot,
				env,
			}),
			"gh repo view",
		),
	);
}

function normalizeCheckRunProof(value: unknown): Map<string, string> {
	const proof = new Map<string, string>();
	for (const item of payloadArray(value, "check_runs")) {
function normalizeCheckRunProof(value: unknown): Map<string, string> {
	const proof = new Map<string, string>();
	for (const item of payloadArray(value, "check_runs")) {
		const record = asRecord(item);
		if (!record) continue;
		const name = asString(record.name);
		const url = asString(record.details_url) ?? asString(record.html_url);
		const headSha = asString(record.head_sha) ?? asString(record.headSha);
		if (name && headSha) {
			proof.set(checkProofKey(name, null), headSha);
			if (url) proof.set(checkProofKey(name, url), headSha);
		}
	}
	return proof;
}
	return proof;
}

function normalizeStatusProof(
	value: unknown,
	headSha: string,
): Map<string, string> {
	const proof = new Map<string, string>();
	for (const item of payloadArray(value, "statuses")) {
		const record = asRecord(item);
		if (!record) continue;
		const name = asString(record.context);
		const url = asString(record.target_url) ?? asString(record.targetUrl);
		const statusSha = asString(record.sha);
		if (name && (!statusSha || statusSha === headSha)) {
			proof.set(checkProofKey(name, null), headSha);
			if (url) proof.set(checkProofKey(name, url), headSha);
		}
	}
	return proof;
}

function payloadCount(value: unknown, key: string): number {
	return payloadArray(value, key).length;
}

function hasUnprovenCheck(
	checks: readonly PrCloseoutCheckInput[],
	proof: ReadonlyMap<string, string>,
	headSha: string,
): boolean {
	return checks.some((check) => {
		if (check.headSha === headSha) return false;
		const url = check.url ?? null;
		return (
			!proof.has(checkProofKey(check.name, url)) &&
			!proof.has(checkProofKey(check.name, null))
		);
	});
}

function mergeProof(
	target: Map<string, string>,
	source: ReadonlyMap<string, string>,
): void {
	for (const [key, value] of source) {
		target.set(key, value);
	}
}

function fetchCheckRunPage(
	owner: string,
	repo: string,
	headSha: string,
	page: number,
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
): unknown {
	const githubCli = resolveGitHubCli(env);
	const args = checkRunPageArgs(owner, repo, headSha, page);
	return JSON.parse(
		runner(githubCli.command, args, { cwd: options.repoRoot, env }),
	) as unknown;
}

function checkRunPageArgs(
	owner: string,
	repo: string,
	headSha: string,
	page: number,
): string[] {
	return [
		"api",
		`repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=${CHECK_PROOF_PAGE_SIZE}&page=${String(page)}`,
		"--jq",
		".check_runs",
	];
}

function collectCheckRunProof(
	repo: { owner: string; repo: string },
	headSha: string,
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
): {
	proof: Map<string, string>;
	error: unknown | null;
	errorArgs: readonly string[] | null;
} {
	const proof = new Map<string, string>();
	for (let page = 1; ; page += 1) {
		try {
			const parsed = fetchCheckRunPage(
				repo.owner,
				repo.repo,
				headSha,
				page,
				options,
				env,
				runner,
			);
			mergeProof(proof, normalizeCheckRunProof(parsed));
			if (payloadCount(parsed, "check_runs") < CHECK_PROOF_PAGE_SIZE) break;
		} catch (error) {
			return {
				proof,
				error,
				errorArgs: checkRunPageArgs(repo.owner, repo.repo, headSha, page),
			};
		}
	}
	return { proof, error: null, errorArgs: null };
}

function pushStatusProofFailure(
	tools: PrCloseoutToolInput[],
	error: unknown,
	args: readonly string[],
	page: number,
	githubCli: ReturnType<typeof resolveGitHubCli>,
): void {
	tools.push({
		name: "github_cli",
		available: true,
		ref:
			"command:gh api repos/:owner/:repo/commits/:head/statuses page=" +
			String(page),
		status: "blocked",
		failureClass:
			"pr_check_status_proof_unreadable:" +
			formatGitHubCliFailure(error, args, githubCli),
	});
}

function collectStatusProof(
	repo: { owner: string; repo: string },
	headSha: string,
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
): Map<string, string> {
	const githubCli = resolveGitHubCli(env);
	const proof = new Map<string, string>();
	for (let page = 1; ; page += 1) {
		const args = [
			"api",
			`repos/${repo.owner}/${repo.repo}/commits/${headSha}/statuses?per_page=${CHECK_PROOF_PAGE_SIZE}&page=${String(page)}`,
			"--jq",
			".",
		];
		try {
			const raw = runner(githubCli.command, args, {
				cwd: options.repoRoot,
				env,
			});
			const parsed = JSON.parse(raw) as unknown;
			mergeProof(proof, normalizeStatusProof(parsed, headSha));
			if (payloadCount(parsed, "statuses") < CHECK_PROOF_PAGE_SIZE) break;
		} catch (error) {
			pushStatusProofFailure(tools, error, args, page, githubCli);
			break;
		}
	}
	return proof;
}

function pushCheckRunProofFailure(
	tools: PrCloseoutToolInput[],
	error: unknown,
	githubCli: ReturnType<typeof resolveGitHubCli>,
	args: readonly string[],
	ref = "command:gh api repos/:owner/:repo/commits/:head/check-runs",
): void {
	tools.push({
		name: "github_cli",
		available: true,
		ref,
		status: "blocked",
		failureClass:
			"pr_check_head_proof_unreadable:" +
			formatGitHubCliFailure(error, args, githubCli),
	});
}

/** Attach observed current-head proof from GitHub's check-runs endpoint. */
export function applyCheckHeadProof(
	checks: readonly PrCloseoutCheckInput[],
	proof: ReadonlyMap<string, string>,
): PrCloseoutCheckInput[] {
	return checks.map((check) => ({
		...check,
		headSha:
			check.headSha ??
			(check.url ? proof.get(checkProofKey(check.name, check.url)) : null) ??
			proof.get(checkProofKey(check.name, null)) ??
			null,
	}));
}

/** Fetch current-head check-run proof for live pr-closeout evidence. */
export function fetchCheckHeadProof(
	options: PrCloseoutCLIOptions,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	tools: PrCloseoutToolInput[],
	checks: readonly PrCloseoutCheckInput[],
	headSha: string | null | undefined,
): Map<string, string> {
	if (!headSha) return new Map();
	const githubCli = resolveGitHubCli(env);
	try {
		const repo = fetchRepoInfo(options, env, runner);
		const checkRunResult = collectCheckRunProof(
			repo,
			headSha,
			options,
			env,
			runner,
		);
		const proof = checkRunResult.proof;
		const checkRunsError = checkRunResult.error;
		const checkRunsErrorArgs = checkRunResult.errorArgs;
		if (hasUnprovenCheck(checks, proof, headSha)) {
			mergeProof(
				proof,
				collectStatusProof(repo, headSha, options, env, runner, tools),
			);
		}
		if (checkRunsError && hasUnprovenCheck(checks, proof, headSha)) {
			pushCheckRunProofFailure(
				tools,
				checkRunsError,
				githubCli,
				checkRunsErrorArgs ??
					checkRunPageArgs(repo.owner, repo.repo, headSha, 1),
			);
		}
		return proof;
	} catch (error) {
		pushCheckRunProofFailure(
			tools,
			error,
			githubCli,
			["repo", "view", "--json", "owner,name"],
			"command:gh repo view --json owner,name",
		);
		return new Map();
	}
}
