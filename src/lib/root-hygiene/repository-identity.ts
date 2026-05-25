import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { rootHygieneGitEnv } from "./git-env.js";

export const ROOT_HYGIENE_REPOSITORY_ID_KIND =
	"git_toplevel_realpath_sha256" as const;

/** Non-path repository binding for root-hygiene replay checks. */
export interface RootHygieneRepositoryIdentity {
	kind: typeof ROOT_HYGIENE_REPOSITORY_ID_KIND;
	digest: string;
}

/** Resolve the canonical git toplevel for root-hygiene checks. */
export function rootHygieneRepositoryTopLevel(repoRoot: string): string {
	if (repoRoot.trim() === "") {
		throw new Error(
			"repoRoot is required for root-hygiene repository identity",
		);
	}
	const gitTopLevel = execFileSync(
		"git",
		["-C", repoRoot, "rev-parse", "--show-toplevel"],
		{
			encoding: "utf8",
			env: rootHygieneGitEnv(),
			maxBuffer: 1024 * 1024,
		},
	).trim();
	return realpathSync(gitTopLevel);
}

/** Build a non-path repository identity for root-hygiene replay checks. */
export function rootHygieneRepositoryIdentity(
	repoRoot: string,
): RootHygieneRepositoryIdentity {
	const canonicalRoot = rootHygieneRepositoryTopLevel(repoRoot);
	return {
		kind: ROOT_HYGIENE_REPOSITORY_ID_KIND,
		digest: createHash("sha256").update(canonicalRoot).digest("hex"),
	};
}

/** Return true when two root-hygiene repository identities match. */
export function sameRootHygieneRepositoryIdentity(
	left: RootHygieneRepositoryIdentity | null | undefined,
	right: RootHygieneRepositoryIdentity | null | undefined,
): boolean {
	return (
		left !== null &&
		left !== undefined &&
		right !== null &&
		right !== undefined &&
		left.kind === right.kind &&
		left.digest === right.digest
	);
}
