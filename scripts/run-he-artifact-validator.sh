#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

# usage prints a usage message to stderr listing supported validators, their corresponding Python scripts, and a note about setting AGENT_SKILLS_ROOT.
usage() {
	cat >&2 <<'USAGE'
Usage: bash scripts/run-he-artifact-validator.sh <validator> [args...]

Validators:
  bluf                 check_bluf_structure.py
  shape                check_generated_artifact_shape.py
  artifact-identity    he_artifact_identity_lint.py
  linear-traceability  he_linear_traceability_lint.py

Set AGENT_SKILLS_ROOT when the agent-skills checkout is not beside this repo.
USAGE
}

if [[ $# -lt 1 ]]; then
	usage
	exit 2
fi

validator="$1"
shift

agent_skills_root="${AGENT_SKILLS_ROOT:-}"
if [[ -z "$agent_skills_root" && -d "$REPO_ROOT/../agent-skills" ]]; then
	agent_skills_root="$(cd -- "$REPO_ROOT/../agent-skills" && pwd)"
fi
if [[ -z "$agent_skills_root" && -d "$HOME/dev/agent-skills" ]]; then
	agent_skills_root="$(cd -- "$HOME/dev/agent-skills" && pwd)"
fi

if [[ -z "$agent_skills_root" || ! -d "$agent_skills_root" ]]; then
	echo "Error: unable to resolve agent-skills checkout; set AGENT_SKILLS_ROOT." >&2
	exit 2
fi

case "$validator" in
	bluf)
		target="$agent_skills_root/Plugins/harness-engineering/scripts/check_bluf_structure.py"
		;;
	shape)
		target="$agent_skills_root/Plugins/harness-engineering/scripts/check_generated_artifact_shape.py"
		;;
	artifact-identity)
		target="$agent_skills_root/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py"
		;;
	linear-traceability)
		target="$agent_skills_root/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py"
		;;
	*)
		usage
		exit 2
		;;
esac

if [[ ! -f "$target" ]]; then
	echo "Error: validator not found: $target" >&2
	exit 2
fi

exec python3 "$target" "$@"
