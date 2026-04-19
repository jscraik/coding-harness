#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

TRACKED_ARTIFACT_PATHS=(
	".diagram"
	"AI/context/diagram-context.md"
	".diagram/context/diagram-context.meta.json"
)

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
		package.json|tsconfig.json|.diagramrc|scripts/refresh-diagram-context.sh|scripts/check-diagram-freshness.sh)
			return 0
			;;
		.diagram/*)
			return 0
			;;
		AI/context/*)
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
		*/diagram-context.md)
			# Normalize volatile Mermaid node identifiers and line order while
			# preserving edge/label text so unquoted edge changes are still detected.
			node - "$file" <<'NODE' | shasum -a 256 | awk '{print $1}'
const fs = require("node:fs");

const filePath = process.argv[2];
const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
const normalized = [];
let inMermaid = false;
let mermaidLines = [];

const normalizeMermaidLine = (line) => {
	let value = line.trim();
	if (!value) return "";

	value = value.replace(/^([A-Za-z0-9_:-]+)\s*(\[[^\]]+\]|\([^)]*\)|\{[^}]*\})/, "NODE$2");
	value = value.replace(/\b(style|class|click)\s+[A-Za-z0-9_:-]+\b/g, "$1 NODE");
	value = value.replace(/^([A-Za-z0-9_:-]+)(\s*[-.=]+.*)$/, "NODE$2");
	value = value.replace(/([-.=]+>|<[-.=]+)\s*([A-Za-z0-9_:-]+)/g, "$1 NODE");
	return value.replace(/\s+/g, " ").trim();
};

const flushMermaid = () => {
	const normalizedBlock = mermaidLines
		.map(normalizeMermaidLine)
		.filter(Boolean)
		.sort();
	normalized.push("```mermaid");
	normalized.push(...normalizedBlock);
	normalized.push("```");
	mermaidLines = [];
};

for (const line of lines) {
	if (/^Generated: /.test(line)) continue;
	if (line.trim() === "```mermaid") {
		inMermaid = true;
		mermaidLines = [];
		continue;
	}
	if (inMermaid && line.trim() === "```") {
		flushMermaid();
		inMermaid = false;
		continue;
	}
	if (inMermaid) {
		mermaidLines.push(line);
		continue;
	}
	normalized.push(line.trimEnd());
}

if (inMermaid) {
	flushMermaid();
}

process.stdout.write(`${normalized.join("\n")}\n`);
NODE
			;;
		*/diagram-context.meta.json)
			jq -c 'del(.generated_at, .last_generated_epoch, .changed, .context_sha256, .git_head)' "$file" | shasum -a 256 | awk '{print $1}'
			;;
		*/manifest.json)
			jq -c 'del(.generatedAt)' "$file" | shasum -a 256 | awk '{print $1}'
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

should_refresh=0
while IFS= read -r changed_path; do
	[[ -n "$changed_path" ]] || continue
	if is_architecture_sensitive_change "$changed_path"; then
		should_refresh=1
		break
	fi
done < <(collect_changed_paths)

if [[ "$should_refresh" -ne 1 ]]; then
	echo "Diagram freshness check skipped: no architecture-sensitive implementation paths changed."
	exit 0
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
# Restore only tracked files so pre-push hooks do not fail on non-semantic churn.
mapfile -t tracked_files < <(tracked_artifact_files)
if (( ${#tracked_files[@]} > 0 )); then
	git -C "$REPO_ROOT" restore --worktree -- "${tracked_files[@]}" >/dev/null 2>&1 || true
fi

echo "Diagram freshness check passed."
