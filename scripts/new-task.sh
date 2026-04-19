#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

detect_node_pm() {
	local repo_path="$1"
	if [[ -f "$repo_path/pnpm-lock.yaml" ]]; then
		echo "pnpm"
		return
	fi
	if [[ -f "$repo_path/package-lock.json" ]]; then
		echo "npm"
		return
	fi
	if [[ -f "$repo_path/yarn.lock" ]]; then
		echo "yarn"
		return
	fi
	if [[ -f "$repo_path/bun.lock" || -f "$repo_path/bun.lockb" ]]; then
		echo "bun"
		return
	fi
	echo "npm"
}

infer_app_script() {
	local repo_path="$1"
	local package_json="$repo_path/package.json"
	if [[ ! -f "$package_json" ]]; then
		return 1
	fi
	if rg -q '"dev"[[:space:]]*:' "$package_json"; then
		echo "dev"
		return 0
	fi
	if rg -q '"start"[[:space:]]*:' "$package_json"; then
		echo "start"
		return 0
	fi
	return 1
}

node_run_cmd() {
	local pm="$1"
	local script_name="$2"
	case "$pm" in
		pnpm) echo "pnpm run $script_name" ;;
		npm) echo "npm run $script_name" ;;
		yarn) echo "yarn $script_name" ;;
		bun) echo "bun run $script_name" ;;
		*) echo "npm run $script_name" ;;
	esac
}

usage() {
	cat <<'USAGE'
Usage: scripts/new-task.sh [options] <slug>

Create a dedicated git worktree (and optional branch) for one task, then print the
bootstrap commands to run inside that worktree.

This repository expects one task = one worktree = one agent thread.

Options:
  --base <ref>            Start the branch from this ref (default: main)
  --branch-prefix <name>  Branch prefix (default: codex)
  --detached              Create the worktree in detached HEAD mode
  --path <dir>            Worktree path (default: ../wt-<slug>)
  --run-cmd <command>     Override app run command hint (for nonstandard repos)
  --no-portless           Print direct run command hint instead of portless wrapper
  --bootstrap             Run bootstrap command in the new worktree immediately
  --json                  Emit machine-readable summary JSON on stdout
  -h, --help              Show this help text
USAGE
}

base_ref="main"
branch_prefix="codex"
detached_mode=0
worktree_path=""
run_cmd_override=""
use_portless=1
auto_bootstrap=0
output_json=0
slug=""

while (( $# > 0 )); do
	case "$1" in
		--base)
			base_ref="${2:-}"
			shift 2
			;;
		--branch-prefix)
			branch_prefix="${2:-}"
			shift 2
			;;
		--detached)
			detached_mode=1
			shift
			;;
		--path)
			worktree_path="${2:-}"
			shift 2
			;;
		--run-cmd)
			run_cmd_override="${2:-}"
			shift 2
			;;
		--no-portless)
			use_portless=0
			shift
			;;
		--bootstrap)
			auto_bootstrap=1
			shift
			;;
		--json)
			output_json=1
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		--)
			shift
			break
			;;
		-*)
			echo "[new-task] unknown option: $1" >&2
			usage >&2
			exit 2
			;;
		*)
			slug="$1"
			shift
			break
			;;
	esac
done

if [[ -z "$slug" && $# -gt 0 ]]; then
	slug="$1"
	shift
fi

if [[ -z "$slug" || $# -gt 0 ]]; then
	usage >&2
	exit 2
fi

if [[ ! "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
	echo "[new-task] slug must be lower-case kebab-case: $slug" >&2
	exit 2
fi

if [[ ! "$branch_prefix" =~ ^[A-Za-z0-9._/-]+$ ]]; then
	echo "[new-task] invalid branch prefix: $branch_prefix" >&2
	exit 2
fi

if [[ -n "$run_cmd_override" && "$run_cmd_override" =~ ^[[:space:]]*$ ]]; then
	echo "[new-task] --run-cmd requires a non-empty command" >&2
	exit 2
fi

if [[ "$output_json" -eq 1 ]]; then
	if ! command -v jq >/dev/null 2>&1; then
		echo "[new-task] --json requires jq on PATH" >&2
		exit 1
	fi
	# Keep human-oriented logs visible on stderr while reserving stdout for JSON.
	exec 3>&1
	exec 1>&2
fi

branch_name="${branch_prefix}/${slug}"
resolved_base_ref="$base_ref"
remote_base_branch=""

if [[ "$base_ref" == origin/* ]]; then
	remote_base_branch="${base_ref#origin/}"
elif [[ "$base_ref" != *"/"* ]]; then
	remote_base_branch="$base_ref"
fi

if [[ -z "$worktree_path" ]]; then
	worktree_path="${REPO_ROOT}/../wt-${slug}"
fi

cd "$REPO_ROOT"

git rev-parse --show-toplevel >/dev/null

if [[ "$detached_mode" -eq 0 ]] && git show-ref --verify --quiet "refs/heads/${branch_name}"; then
	echo "[new-task] local branch already exists: ${branch_name}" >&2
	exit 1
fi

if [[ -e "$worktree_path" ]]; then
	echo "[new-task] worktree path already exists: $worktree_path" >&2
	exit 1
fi

if [[ -n "$remote_base_branch" ]]; then
	echo "[new-task] fetching latest origin/$remote_base_branch"
	git fetch --prune origin "$remote_base_branch"
	if git show-ref --verify --quiet "refs/remotes/origin/$remote_base_branch"; then
		resolved_base_ref="refs/remotes/origin/$remote_base_branch"
	fi
fi

if ! git rev-parse --verify --quiet "${resolved_base_ref}^{commit}" >/dev/null; then
	echo "[new-task] base ref is not a valid commit: $base_ref" >&2
	exit 2
fi

echo "[new-task] repo: $REPO_ROOT"
echo "[new-task] base: $base_ref"
if [[ "$resolved_base_ref" != "$base_ref" ]]; then
	echo "[new-task] resolved base: $resolved_base_ref"
fi
if [[ "$detached_mode" -eq 1 ]]; then
	echo "[new-task] mode: detached"
else
	echo "[new-task] mode: branch"
	echo "[new-task] branch: ${branch_name}"
fi
echo "[new-task] path: $worktree_path"

if [[ "$detached_mode" -eq 1 ]]; then
	git worktree add --detach "$worktree_path" "$resolved_base_ref"
else
	git worktree add "$worktree_path" -b "${branch_name}" "$resolved_base_ref"
fi

echo
echo "[new-task] next:"
echo "  cd \"$worktree_path\""
bootstrap_cmd="bash scripts/prepare-worktree.sh"
if [[ -f "$worktree_path/Makefile" ]] && rg -q '^worktree-ready:' "$worktree_path/Makefile"; then
	bootstrap_cmd="make worktree-ready"
fi
preflight_cmd="bash scripts/codex-preflight.sh --mode optional"
echo "  $bootstrap_cmd"
if [[ "$detached_mode" -eq 1 ]]; then
	echo "  # Optional: create a branch after initial exploration"
	echo "  git -C \"$worktree_path\" switch -c \"${branch_name}\""
fi
echo "  $preflight_cmd"

if [[ "$auto_bootstrap" -eq 1 ]]; then
	echo
	echo "[new-task] bootstrap: running '$bootstrap_cmd' in $worktree_path"
	(
		cd "$worktree_path"
		if [[ "$bootstrap_cmd" == "make worktree-ready" ]]; then
			make worktree-ready
		else
			bash scripts/prepare-worktree.sh
		fi
	)
fi

app_cmd=""
run_cmd_hint=""
if [[ -n "$run_cmd_override" ]]; then
	app_cmd="$run_cmd_override"
else
	app_script="$(infer_app_script "$worktree_path" || true)"
	if [[ -n "$app_script" ]]; then
		pm="$(detect_node_pm "$worktree_path")"
		app_cmd="$(node_run_cmd "$pm" "$app_script")"
	fi
fi

if [[ -n "$app_cmd" ]]; then
	if [[ "$use_portless" -eq 1 ]]; then
		run_cmd_hint="portless run -- $app_cmd"
		echo "  # Optional: run app with portless for per-worktree URL/port routing"
		if command -v portless >/dev/null 2>&1; then
			echo "  $run_cmd_hint"
		else
			echo "  # Install once: mise use -g npm:portless@latest"
			echo "  $run_cmd_hint"
		fi
	else
		run_cmd_hint="$app_cmd"
		echo "  # Optional: run app directly"
		echo "  $run_cmd_hint"
	fi
fi

if [[ "$output_json" -eq 1 ]]; then
	detached_mode_json=false
	if [[ "$detached_mode" -eq 1 ]]; then
		detached_mode_json=true
	fi

	auto_bootstrap_json=false
	if [[ "$auto_bootstrap" -eq 1 ]]; then
		auto_bootstrap_json=true
	fi

	use_portless_json=false
	if [[ "$use_portless" -eq 1 ]]; then
		use_portless_json=true
	fi

	jq -cn \
		--arg repo_root "$REPO_ROOT" \
		--arg base_ref "$base_ref" \
		--arg resolved_base_ref "$resolved_base_ref" \
		--arg worktree_path "$worktree_path" \
		--arg branch_name "$branch_name" \
		--arg bootstrap_cmd "$bootstrap_cmd" \
		--arg preflight_cmd "$preflight_cmd" \
		--arg app_cmd "$app_cmd" \
		--arg run_cmd_hint "$run_cmd_hint" \
		--argjson detached_mode "$detached_mode_json" \
		--argjson auto_bootstrap "$auto_bootstrap_json" \
		--argjson use_portless "$use_portless_json" \
		'{
			repoRoot: $repo_root,
			baseRef: $base_ref,
			resolvedBaseRef: $resolved_base_ref,
			worktreePath: $worktree_path,
			detachedMode: $detached_mode,
			branchName: (if $detached_mode then null else $branch_name end),
			bootstrapCmd: $bootstrap_cmd,
			preflightCmd: $preflight_cmd,
			autoBootstrap: $auto_bootstrap,
			usePortless: $use_portless,
			appCmd: (if $app_cmd == "" then null else $app_cmd end),
			runCmdHint: (if $run_cmd_hint == "" then null else $run_cmd_hint end)
		}' >&3
fi
