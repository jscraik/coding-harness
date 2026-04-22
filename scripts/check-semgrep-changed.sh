#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
RULESET_PATH="$REPO_ROOT/scripts/semgrep-pre-push.yml"
SEMGREP_VERSION="1.153.1"
SCAN_MODE="changed"

while (( $# > 0 )); do
	case "$1" in
		--all)
			SCAN_MODE="all"
			shift
			;;
		--changed)
			SCAN_MODE="changed"
			shift
			;;
		-h|--help)
			echo "Usage: bash scripts/check-semgrep-changed.sh [--changed|--all]" >&2
			exit 0
			;;
		*)
			echo "Error: unknown option '$1'" >&2
			echo "Usage: bash scripts/check-semgrep-changed.sh [--changed|--all]" >&2
			exit 2
			;;
	esac
done

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

run_semgrep_batched() {
	local batch_size="${1:-200}"
	shift || true
	local input_files=("$@")
	local total_files="${#input_files[@]}"
	if [[ "$total_files" -eq 0 ]]; then
		return 0
	fi

	local start_index=0
	local batches=0
	while (( start_index < total_files )); do
		local batch=("${input_files[@]:start_index:batch_size}")
		run_semgrep scan \
			--config "$RULESET_PATH" \
			--disable-version-check \
			--error \
			--jobs 1 \
			"${batch[@]}"
		start_index=$((start_index + batch_size))
		batches=$((batches + 1))
	done

	echo "Semgrep scanned ${total_files} files in ${batches} batch(es)."
}

install_semgrep() {
	mkdir -p "$SEMGREP_STATE_ROOT" "$SEMGREP_RUNTIME_CACHE_ROOT" "$SEMGREP_RUNTIME_USER_HOME"
	mkdir -p "$(dirname "$SEMGREP_RUNTIME_LOG_FILE")"
	mkdir -p "$SEMGREP_CACHE_ROOT"
	ensure_python_packaging
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

ensure_python_packaging() {
	if command -v python3 >/dev/null 2>&1 && \
		python3 -m venv --help >/dev/null 2>&1 && \
		python3 -m pip --version >/dev/null 2>&1; then
		return
	fi

	if ! command -v apt-get >/dev/null 2>&1; then
		echo "Error: python3 venv/pip are unavailable and apt-get is not present." >&2
		exit 1
	fi

	local elevate=()
	if command -v sudo >/dev/null 2>&1; then
		elevate=(sudo)
	fi

	"${elevate[@]}" apt-get update
	"${elevate[@]}" apt-get install -y python3 python3-venv python3-pip
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

if [[ "$SCAN_MODE" == "all" ]]; then
	all_sources=()
	while IFS= read -r -d "" path; do
		[[ -n "$path" ]] || continue
		if [[ "$path" =~ ^src/.*\.(ts|tsx|js|jsx|mts|cts)$ ]] && \
			[[ ! "$path" =~ \.d\.ts$ ]] && \
			[[ ! "$path" =~ \.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$ ]]; then
			all_sources+=("$path")
		fi
	done < <(cd "$REPO_ROOT" && find src -type f -print0 2>/dev/null || true)

	if [[ ${#all_sources[@]} -eq 0 ]]; then
		echo "No src/** implementation files detected for Semgrep."
		exit 0
	fi

	run_semgrep_batched 200 "${all_sources[@]}"
	exit 0
fi

base_ref=""
if git rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
	base_ref="$(git merge-base HEAD '@{upstream}')"
else
	for candidate in origin/main origin/master main master; do
		if git rev-parse --verify "$candidate" >/dev/null 2>&1; then
			base_ref="$(git merge-base HEAD "$candidate")"
			break
		fi
	done
fi

if [[ -z "$base_ref" ]]; then
	if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
		base_ref="HEAD^"
	else
		echo "No comparison base available for Semgrep changed-file scan."
		exit 0
	fi
fi

changed_sources=()
while IFS= read -r -d "" path; do
	[[ -n "$path" ]] || continue
	if [[ "$path" =~ ^src/.*\.(ts|tsx|js|jsx|mts|cts)$ ]] && \
		[[ ! "$path" =~ \.d\.ts$ ]] && \
		[[ ! "$path" =~ \.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$ ]]; then
		changed_sources+=("$path")
	fi
done < <(git diff --name-only --diff-filter=ACMR -z "$base_ref"...HEAD --)

if [[ ${#changed_sources[@]} -eq 0 ]]; then
	echo "No changed src/** implementation files detected for Semgrep."
	exit 0
fi

run_semgrep_batched 200 "${changed_sources[@]}"
