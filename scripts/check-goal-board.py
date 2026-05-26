#!/usr/bin/env python3
"""Repo-local entrypoint for the Goal Governor board validator.

The validator implementation lives with the Goal Governor skill. This wrapper
keeps repository docs and PR review commands portable by providing one stable
repo command while still allowing operators to point at a different skill
checkout through GOAL_GOVERNOR_CHECK_GOAL_BOARD or the older
GOAL_GOVERNOR_CHECK_BOARD override used by the shell wrapper.
"""

from __future__ import annotations

import os
import runpy
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RELATIVE_SKILL_VALIDATOR = Path(
    "Skills/agent-ops/goal-governor/scripts/check_goal_board.py",
)
ENV_OVERRIDES = ("GOAL_GOVERNOR_CHECK_GOAL_BOARD", "GOAL_GOVERNOR_CHECK_BOARD")


def source_checkout_root() -> Path | None:
    try:
        common_dir = subprocess.check_output(
            [
                "git",
                "rev-parse",
                "--path-format=absolute",
                "--git-common-dir",
            ],
            cwd=REPO_ROOT,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

    common_path = Path(common_dir)
    if common_path.name != ".git":
        return None
    return common_path.parent


def candidate_validators() -> list[Path]:
    candidates: list[Path] = []
    for env_name in ENV_OVERRIDES:
        override = os.environ.get(env_name)
        if override:
            candidates.append(Path(override).expanduser())
    candidates.append(REPO_ROOT.parent / "agent-skills" / RELATIVE_SKILL_VALIDATOR)
    source_root = source_checkout_root()
    if source_root and source_root != REPO_ROOT:
        candidates.append(source_root.parent / "agent-skills" / RELATIVE_SKILL_VALIDATOR)
    candidates.append(Path.home() / "dev" / "agent-skills" / RELATIVE_SKILL_VALIDATOR)
    return list(dict.fromkeys(candidates))


def resolve_validator() -> Path:
    for candidate in candidate_validators():
        if candidate.is_file():
            return candidate
    searched = "\n- ".join(str(candidate) for candidate in candidate_validators())
    raise SystemExit(
        "Cannot find Goal Governor board validator. Searched:\n"
        f"- {searched}\n"
        "Set GOAL_GOVERNOR_CHECK_GOAL_BOARD or GOAL_GOVERNOR_CHECK_BOARD "
        "to the validator path if your skill checkout lives elsewhere.",
    )


if __name__ == "__main__":
    validator = resolve_validator()
    sys.argv = [str(validator), *sys.argv[1:]]
    runpy.run_path(str(validator), run_name="__main__")
