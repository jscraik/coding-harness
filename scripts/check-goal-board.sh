#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat >&2 <<'USAGE'
Usage: bash scripts/check-goal-board.sh <goal-directory>

Validates a Goal Governor board with the shared check_goal_board.py verifier.
Set GOAL_GOVERNOR_CHECK_BOARD to the verifier path when it is not discoverable
from a standard local checkout.
USAGE
}

if [[ $# -ne 1 ]]; then
	usage
	exit 2
fi

goal_dir="$1"

if [[ ! -d "$goal_dir" ]]; then
	echo "Goal directory not found: $goal_dir" >&2
	exit 2
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
checker_candidates=()

if [[ -n "${GOAL_GOVERNOR_CHECK_BOARD:-}" ]]; then
	checker_candidates+=("$GOAL_GOVERNOR_CHECK_BOARD")
fi

checker_candidates+=(
	"$repo_root/../agent-skills/Skills/agent-ops/goal-governor/scripts/check_goal_board.py"
	"$HOME/dev/agent-skills/Skills/agent-ops/goal-governor/scripts/check_goal_board.py"
)

checker_path=""
for candidate in "${checker_candidates[@]}"; do
	if [[ -f "$candidate" ]]; then
		checker_path="$candidate"
		break
	fi
done

if [[ -z "$checker_path" ]]; then
	cat >&2 <<'ERROR'
Goal board checker was not found.
Set GOAL_GOVERNOR_CHECK_BOARD to goal-governor/scripts/check_goal_board.py.
ERROR
	exit 2
fi

PYTHONDONTWRITEBYTECODE=1 python3 "$checker_path" "$goal_dir"
