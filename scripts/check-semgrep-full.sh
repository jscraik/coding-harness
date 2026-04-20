#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
RULESET_PATH="$REPO_ROOT/scripts/semgrep-pre-push.yml"
SEMGREP_VERSION="1.153.1"
DEFAULT_SEMGREP_STATE_ROOT="$REPO_ROOT/.git/semgrep"
if git_semgrep_state_root="$(git -C "$REPO_ROOT" rev-parse --git-path semgrep 2>/dev/null)"; then
	if [[ "$git_semgrep_state_root" != /* ]]; then
		git_semgrep_state_root="$REPO_ROOT/$git_semgrep_state_root"
	fi
	DEFAULT_SEMGREP_STATE_ROOT="$git_semgrep_state_root"
fi
SEMGREP_STATE_ROOT="${SEMGREP_STATE_ROOT:-$DEFAULT_SEMGREP_STATE_ROOT}"
HOST_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
SEMGREP_RUNTIME_CACHE_ROOT="${SEMGREP_RUNTIME_CACHE_ROOT:-$SEMGREP_STATE_ROOT/cache}"
SEMGREP_RUNTIME_USER_HOME="${SEMGREP_USER_HOME:-$SEMGREP_STATE_ROOT/home}"
SEMGREP_RUNTIME_LOG_FILE="${SEMGREP_LOG_FILE:-$SEMGREP_STATE_ROOT/semgrep.log}"
if [[ -z "${SSL_CERT_FILE:-}" ]]; then
	for cert_path in /etc/ssl/cert.pem /etc/ssl/certs/ca-certificates.crt; do
		if [[ -f "$cert_path" ]]; then
			export SSL_CERT_FILE="$cert_path"
			break
		fi
	done
fi

SEMGREP_CACHE_ROOT="${SEMGREP_CACHE_ROOT:-$SEMGREP_STATE_ROOT/tool-cache}"
SEMGREP_VENV_DIR="${SEMGREP_CACHE_ROOT}/semgrep-venv-${SEMGREP_VERSION}"
SEMGREP_BIN="$SEMGREP_VENV_DIR/bin/semgrep"
SEMGREP_PYTHON="$SEMGREP_VENV_DIR/bin/python"
cd "$REPO_ROOT"

run_semgrep() {
	XDG_CACHE_HOME="$SEMGREP_RUNTIME_CACHE_ROOT" \
		SEMGREP_USER_HOME="$SEMGREP_RUNTIME_USER_HOME" \
		SEMGREP_LOG_FILE="$SEMGREP_RUNTIME_LOG_FILE" \
		"$SEMGREP_BIN" "$@"
}

install_semgrep() {
	mkdir -p "$SEMGREP_STATE_ROOT" "$SEMGREP_RUNTIME_CACHE_ROOT" "$SEMGREP_RUNTIME_USER_HOME"
	mkdir -p "$(dirname "$SEMGREP_RUNTIME_LOG_FILE")"
	mkdir -p "$SEMGREP_CACHE_ROOT"
	local legacy_venv_dir="$HOST_CACHE_HOME/coding-harness/semgrep-venv-${SEMGREP_VERSION}"
	if [[ -d "$legacy_venv_dir" ]]; then
		rm -rf "$SEMGREP_VENV_DIR"
		cp -R "$legacy_venv_dir" "$SEMGREP_VENV_DIR"
		if [[ -x "$SEMGREP_BIN" ]]; then
			return
		fi
	fi
	python3 -m venv "$SEMGREP_VENV_DIR"
	"$SEMGREP_PYTHON" -m pip install --quiet --upgrade pip "semgrep==$SEMGREP_VERSION"
}

ensure_semgrep_version() {
	if [[ ! -x "$SEMGREP_BIN" ]]; then
		install_semgrep
		return
	fi

	local detected_version
	detected_version="$(run_semgrep --version 2>/dev/null | tr -d '[:space:]')"
	if [[ "$detected_version" != "$SEMGREP_VERSION" ]]; then
		install_semgrep
	fi
}

if [[ ! -f "$RULESET_PATH" ]]; then
	echo "Error: missing Semgrep ruleset at $RULESET_PATH"
	exit 1
fi

ensure_semgrep_version

run_semgrep scan \
	--config "$RULESET_PATH" \
	--disable-version-check \
	--error \
	--jobs 1 \
	.
