import { spawnSync } from "node:child_process";

const HEAD_SHA = /^[0-9a-f]{40}$/u;

/** Read the current repository HEAD SHA, returning null when it cannot be verified. */
export function readCurrentHeadSha(repoRoot: string): string | null {
	const result = spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	const value = result.status === 0 ? result.stdout.trim() : "";
	return HEAD_SHA.test(value) ? value : null;
}
