#!/usr/bin/env python3
"""Repo-local entrypoint for the Goal Governor board validator.

The validator implementation lives with the Goal Governor skill. This wrapper
keeps repository docs and PR review commands portable by providing one stable
repo command while still allowing operators to point at a different skill
checkout through GOAL_GOVERNOR_CHECK_GOAL_BOARD.
"""

from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RELATIVE_SKILL_VALIDATOR = Path(
    "Skills/agent-ops/goal-governor/scripts/check_goal_board.py",
)
ENV_OVERRIDE = "GOAL_GOVERNOR_CHECK_GOAL_BOARD"


def candidate_validators() -> list[Path]:
    candidates: list[Path] = []
    override = os.environ.get(ENV_OVERRIDE)
    if override:
        candidates.append(Path(override).expanduser())
    candidates.append(REPO_ROOT.parent / "agent-skills" / RELATIVE_SKILL_VALIDATOR)
    candidates.append(Path.home() / "dev" / "agent-skills" / RELATIVE_SKILL_VALIDATOR)
    return candidates


def resolve_validator() -> Path:
    for candidate in candidate_validators():
        if candidate.is_file():
            return candidate
    searched = "\n- ".join(str(candidate) for candidate in candidate_validators())
    raise SystemExit(
        "Cannot find Goal Governor board validator. Searched:\n"
        f"- {searched}\n"
        f"Set {ENV_OVERRIDE} to the validator path if your skill checkout lives elsewhere.",
    )


if __name__ == "__main__":
    validator = resolve_validator()
    sys.argv = [str(validator), *sys.argv[1:]]
    runpy.run_path(str(validator), run_name="__main__")
