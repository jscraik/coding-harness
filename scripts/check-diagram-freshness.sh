#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CHANGED_FILES_PATH=""

TRACKED_ARTIFACT_PATHS=(
	".diagram"
	"AI/context/diagram-context.md"
	".diagram/context/diagram-context.meta.json"
)

usage() {
	cat <<'USAGE'
Usage: scripts/check-diagram-freshness.sh [--changed-files PATH]

Refreshes architecture diagrams when architecture-sensitive files changed.

Options:
  --changed-files PATH  Read the changed-file list from PATH instead of deriving
                        branch, unstaged, and staged changes from git.
  -h, --help            Show this help text.
USAGE
}

while (( $# > 0 )); do
	case "$1" in
		--changed-files)
			CHANGED_FILES_PATH="${2:-}"
			if [[ -z "$CHANGED_FILES_PATH" ]]; then
				echo "Error: --changed-files requires a path" >&2
				exit 2
			fi
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Error: unknown argument: $1" >&2
			usage >&2
			exit 2
			;;
	esac
done

is_ignored_change() {
	local changed_path="$1"

	case "$changed_path" in
		src/*.test.ts|src/*.spec.ts|src/*.test.js|src/*.spec.js)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

is_architecture_sensitive_change() {
	local changed_path="$1"

	case "$changed_path" in
		package.json|tsconfig.json|.diagramrc|scripts/refresh-diagram-context.sh|scripts/check-diagram-freshness.sh|scripts/lib/normalize-mermaid-artifact.cjs)
			return 0
			;;
		src/*)
			if is_ignored_change "$changed_path"; then
				return 1
			fi
			return 0
			;;
		*)
			return 1
			;;
	esac
}

snapshot_artifacts() {
	local rel_path
	while IFS= read -r rel_path; do
		[[ -n "$rel_path" ]] || continue
		local abs_path="$REPO_ROOT/$rel_path"
		[[ -f "$abs_path" ]] || continue
		local checksum
		checksum="$(normalized_checksum "$abs_path" "$rel_path")"
		printf '%s %s\n' "$rel_path" "$checksum"
	done < <(tracked_artifact_files)
}

tracked_artifact_files() {
	local artifact_path
	for artifact_path in "${TRACKED_ARTIFACT_PATHS[@]}"; do
		git -C "$REPO_ROOT" ls-files -- "$artifact_path"
	done | awk 'NF { print }' | sort -u
}

normalized_checksum() {
	local file="$1"
	local rel_path="$2"

	case "$rel_path" in
		*.mmd)
			# Mermaid generators can emit volatile node identifiers. Compare
			# generated diagram artifacts by normalized graph content while
			# preserving block membership so topology changes still fail freshness.
			node - "$file" "$REPO_ROOT" <<'NODE' | shasum -a 256 | awk '{print $1}'
const fs = require("node:fs");
const path = require("node:path");
const { normalizeMermaidLines } = require(path.join(
	process.argv[3],
	"scripts/lib/normalize-mermaid-artifact.cjs",
));

const filePath = process.argv[2];
const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
process.stdout.write(normalizeMermaidLines(lines));
NODE
			;;
		*/diagram-context.md)
			# Normalize volatile Mermaid node identifiers while preserving block
			# membership and edge/label text so topology changes are still detected.
			node - "$file" "$REPO_ROOT" <<'NODE' | shasum -a 256 | awk '{print $1}'
const fs = require("node:fs");
const path = require("node:path");
const { normalizeDiagramContextLines } = require(path.join(
	process.argv[3],
	"scripts/lib/normalize-mermaid-artifact.cjs",
));

const filePath = process.argv[2];
const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
process.stdout.write(normalizeDiagramContextLines(lines));
NODE
			;;
		*/diagram-context.meta.json)
			jq -c 'del(.generated_at, .generatedAt, .last_generated_epoch, .min_interval_seconds, .changed, .context_sha256, .git_head)' "$file" | shasum -a 256 | awk '{print $1}'
			;;
		*/manifest.json)
			jq -c 'del(.generatedAt) | (.diagrams // []) |= map(del(.lines, .bytes))' "$file" | shasum -a 256 | awk '{print $1}'
			;;
		*)
			shasum -a 256 "$file" | awk '{print $1}'
			;;
	esac
}

resolve_diff_base() {
	if git -C "$REPO_ROOT" rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
		git -C "$REPO_ROOT" merge-base HEAD '@{upstream}'
		return 0
	fi

	if git -C "$REPO_ROOT" rev-parse --verify main >/dev/null 2>&1; then
		git -C "$REPO_ROOT" merge-base HEAD main
		return 0
	fi

	if git -C "$REPO_ROOT" rev-parse --verify HEAD^ >/dev/null 2>&1; then
		git -C "$REPO_ROOT" rev-parse HEAD^
		return 0
	fi

	return 1
}

collect_changed_paths() {
	if [[ -n "$CHANGED_FILES_PATH" ]]; then
		if [[ ! -f "$CHANGED_FILES_PATH" ]]; then
			echo "Error: changed-files path not found: $CHANGED_FILES_PATH" >&2
			return 2
		fi
		awk 'NF { print }' "$CHANGED_FILES_PATH" | sort -u
		return 0
	fi

	local base
	if base="$(resolve_diff_base)"; then
		{
			git -C "$REPO_ROOT" diff --name-only "$base...HEAD"
			git -C "$REPO_ROOT" diff --name-only
			git -C "$REPO_ROOT" diff --cached --name-only
		} | awk 'NF { print }' | sort -u
	else
		{
			git -C "$REPO_ROOT" diff --name-only
			git -C "$REPO_ROOT" diff --cached --name-only
		} | awk 'NF { print }' | sort -u
	fi
}

changed_paths_tmp="$(mktemp)"
trap 'rm -f "$changed_paths_tmp"' EXIT
if collect_changed_paths > "$changed_paths_tmp"; then
	:
else
	status=$?
	exit "$status"
fi

should_refresh=0
while IFS= read -r changed_path; do
	[[ -n "$changed_path" ]] || continue
	if is_architecture_sensitive_change "$changed_path"; then
		should_refresh=1
		break
	fi
done < "$changed_paths_tmp"

if [[ "$should_refresh" -ne 1 ]]; then
	echo "Diagram freshness check skipped: no architecture-sensitive implementation paths changed."
	exit 0
fi

tracked_files=()
while IFS= read -r tracked_file; do
	[[ -n "$tracked_file" ]] || continue
	tracked_files+=("$tracked_file")
done < <(tracked_artifact_files)
preexisting_worktree_artifact_edits=()
if (( ${#tracked_files[@]} > 0 )); then
	for tracked_file in "${tracked_files[@]}"; do
		if ! git -C "$REPO_ROOT" diff --quiet -- "$tracked_file"; then
			preexisting_worktree_artifact_edits+=("$tracked_file")
		fi
	done
fi

echo "Refreshing architecture diagrams for changed sensitive paths..."
before_snapshot="$(snapshot_artifacts)"
bash "$REPO_ROOT/scripts/refresh-diagram-context.sh" --force --quiet
after_snapshot="$(snapshot_artifacts)"

if [[ "$before_snapshot" != "$after_snapshot" ]]; then
	echo "Error: architecture diagram artifacts are stale after refresh."
	echo "Changed tracked files:"
	git -C "$REPO_ROOT" diff --name-only -- "${TRACKED_ARTIFACT_PATHS[@]}"
	echo "Fix: run 'bash scripts/refresh-diagram-context.sh --force' and commit the updated artifacts."
	exit 1
fi

# Refresh can rewrite tracked artifacts even when semantic checksums are equivalent.
# Restore only files that were clean before refresh so local edits are preserved.
files_to_restore=()
if (( ${#tracked_files[@]} > 0 )); then
	for tracked_file in "${tracked_files[@]}"; do
		had_preexisting_worktree_edit=0
		for preexisting_file in "${preexisting_worktree_artifact_edits[@]-}"; do
			if [[ "$preexisting_file" == "$tracked_file" ]]; then
				had_preexisting_worktree_edit=1
				break
			fi
		done
		if (( had_preexisting_worktree_edit == 1 )); then
			continue
		fi
		if ! git -C "$REPO_ROOT" diff --quiet -- "$tracked_file"; then
			files_to_restore+=("$tracked_file")
		fi
	done
fi

if (( ${#files_to_restore[@]} > 0 )); then
	git -C "$REPO_ROOT" restore --worktree -- "${files_to_restore[@]}" >/dev/null 2>&1 || true
fi

echo "Diagram freshness check passed."
