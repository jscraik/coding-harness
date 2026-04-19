#!/usr/bin/env bash
set -euo pipefail

# usage prints the script's usage/help text describing available options (`--repo`, `--format`, `--include-cleanup`, `-h|--help`) and their defaults.
usage() {
	cat <<'USAGE'
Usage: .agents/skills/using-git-worktrees/scripts/worktree-report.sh [options]

Inventory and sort git worktree state for a repository.

Options:
  --repo <path>          Repository path (default: .)
  --format <value>       Output format: markdown|json (default: markdown)
  --include-cleanup      Append cleanup suggestions after the report
  -h, --help             Show this help text
USAGE
}

repo_path="."
format="markdown"
include_cleanup=0

while (( $# > 0 )); do
	case "$1" in
		--repo)
			if [[ $# -lt 2 || -z "${2:-}" ]]; then
				echo "[worktree-report] --repo requires a value" >&2
				usage >&2
				exit 2
			fi
			repo_path="$2"
			shift 2
			;;
		--format)
			if [[ $# -lt 2 || -z "${2:-}" ]]; then
				echo "[worktree-report] --format requires a value" >&2
				usage >&2
				exit 2
			fi
			format="$2"
			shift 2
			;;
		--include-cleanup)
			include_cleanup=1
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "[worktree-report] unknown argument: $1" >&2
			usage >&2
			exit 2
			;;
	esac
done

if [[ "$format" != "markdown" && "$format" != "json" ]]; then
	echo "[worktree-report] unsupported format: $format" >&2
	exit 2
fi

repo_root="$(cd -- "$repo_path" && git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$repo_root" ]]; then
	echo "[worktree-report] not a git repository: $repo_path" >&2
	exit 1
fi

if [[ "$format" == "json" ]] && ! command -v jq >/dev/null 2>&1; then
	echo "[worktree-report] jq is required for --format json" >&2
	exit 1
fi

porcelain="$(git -C "$repo_root" worktree list --porcelain)"
current_worktree="$(git -C "$repo_root" rev-parse --show-toplevel)"
sep=$'\x1f'

rows_file="$(mktemp)"
dup_file="$(mktemp)"
cleanup_file="$(mktemp)"
trap 'rm -f "$rows_file" "$dup_file" "$cleanup_file"' EXIT

path=""
head=""
branch_ref=""
detached="no"
locked_reason=""
prunable_reason=""

# emit_row writes the currently-accumulated worktree fields as a single separator-delimited line to the rows_file, or does nothing if path is empty.
# The emitted fields (in order) are: path, branch, head, detached, locked_reason, prunable_reason, dirty, is_current.
# - branch is the short branch name or "(detached)".
# - dirty is one of "clean", "dirty", "missing", or "n/a" (when prunable_reason is present).
# - is_current is "yes" when the row's path equals the current_worktree, otherwise "no".
# Fields are joined with the separator stored in $sep and appended to $rows_file.
emit_row() {
	if [[ -z "$path" ]]; then
		return
	fi

	branch="(detached)"
	if [[ -n "$branch_ref" ]]; then
		branch="${branch_ref#refs/heads/}"
	fi

	dirty="unknown"
	if [[ -n "$prunable_reason" ]]; then
		dirty="n/a"
	elif git -C "$path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		status_out="$(git -C "$path" status --porcelain 2>/dev/null || true)"
		if [[ -n "$status_out" ]]; then
			dirty="dirty"
		else
			dirty="clean"
		fi
	else
		dirty="missing"
	fi

	is_current="no"
	if [[ "$path" == "$current_worktree" ]]; then
		is_current="yes"
	fi

	printf '%s%s%s%s%s%s%s%s%s%s%s%s%s%s%s\n' \
		"$path" \
		"$sep" \
		"$branch" \
		"$sep" \
		"$head" \
		"$sep" \
		"$detached" \
		"$sep" \
		"$locked_reason" \
		"$sep" \
		"$prunable_reason" \
		"$sep" \
		"$dirty" \
		"$sep" \
		"$is_current" >> "$rows_file"
}

while IFS= read -r line || [[ -n "$line" ]]; do
	if [[ -z "$line" ]]; then
		emit_row
		path=""
		head=""
		branch_ref=""
		detached="no"
		locked_reason=""
		prunable_reason=""
		continue
	fi

	case "$line" in
		worktree\ *)
			path="${line#worktree }"
			;;
		HEAD\ *)
			head="${line#HEAD }"
			;;
		branch\ *)
			branch_ref="${line#branch }"
			;;
		detached)
			detached="yes"
			branch_ref=""
			;;
		locked*)
			locked_reason="${line#locked}"
			locked_reason="${locked_reason# }"
			;;
		prunable*)
			prunable_reason="${line#prunable}"
			prunable_reason="${prunable_reason# }"
			;;
	esac
done <<< "$porcelain"

emit_row

if [[ ! -s "$rows_file" ]]; then
	echo "[worktree-report] no worktrees found"
	exit 0
fi

sort -t "$sep" -k2,2 -k1,1 "$rows_file" -o "$rows_file"

awk -F "$sep" '$2 != "(detached)" {count[$2]++} END {for (b in count) if (count[b] > 1) print b}' "$rows_file" | sort > "$dup_file"

# generate_cleanup_suggestions generates suggested cleanup actions for parsed worktrees and writes sorted, deduplicated suggestion lines to "$cleanup_file".
generate_cleanup_suggestions() {
	: > "$cleanup_file"
	while IFS="$sep" read -r row_path row_branch _ row_detached row_locked row_prunable row_dirty row_current; do
		if [[ -n "$row_prunable" ]]; then
			echo "- prune stale metadata: git -C '$repo_root' worktree prune" >> "$cleanup_file"
			continue
		fi

		if [[ "$row_detached" == "yes" && "$row_dirty" == "clean" && "$row_current" == "no" ]]; then
			echo "- detached clean worktree can be removed after review: git -C '$repo_root' worktree remove '$row_path'" >> "$cleanup_file"
		fi

		if [[ "$row_dirty" == "dirty" && "$row_current" == "no" ]]; then
			echo "- dirty worktree requires commit/stash before cleanup: '$row_path'" >> "$cleanup_file"
		fi

		if [[ "$row_current" == "no" && "$row_dirty" == "clean" && -z "$row_locked" && -z "$row_prunable" ]]; then
			echo "- clean inactive worktree candidate: git -C '$repo_root' worktree remove '$row_path'" >> "$cleanup_file"
		fi

		if [[ -n "$row_branch" && "$row_branch" != "(detached)" ]] && grep -Fxq "$row_branch" "$dup_file"; then
			echo "- branch appears in multiple worktrees ($row_branch); switch one side to detached or another branch" >> "$cleanup_file"
		fi
	done < "$rows_file"
	sort -u "$cleanup_file" -o "$cleanup_file"
}

if [[ "$include_cleanup" -eq 1 ]]; then
	generate_cleanup_suggestions
fi

if [[ "$format" == "json" ]]; then
	if [[ "$include_cleanup" -eq 1 ]]; then
		jq -n --rawfile rows "$rows_file" --rawfile suggestions "$cleanup_file" '
			{
				worktrees: (
					$rows
					| split("\n")
					| map(select(length > 0) | split("\u001f"))
					| map({
						path: .[0],
						branch: .[1],
						head: .[2],
						detached: (.[3] == "yes"),
						locked_reason: (if .[4] == "" then null else .[4] end),
						prunable_reason: (if .[5] == "" then null else .[5] end),
						dirty: .[6],
						current: (.[7] == "yes")
					})
				),
				cleanup_suggestions: (
					$suggestions
					| split("\n")
					| map(select(length > 0))
				)
			}
		'
	else
		jq -n --rawfile rows "$rows_file" '
			{
				worktrees: (
					$rows
					| split("\n")
					| map(select(length > 0) | split("\u001f"))
					| map({
						path: .[0],
						branch: .[1],
						head: .[2],
						detached: (.[3] == "yes"),
						locked_reason: (if .[4] == "" then null else .[4] end),
						prunable_reason: (if .[5] == "" then null else .[5] end),
						dirty: .[6],
						current: (.[7] == "yes")
					})
				)
			}
		'
	fi
else
	echo "# Worktree Report"
	echo
	echo "Repository: $repo_root"
	echo
	echo "| Path | Branch | HEAD | Detached | Dirty | Locked | Prunable | Current |"
	echo "|---|---|---|---|---|---|---|---|"

	while IFS="$sep" read -r row_path row_branch row_head row_detached row_locked row_prunable row_dirty row_current; do
		locked_cell="${row_locked:-no}"
		prunable_cell="${row_prunable:-no}"

		printf "| \`%s\` | \`%s\` | \`%s\` | \`%s\` | \`%s\` | %s | %s | \`%s\` |\n" \
			"$row_path" \
			"$row_branch" \
			"$row_head" \
			"$row_detached" \
			"$row_dirty" \
			"${locked_cell//|/\\|}" \
			"${prunable_cell//|/\\|}" \
			"$row_current"
	done < "$rows_file"

	if [[ "$include_cleanup" -eq 1 ]]; then
		echo
		echo "## Cleanup Suggestions"
		if [[ -s "$cleanup_file" ]]; then
			cat "$cleanup_file"
		else
			echo "- no immediate cleanup actions detected"
		fi
	fi
fi