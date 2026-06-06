import { spawnSync } from "node:child_process";
import type { DoctorCheckFn } from "./doctor-checks.js";
import {
	formatGitHubCliFailure,
	formatGitHubCliVerificationCommand,
	resolveGitHubCli,
	resolveGitHubCliPath,
} from "../lib/github/cli.js";

const DEFAULT_GITHUB_AUTH_TIMEOUT = 3000;
const MAX_GITHUB_AUTH_TIMEOUT = 120_000;

/** Parse the GitHub auth probe timeout from env with finite positive bounds. */
export function parseGithubAuthTimeout(value: string | undefined): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return DEFAULT_GITHUB_AUTH_TIMEOUT;
	}
	return Math.min(Math.trunc(parsed), MAX_GITHUB_AUTH_TIMEOUT);
}

/** Create the GitHub CLI prerequisite check used by harness doctor. */
export function createDoctorGitHubToolCheck(
	env: NodeJS.ProcessEnv,
): DoctorCheckFn {
	const githubAuthTimeout = parseGithubAuthTimeout(env.GITHUB_AUTH_TIMEOUT);
	return (_dir) => {
		const githubCli = resolveGitHubCli(env);
		const resolvedPath = resolveGitHubCliPath(githubCli);
		const versionResult = spawnSync(githubCli.command, ["--version"], {
			stdio: "pipe",
			encoding: "utf-8",
			timeout: 5000,
		});
		if (versionResult.error || versionResult.status !== 0) {
			return {
				id: "tool:gh",
				category: "tool",
				label: "GitHub CLI (gh)",
				status: "warn",
				message:
					"gh version probe failed - required for branch-protect and PR workflows: " +
					formatGitHubCliFailure(versionResult, ["--version"], githubCli, {
						resolvedPath,
					}),
				fix:
					"Install or repair GitHub CLI, or set HARNESS_GH_BIN/GH_BIN to a working binary; verify with: " +
					formatGitHubCliVerificationCommand(githubCli),
			};
		}
		const authResult = spawnSync(githubCli.command, ["auth", "status"], {
			stdio: "pipe",
			encoding: "utf-8",
			timeout: githubAuthTimeout,
		});
		if (authResult.error) {
			const err = authResult.error as NodeJS.ErrnoException;
			if (err.code === "ETIMEDOUT") {
				return {
					id: "tool:gh",
					category: "tool",
					label: "GitHub CLI (gh)",
					status: "warn",
					message: `gh auth check timed out after ${githubAuthTimeout}ms - network or gh responsiveness issue`,
					fix: "Check network connectivity and gh installation, then retry or increase GITHUB_AUTH_TIMEOUT",
				};
			}
			return {
				id: "tool:gh",
				category: "tool",
				label: "GitHub CLI (gh)",
				status: "warn",
				message:
					"gh auth check failed: " +
					formatGitHubCliFailure(authResult, ["auth", "status"], githubCli, {
						resolvedPath,
					}),
				fix: "Verify gh installation/PATH or set HARNESS_GH_BIN/GH_BIN, then run gh auth login",
			};
		}
		if (authResult.status !== 0) {
			return {
				id: "tool:gh",
				category: "tool",
				label: "GitHub CLI (gh)",
				status: "warn",
				message: "gh found but not authenticated",
				fix: "gh auth login",
			};
		}
		return {
			id: "tool:gh",
			category: "tool",
			label: "GitHub CLI (gh)",
			status: "ok",
			message: "found and authenticated",
		};
	};
}
