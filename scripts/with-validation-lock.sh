#!/usr/bin/env bash
set -euo pipefail

usage() {
	echo "Usage: bash scripts/with-validation-lock.sh <lock-name> -- <command> [args...]" >&2
}

if [[ $# -lt 3 || "$2" != "--" ]]; then
	usage
	exit 2
fi

lock_name="$1"
shift 2

case "$lock_name" in
	*[!a-zA-Z0-9_.-]* | "")
		echo "[validation-lock] invalid lock name: $lock_name" >&2
		exit 2
		;;
esac

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
lock_root="${HARNESS_VALIDATION_LOCK_ROOT:-$repo_root/.cache/validation-locks}"
lock_dir="$lock_root/$lock_name.lock"
metadata_path="$lock_dir/metadata.env"

mkdir -p "$lock_root"

write_metadata() {
	{
		printf 'pid=%s\n' "$$"
		printf 'repo_root=%q\n' "$repo_root"
		printf 'lock_name=%q\n' "$lock_name"
		printf 'started_at=%q\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
		printf 'command=%q\n' "$*"
	} >"$metadata_path"
}

if mkdir "$lock_dir" 2>/dev/null; then
	write_metadata "$@"
else
	owner_pid=""
	if [[ -f "$metadata_path" ]]; then
		owner_pid="$(sed -n 's/^pid=//p' "$metadata_path" | head -n 1)"
	fi
	if [[ "$owner_pid" =~ ^[0-9]+$ ]] && kill -0 "$owner_pid" 2>/dev/null; then
		echo "[validation-lock] active $lock_name validation already running for this repository (pid $owner_pid)." >&2
		echo "[validation-lock] Wait for it to finish or stop the stale validation process before starting another $lock_name lane." >&2
		exit 1
	fi
	echo "[validation-lock] removing stale $lock_name validation lock." >&2
	rm -rf "$lock_dir"
	if ! mkdir "$lock_dir" 2>/dev/null; then
		echo "[validation-lock] failed to acquire $lock_name validation lock after stale cleanup." >&2
		exit 1
	fi
	write_metadata "$@"
fi

cleanup() {
	rm -rf "$lock_dir"
}
trap cleanup EXIT INT TERM

"$@"
