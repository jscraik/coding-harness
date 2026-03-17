#!/usr/bin/env bash

# Source this file from ~/.zshrc or ~/.bashrc to expose:
# - preflight_repo/preflight_js/preflight_py/preflight_rust/preflight_repo_local_memory
#   (provided by scripts/codex-preflight.sh)
# - codex_d / cdxd convenience launchers for profile "d"

_codex_helpers_resolve_source() {
	if [[ -n "${BASH_VERSION:-}" ]]; then
		printf '%s' "${BASH_SOURCE[0]}"
		return 0
	fi

	if [[ -n "${ZSH_VERSION:-}" ]]; then
		eval 'printf "%s" "${(%):-%x}"'
		return 0
	fi

	return 1
}

_codex_helpers_script_dir() {
	local source_path
	source_path="$(_codex_helpers_resolve_source)" || return 1
	cd "$(dirname -- "${source_path}")" && pwd -P
}

_codex_helpers_repo_root() {
	local script_dir
	script_dir="$(_codex_helpers_script_dir)" || return 1
	cd "${script_dir}/.." && pwd -P
}

_codex_helpers_preflight_script() {
	local repo_root
	repo_root="$(_codex_helpers_repo_root)" || return 1
	printf '%s/scripts/codex-preflight.sh\n' "${repo_root}"
}

_codex_helpers_default_prompt() {
	printf '%s' "Read AGENTS.md, run source scripts/codex-preflight.sh && preflight_repo, then summarize the repo structure and any blockers."
}

_codex_helpers_load_preflight() {
	local preflight_script
	preflight_script="$(_codex_helpers_preflight_script)" || return 1
	if [[ ! -f "${preflight_script}" ]]; then
		echo "Warning: codex-preflight helper not found at ${preflight_script}" >&2
		return 1
	fi

	# shellcheck source=/dev/null
	source "${preflight_script}"
}

_codex_helpers_load_preflight || true

codex_d() {
	local repo_root prompt
	repo_root="$(_codex_helpers_repo_root)" || return 1

	if [[ $# -gt 0 ]]; then
		prompt="$*"
	else
		prompt="$(_codex_helpers_default_prompt)"
	fi

	command codex --profile d --cd "${repo_root}" "${prompt}"
}

cdxd() {
	codex_d "$@"
}

if [[ -n "${BASH_VERSION:-}" ]] && [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	cat <<'EOF'
This file is intended to be sourced from your shell profile.

Example:
  source /absolute/path/to/scripts/codex-shell-helpers.sh

Then use:
  preflight_repo
  preflight_js
  preflight_py
  preflight_rust
  preflight_repo_local_memory
  codex_d
  cdxd
EOF
fi
