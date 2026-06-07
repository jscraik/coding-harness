#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
lock_root="${HARNESS_VALIDATION_LOCK_ROOT:-$repo_root/.cache/validation-locks}"

if [[ ! -d "$lock_root" ]]; then
	echo "[validation-lock] no active validation locks."
	exit 0
fi

status=0
shopt -s nullglob
for lock_dir in "$lock_root"/*.lock; do
	metadata_path="$lock_dir/metadata.env"
	lock_name="$(basename "$lock_dir" .lock)"
	owner_pid=""
	if [[ -f "$metadata_path" ]]; then
		owner_pid="$(sed -n 's/^pid=//p' "$metadata_path" | head -n 1)"
	fi
	if [[ "$owner_pid" =~ ^[0-9]+$ ]] && kill -0 "$owner_pid" 2>/dev/null; then
		echo "[validation-lock] active $lock_name validation already running for this repository (pid $owner_pid)." >&2
		status=1
		continue
	fi
	echo "[validation-lock] removing stale $lock_name validation lock."
	rm -rf "$lock_dir"
done

if [[ "$status" -ne 0 ]]; then
	echo "[validation-lock] stop or wait for active validation lanes before running another pre-push/CI-equivalent gate." >&2
	exit "$status"
fi

echo "[validation-lock] no active validation locks."
