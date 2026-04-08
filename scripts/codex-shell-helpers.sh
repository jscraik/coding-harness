#!/usr/bin/env bash
# Source this file from bash or zsh to get compatibility helpers for the
# cleaned ./scripts/codex-preflight.sh interface.
#
# Example:
#   source ~/dev/config/codex/codex-shell-helpers.sh
#   preflight_js
#   preflight_py my-repo-fragment
#   codex_d "inspect the flaky test"

_codex_git_root() {
  command git rev-parse --show-toplevel 2>/dev/null
}

_codex_preflight_script() {
  local root
  root="$(_codex_git_root)" || {
    printf 'not inside a git repo\n' >&2
    return 1
  }

  local candidate
  for candidate in \
    "$root/scripts/codex-preflight.sh" \
    "$root/codex-preflight.sh"
  do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  printf 'could not find codex-preflight.sh under %s\n' "$root" >&2
  return 1
}

_codex_run_preflight() {
  local stack="$1"
  local expected_repo="${2:-}"
  local bins_csv="${3:-}"
  local paths_csv="${4:-}"
  local mode="${5:-required}"

  local script
  script="$(_codex_preflight_script)" || return 1

  local -a args
  args=(--stack "$stack" --mode "$mode")

  if [[ -n "$expected_repo" ]]; then
    args+=(--repo-fragment "$expected_repo")
  fi
  if [[ -n "$bins_csv" ]]; then
    args+=(--bins "$bins_csv")
  fi
  if [[ -n "$paths_csv" ]]; then
    args+=(--paths "$paths_csv")
  fi

  command bash "$script" "${args[@]}"
}

# Old-style compatibility entrypoints.
preflight_repo() {
  _codex_run_preflight \
    repo \
    "${1:-}" \
    "${2:-git,bash,sed,rg,fd,jq,curl,python3}" \
    "${3:-AGENTS.md,docs,docs/plans}" \
    "${4:-required}"
}

preflight_js() {
  _codex_run_preflight \
    js \
    "${1:-}" \
    "${2:-git,bash,sed,rg,fd,jq,curl,node,npm,python3}" \
    "${3:-AGENTS.md,package.json,docs,docs/plans}" \
    "${4:-required}"
}

preflight_py() {
  _codex_run_preflight \
    py \
    "${1:-}" \
    "${2:-git,bash,sed,rg,fd,jq,curl,python3}" \
    "${3:-AGENTS.md,pyproject.toml,docs,docs/plans}" \
    "${4:-required}"
}

preflight_rust() {
  _codex_run_preflight \
    rust \
    "${1:-}" \
    "${2:-git,bash,sed,rg,fd,jq,curl,python3,cargo}" \
    "${3:-AGENTS.md,Cargo.toml,docs,docs/plans}" \
    "${4:-required}"
}

preflight_repo_local_memory() {
  _codex_run_preflight \
    repo \
    "${1:-}" \
    "${2:-git,bash,sed,rg,fd,jq,curl,python3}" \
    "${3:-AGENTS.md,docs,docs/plans}" \
    required
}

# Launch Codex with profile d, anchored at the repo root, with a default startup
# prompt that forces orientation and preflight.
codex_d() {
  local root
  root="$(_codex_git_root)" || return 1

  local default_prompt
  default_prompt='Read AGENTS.md, run bash scripts/codex-preflight.sh --stack auto --mode required, then summarize the repo structure and any blockers before making changes.'

  local prompt="$default_prompt"
  if [[ $# -gt 0 ]]; then
    prompt+=" After that, continue with this task: $*"
  fi

  command codex --profile d --cd "$root" "$prompt"
}

# Short alias-like helper as a function.
cdxd() {
  codex_d "$@"
}
