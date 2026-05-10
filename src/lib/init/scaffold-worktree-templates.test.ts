// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated scripts.
import { describe, expect, it } from "vitest";
import {
	renderNewTaskScript,
	renderPrepareWorktreeScript,
} from "./scaffold-worktree-templates.js";

describe("scaffold worktree templates", () => {
	it("renders prepare-worktree with package-manager-specific install behavior", () => {
		const pnpmScript = renderPrepareWorktreeScript("pnpm");
		const npmScript = renderPrepareWorktreeScript("npm");

		expect(pnpmScript).toMatch(/^#!\/usr\/bin\/env bash/);
		expect(pnpmScript).toContain("set -euo pipefail");
		expect(pnpmScript).toContain(
			"--force-install   Run pnpm install even if node_modules already exists",
		);
		expect(pnpmScript).toContain(
			'echo "[prepare-worktree] installing dependencies (pnpm install)"',
		);
		expect(pnpmScript).toContain("\tpnpm install\n");
		expect(npmScript).toContain(
			"--force-install   Run npm install even if node_modules already exists",
		);
		expect(npmScript).toContain("\tnpm install\n");
	});

	it("renders prepare-worktree detached-head branch attachment safeguards", () => {
		const script = renderPrepareWorktreeScript("pnpm");

		expect(script).toContain(
			'branch_base="jscraik/feature/$repo_slug-worktree-$short_sha"',
		);
		expect(script).toContain(
			'echo "[prepare-worktree] detached HEAD detected; creating branch $branch_name"',
		);
		expect(script).toContain(
			'git branch --set-upstream-to=origin/main "$branch_name"',
		);
		expect(script).toContain("scripts/check-git-common-config.sh");
		expect(script).toContain("git pull --ff-only origin main");
		expect(script).toContain("node scripts/setup-git-hooks.js");
		expect(script).toContain(
			'echo "[prepare-worktree] next: bash scripts/verify-work.sh --fast"',
		);
	});

	it("renders new-task branch and slug validation for agent branches", () => {
		const script = renderNewTaskScript();

		expect(script).toMatch(/^#!\/usr\/bin\/env bash/);
		expect(script).toContain('branch_prefix="jscraik/feature"');
		expect(script).toContain(
			'if [[ "$branch_prefix" == jscraik/feature* ]]; then',
		);
		expect(script).toContain(
			"slug must start with an issue key (example: JSC-123-my-task)",
		);
		expect(script).toContain('branch_name="${branch_prefix}/${slug}"');
	});

	it("renders new-task remote-base refresh and explicit remote guards", () => {
		const script = renderNewTaskScript();

		expect(script).toContain(
			'echo "[new-task] fetching latest $remote_name/$remote_base_branch"',
		);
		expect(script).toContain(
			'git fetch --prune "$remote_name" "$remote_base_branch"',
		);
		expect(script).toContain(
			'resolved_base_ref="refs/remotes/$remote_name/$remote_base_branch"',
		);
		expect(script).toContain(
			'echo "[new-task] explicit remote base not found on $remote_name: $base_ref"',
		);
		expect(script).toContain(
			"echo \"[new-task] remote '$remote_name' is required for explicit remote base: $base_ref\"",
		);
	});

	it("renders new-task bootstrap and next-command guidance", () => {
		const script = renderNewTaskScript();

		expect(script).toContain(
			'git worktree add "$worktree_path" -b "${branch_name}" "$resolved_base_ref"',
		);
		expect(script).toContain('echo "[new-task] bootstrapping worktree"');
		expect(script).toContain("make worktree-ready");
		expect(script).toContain("bash scripts/prepare-worktree.sh");
		expect(script).toContain(
			'echo "  bash scripts/codex-preflight.sh --stack auto --mode required"',
		);
	});
});
