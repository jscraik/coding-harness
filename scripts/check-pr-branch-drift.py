#!/usr/bin/env python3
"""Fail when a PR repair branch is stale or diverged from its upstream."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class GitResult:
	returncode: int
	stdout: str
	stderr: str


def run_git(args: list[str]) -> GitResult:
	result = subprocess.run(
		["git", *args],
		check=False,
		text=True,
		stdout=subprocess.PIPE,
		stderr=subprocess.PIPE,
	)
	return GitResult(
		returncode=result.returncode,
		stdout=result.stdout.strip(),
		stderr=result.stderr.strip(),
	)


def emit(payload: dict[str, object], as_json: bool) -> None:
	if as_json:
		print(json.dumps(payload, sort_keys=True))
		return
	status = payload["status"]
	reason = payload["reason"]
	print(f"pr-branch-drift: {status}: {reason}")


def main() -> int:
	parser = argparse.ArgumentParser(
		description=(
			"Validate that the current PR repair branch has not fallen behind or "
			"diverged from its upstream before handoff or push."
		),
	)
	parser.add_argument("--json", action="store_true", help="emit JSON output")
	args = parser.parse_args()

	unmerged = run_git(["diff", "--name-only", "--diff-filter=U"])
	if unmerged.returncode != 0:
		emit(
			{
				"status": "fail",
				"reason": "could not inspect unmerged paths",
				"stderr": unmerged.stderr,
			},
			args.json,
		)
		return 1
	if unmerged.stdout:
		emit(
			{
				"status": "fail",
				"reason": "branch has unresolved merge conflicts",
				"unmerged_paths": unmerged.stdout.splitlines(),
			},
			args.json,
		)
		return 1

	branch = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
	upstream = run_git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])
	if branch.returncode != 0 or upstream.returncode != 0:
		emit(
			{
				"status": "fail",
				"reason": "current branch has no readable upstream",
				"branch": branch.stdout,
				"stderr": upstream.stderr or branch.stderr,
			},
			args.json,
		)
		return 1

	counts = run_git(["rev-list", "--left-right", "--count", f"HEAD...{upstream.stdout}"])
	if counts.returncode != 0:
		emit(
			{
				"status": "fail",
				"reason": "could not compare branch with upstream",
				"branch": branch.stdout,
				"upstream": upstream.stdout,
				"stderr": counts.stderr,
			},
			args.json,
		)
		return 1

	ahead_text, behind_text = counts.stdout.split()
	ahead = int(ahead_text)
	behind = int(behind_text)
	status = "pass" if behind == 0 else "fail"
	reason = (
		"branch is current with upstream or ahead-only"
		if status == "pass"
		else "branch is behind or diverged from upstream; fetch and reconcile before handoff"
	)
	emit(
		{
			"status": status,
			"reason": reason,
			"branch": branch.stdout,
			"upstream": upstream.stdout,
			"ahead": ahead,
			"behind": behind,
		},
		args.json,
	)
	return 0 if status == "pass" else 1


if __name__ == "__main__":
	sys.exit(main())
