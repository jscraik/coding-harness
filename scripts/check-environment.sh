#!/usr/bin/env bash
# Local environment preflight (strict)
# Fails fast when required tooling is missing.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONTRACT_PATH="$REPO_ROOT/harness.contract.json"
ATTESTATION_PATH="$REPO_ROOT/artifacts/policy/environment-attestation.json"
MISE_PATH="$REPO_ROOT/.mise.toml"
CODEX_ENVIRONMENT_PATH="$REPO_ROOT/.codex/environments/environment.toml"
MAKEFILE_PATH="$REPO_ROOT/Makefile"
TOOLING_DOC_PATH="${TOOLING_DOC_PATH:-$HOME/dev/config/codex/instructions/tooling.md}"

if [[ ! -f "$CONTRACT_PATH" ]]; then
	echo "Error: missing contract file at $CONTRACT_PATH"
	exit 1
fi

if ! command -v rg >/dev/null 2>&1; then
	echo "Error: required binary 'rg' is not installed or not on PATH"
	exit 1
fi

if [[ ! -f "$MISE_PATH" ]]; then
	echo "Error: missing mise config at $MISE_PATH"
	exit 1
fi

if [[ ! -f "$CODEX_ENVIRONMENT_PATH" ]]; then
	echo "Error: missing Codex environment file at $CODEX_ENVIRONMENT_PATH"
	exit 1
fi

if [[ ! -f "$MAKEFILE_PATH" ]]; then
	echo "Error: missing required Makefile at $MAKEFILE_PATH"
	exit 1
fi

required_mise_tools=("node" "pnpm" "python" "uv" "cargo:prek" "npm:@brainwav/diagram" "npm:@argos-ci/cli" "cosign" "cloudflared" "npm:vitest" "ruff" "npm:eslint" "npm:agent-browser" "npm:agentation" "npm:agentation-mcp" "npm:@brainwav/rsearch" "npm:@brainwav/wsearch-cli" "npm:beautiful-mermaid" "npm:markdownlint-cli2" "npm:semver" "npm:wrangler" "semgrep" "trivy" "vale")
for tool in "${required_mise_tools[@]}"; do
	if ! rg -Fq "\"${tool}\" = " "$MISE_PATH" && ! rg -Fq "${tool} = " "$MISE_PATH"; then
		echo "Error: required tool '$tool' is not pinned in $MISE_PATH [tools]"
		echo "Fix: add '$tool = \"<version>\"' to $MISE_PATH."
		exit 1
	fi
done

if [[ -f "$TOOLING_DOC_PATH" ]]; then
	required_tooling_doc_terms=("node" "pnpm" "python" "uv" "make" "rg" "fd" "jq" "prek" "diagram" "mise" "vale" "argos" "cosign" "cloudflared" "vitest" "ruff" "eslint" "agent-browser" "agentation" "markdownlint-cli2" "wrangler" "beautiful-mermaid" "semgrep" "semver" "trivy" "rsearch" "wsearch")
	for term in "${required_tooling_doc_terms[@]}"; do
		if ! rg -qi "(^|[^A-Za-z0-9_-])${term}([^A-Za-z0-9_-]|$)" "$TOOLING_DOC_PATH"; then
			echo "Error: tooling doc missing expected term '$term': $TOOLING_DOC_PATH"
			echo "Fix: update tooling inventory and keep it aligned with $MISE_PATH."
			echo "Interactive flow: run a Codex AskQuestion/request_user_input prompt before applying installs."
			exit 1
		fi
	done
else
	echo "Warning: tooling doc not found at $TOOLING_DOC_PATH; skipping doc sync check."
fi

required_bins=("pnpm" "node" "jq" "make" "rg" "fd" "prek" "diagram" "mise" "vale" "argos" "cosign" "cloudflared" "vitest" "ruff" "eslint" "agent-browser" "agentation-mcp" "markdownlint-cli2" "wrangler" "beautiful-mermaid" "semgrep" "semver" "trivy" "rsearch" "wsearch")
for bin in "${required_bins[@]}"; do
	if ! command -v "$bin" >/dev/null 2>&1; then
		echo "Error: required binary '$bin' is not installed or not on PATH"
		exit 1
	fi
done

required_codex_actions=("Tools|tool" "Run|run" "Debug|debug" "Test|test" "Prek|test" "Diagram|tool" "Ralph|debug" "Mise|tool" "Vale|debug" "Argos|test" "Cosign|debug" "Cloudflared|run" "Vitest|test" "Ruff|debug" "ESLint|debug" "Agent Browser|tool" "Agentation|tool" "MarkdownLint|debug" "Wrangler|run" "1Password|tool" "Beautiful Mermaid|tool" "Auth0|tool" "Semgrep|debug" "Semver|tool" "Trivy|debug" "Gitleaks|debug" "Research|tool" "WSearch|tool")
for action in "${required_codex_actions[@]}"; do
	name="${action%%|*}"
	icon="${action##*|}"
	if ! awk -v name="$name" -v icon="$icon" '
		prev == "name = \"" name "\"" && $0 == "icon = \"" icon "\"" { found = 1 }
		{ prev = $0 }
		END { exit found ? 0 : 1 }
	' "$CODEX_ENVIRONMENT_PATH"; then
		echo "Error: Codex environment action '$name' is missing or mapped to the wrong icon in $CODEX_ENVIRONMENT_PATH"
		exit 1
	fi
done

required_make_targets=("help" "install" "setup" "hooks" "lint" "docs-lint" "fmt" "typecheck" "test" "check" "audit" "secrets" "security" "clean" "reset" "ci" "diagrams" "env-check")
for target in "${required_make_targets[@]}"; do
	if ! rg -q "^${target}:" "$MAKEFILE_PATH"; then
		echo "Error: required Makefile target '$target' is missing from $MAKEFILE_PATH"
		exit 1
	fi
done

mkdir -p "$REPO_ROOT/artifacts/policy"

echo "Running harness environment preflight..."
pnpm exec tsx src/cli.ts check-environment \
	--contract "$CONTRACT_PATH" \
	--json \
	--attestation "$ATTESTATION_PATH"

jq -e '.passed == true' "$ATTESTATION_PATH" >/dev/null
echo "Environment check passed (attestation: $ATTESTATION_PATH)"
