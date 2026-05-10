/**
 * Environment preflight renderers used by the init scaffold.
 *
 * This module owns the generated `scripts/check-environment.sh` body so
 * `scaffold.ts` can keep its template inventory separate from environment
 * policy rendering details.
 *
 * @module lib/init/scaffold-environment-templates
 */

import { DEFAULT_CONTRACT } from "../contract/types.js";
import {
	PROJECT_MISE_REQUIRED_TOOLS,
	REQUIRED_CODEX_ACTION_PAIRS,
	REQUIRED_HOOK_SUPPORT_FILES,
	REQUIRED_MAKEFILE_TARGETS,
	REQUIRED_PACKAGE_SCRIPTS,
	REQUIRED_PREK_HOOKS,
	REQUIRED_PROJECT_BRAIN_MEMORY_EXTENSION_PATHS,
	REQUIRED_TOOLING_BINARIES,
	REQUIRED_TOOLING_DOC_TERMS,
} from "../policy/tooling-baseline.js";

type CapabilityDetector = {
	capability: string;
	dependencyMarkers: readonly string[];
};

type RequiredPackagePolicy = {
	package: string;
	dependencyType: string;
	requiredWhenCapabilities: readonly string[];
};

/**
 * Generate the strict local environment preflight script installed by `harness init`.
 *
 * @returns The complete `scripts/check-environment.sh` contents.
 */
export function renderCheckEnvironmentScript(): string {
	const packagePolicy = DEFAULT_CONTRACT.toolingPolicy?.packagePolicy;
	const projectBrainMemoryExtension =
		DEFAULT_CONTRACT.toolingPolicy?.projectBrainMemoryExtension;
	const requiredProjectBrainPaths =
		projectBrainMemoryExtension?.requiredPaths ?? [
			...REQUIRED_PROJECT_BRAIN_MEMORY_EXTENSION_PATHS,
		];

	return [
		renderEnvironmentFileChecks(
			packagePolicy?.packageJsonPath ?? "package.json",
			projectBrainMemoryExtension?.enabled ?? false,
			requiredProjectBrainPaths,
		),
		renderToolchainPolicyChecks(),
		renderRepositoryPolicyChecks(),
		renderPackageCapabilityChecks(
			packagePolicy?.explicitCapabilities ?? [],
			packagePolicy?.capabilityDetectors ?? [],
			packagePolicy?.requiredPackages ?? [],
		),
		renderEnvironmentRunnerFunction(),
		renderEnvironmentRunnerSelection(),
	].join("\n");
}

/**
 * Builds the Bash script body that validates required repository files and directories for the local environment preflight.
 *
 * @param packageJsonPath - Path to package.json relative to the repository root
 * @param projectBrainMemoryExtensionEnabled - If `true`, the script will also validate paths listed in `requiredProjectBrainPaths`
 * @param requiredProjectBrainPaths - Paths (relative to the repository root) that must exist when the Project Brain memory-extension check is enabled
 * @returns A string containing the Bash script which checks for required artifacts and exits with status 1 while printing an error if any required file or directory is missing
 */
function renderEnvironmentFileChecks(
	packageJsonPath: string,
	projectBrainMemoryExtensionEnabled: boolean,
	requiredProjectBrainPaths: readonly string[],
): string {
	return `#!/usr/bin/env bash
# Local environment preflight (strict)
# Fails fast when required tooling is missing.

set -euo pipefail

prepend_standard_tool_paths() {
	local candidate
	local idx
	local candidates=(
		"$HOME/.local/share/mise/shims"
		"$HOME/.local/bin"
		"/opt/homebrew/bin"
		"/opt/homebrew/sbin"
		"/usr/local/bin"
		"/usr/sbin"
		"/sbin"
	)
	if [[ -z "${"${"}PATH:-}" ]]; then
		PATH="/usr/bin:/bin"
		for (( idx=${"${"}#candidates[@]} - 1; idx >= 0; idx-- )); do
			candidate="${"${"}candidates[$idx]}"
			[[ -d "$candidate" && ":$PATH:" != *":$candidate:"* ]] && PATH="$candidate:$PATH"
		done
	else
		for candidate in "${"${"}candidates[@]}"; do
			[[ -d "$candidate" && ":$PATH:" != *":$candidate:"* ]] && PATH="$PATH:$candidate"
		done
	fi
	export PATH
}

prepend_standard_tool_paths

if [[ "${"${"}BASH_VERSINFO[0]:-0}" -lt 4 && -z "${"${"}CHECK_ENVIRONMENT_REEXECED:-}" ]]; then
	if [[ -x "/opt/homebrew/bin/bash" ]]; then
		export CHECK_ENVIRONMENT_REEXECED=1
		exec "/opt/homebrew/bin/bash" "$0" "$@"
	fi
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${"${"}BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONTRACT_PATH="$REPO_ROOT/harness.contract.json"
	ATTESTATION_PATH="$REPO_ROOT/artifacts/policy/environment-attestation.json"
	MISE_PATH="$REPO_ROOT/.mise.toml"
	CODEX_ENVIRONMENT_PATH="$REPO_ROOT/.codex/environments/environment.toml"
	MAKEFILE_PATH="$REPO_ROOT/Makefile"
	PREK_CONFIG_PATH="$REPO_ROOT/prek.toml"
	PACKAGE_JSON_PATH="$REPO_ROOT/${packageJsonPath}"
	CODESTYLE_PATH="$REPO_ROOT/CODESTYLE.md"
	CODESTYLE_DIR_PATH="$REPO_ROOT/codestyle"
	CODESTYLE_CHECKSUM_PATH="$REPO_ROOT/codestyle/CHECKSUMS.sha256"
	TOOLING_DOC_PATH="\${TOOLING_DOC_PATH:-$HOME/dev/configs/codex/instructions/tooling.md}"

if [[ ! -f "$CONTRACT_PATH" ]]; then
	echo "Error: missing contract file at $CONTRACT_PATH"
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

	if [[ ! -f "$PREK_CONFIG_PATH" ]]; then
		echo "Error: missing required prek config at $PREK_CONFIG_PATH"
		exit 1
	fi

	if [[ ! -f "$CODESTYLE_PATH" ]]; then
		echo "Error: missing CODESTYLE contract at $CODESTYLE_PATH"
		exit 1
	fi

	if [[ ! -d "$CODESTYLE_DIR_PATH" ]]; then
		echo "Error: missing codestyle module directory at $CODESTYLE_DIR_PATH"
		exit 1
	fi

	if [[ ! -f "$CODESTYLE_CHECKSUM_PATH" ]]; then
		echo "Error: missing codestyle checksum manifest at $CODESTYLE_CHECKSUM_PATH"
		exit 1
	fi

	required_support_files=(${renderShellArray(REQUIRED_HOOK_SUPPORT_FILES)})
	for support_file in "\${required_support_files[@]}"; do
		if [[ ! -f "$REPO_ROOT/\${support_file}" ]]; then
			echo "Error: missing required hook support file at $REPO_ROOT/\${support_file}"
			exit 1
		fi
	done

	project_brain_memory_extension_enabled=${projectBrainMemoryExtensionEnabled ? "true" : "false"}
	required_project_brain_paths=(${renderShellArray(requiredProjectBrainPaths)})
	if [[ "$project_brain_memory_extension_enabled" == "true" ]]; then
		for required_path in "\${required_project_brain_paths[@]}"; do
			if [[ ! -e "$REPO_ROOT/\${required_path}" ]]; then
				echo "Error: required Project Brain memory-extension path '$required_path' is missing under $REPO_ROOT"
				echo "Fix: run harness init --update to restore Project Brain scaffolding."
				exit 1
			fi
		done
	fi`;
}

/**
 * Produces a Bash script fragment that enforces the repository's toolchain policy.
 *
 * The returned script verifies the presence of the `mise` binary, validates and normalizes mise trust for the repository, activates the mise runtime, ensures required mise tools are pinned in the mise config, checks required terms in the tooling documentation (when present), and verifies the presence of required tooling binaries.
 *
 * @returns A string containing the Bash code implementing the above toolchain policy checks.
 */
function renderToolchainPolicyChecks(): string {
	return `ensure_mise_available() {
	command -v mise >/dev/null 2>&1
}

if ! ensure_mise_available; then
	echo "Error: required binary 'mise' is not installed or not on PATH"
	exit 1
fi

if ! command -v mise >/dev/null 2>&1; then
	echo "Error: required binary 'mise' is not installed or not on PATH"
	exit 1
fi

	# Bootstrap the full repo-managed environment so hook validation reflects the
	# pinned runtime versions and required approval posture, not only the caller
	# shell's PATH.
	MISE_TRUST_STATUS="$(mise --cd "$REPO_ROOT" trust --show "$MISE_PATH" 2>/dev/null || true)"
	MISE_TRUST_REPO_PATH="$REPO_ROOT"
	if [[ "$MISE_TRUST_REPO_PATH" == "$HOME"/* ]]; then
		MISE_TRUST_REPO_PATH="~/\${MISE_TRUST_REPO_PATH#"$HOME"/}"
	fi
	if ! rg --fixed-strings --line-regexp --quiet "$MISE_TRUST_REPO_PATH: trusted" <<<"$MISE_TRUST_STATUS"; then
		echo "Error: mise config at $MISE_PATH is not trusted"
		echo "Fix: run 'mise trust --yes $MISE_PATH' and retry."
		exit 1
	fi

	if ! eval "$(mise --cd "$REPO_ROOT" activate bash)"; then
		echo "Error: failed to activate mise runtime from $MISE_PATH"
		echo "Fix: ensure mise is installed, trusted, and healthy, then retry."
		exit 1
	fi
	export CLAUDE_APPROVAL_POSTURE="\${CLAUDE_APPROVAL_POSTURE:-require}"

required_mise_tools=(${renderShellArray(
		PROJECT_MISE_REQUIRED_TOOLS.map(([tool]) => tool),
	)})
for tool in "\${required_mise_tools[@]}"; do
	tool_pattern="$(printf '%s' "$tool" | sed 's/[][(){}.^$*+?|\\\\]/\\\\&/g')"
	if ! rg -q "^[[:space:]]*(\\"\${tool_pattern}\\"|\${tool_pattern})[[:space:]]*=" "$MISE_PATH"; then
		echo "Error: required tool '$tool' is not pinned in $MISE_PATH [tools]"
		echo "Fix: add '$tool = \\"<version>\\"' to $MISE_PATH."
		exit 1
	fi
done

if [[ -f "$TOOLING_DOC_PATH" ]]; then
	required_tooling_doc_terms=(${renderShellArray(REQUIRED_TOOLING_DOC_TERMS)})
	for term in "\${required_tooling_doc_terms[@]}"; do
		if ! rg -qi "(^|[^A-Za-z0-9_-])\${term}([^A-Za-z0-9_-]|$)" "$TOOLING_DOC_PATH"; then
			echo "Error: tooling doc missing expected term '$term': $TOOLING_DOC_PATH"
			echo "Fix: update tooling inventory and keep it aligned with $MISE_PATH."
			echo "Interactive flow: run a Codex AskQuestion/request_user_input prompt before applying installs."
			exit 1
		fi
	done
else
	echo "Warning: tooling doc not found at $TOOLING_DOC_PATH; skipping doc sync check."
fi

	required_bins=(${renderShellArray(REQUIRED_TOOLING_BINARIES)})
	for bin in "\${required_bins[@]}"; do
		if ! command -v "$bin" >/dev/null 2>&1; then
			echo "Error: required binary '$bin' is not installed or not on PATH"
			exit 1
		fi
	done`;
}

/**
 * Produce a Bash script fragment that validates repository-level policy artifacts, hooks, Makefile targets, and package scripts.
 *
 * The generated script verifies Codex environment action mappings, required Makefile targets, and configured prek hooks
 * (including name, entry, language, pass_filenames, and optional stages). It also checks installed git hooks for the
 * repo-local PREK_HOME patch (pre-commit, pre-push, and commit-msg), validates required package.json scripts, and
 * errors if legacy simple-git-hooks configuration is present.
 *
 * @returns A string containing the Bash code that performs the repository policy checks described above.
 */
function renderRepositoryPolicyChecks(): string {
	return `	required_codex_actions=(${renderCodexActionSpecs()})
	for action in "\${required_codex_actions[@]}"; do
		name="\${action%%|*}"
		icon="\${action##*|}"
		if ! awk -v name="$name" -v icon="$icon" '
			prev == "name = \\"" name "\\"" && $0 == "icon = \\"" icon "\\"" { found = 1 }
			{ prev = $0 }
			END { exit found ? 0 : 1 }
		' "$CODEX_ENVIRONMENT_PATH"; then
			echo "Error: Codex environment action '$name' is missing or mapped to the wrong icon in $CODEX_ENVIRONMENT_PATH"
			exit 1
		fi
	done

	required_make_targets=(${renderShellArray(REQUIRED_MAKEFILE_TARGETS)})
	for target in "\${required_make_targets[@]}"; do
		if ! rg -q "^\${target}:" "$MAKEFILE_PATH"; then
			echo "Error: required Makefile target '$target' is missing from $MAKEFILE_PATH"
			exit 1
		fi
	done

	required_prek_hooks=(${renderPrekHookSpecs()})
	for hook_spec in "\${required_prek_hooks[@]}"; do
		IFS='|' read -r hook_name hook_display_name hook_command hook_language hook_pass_filenames hook_stages <<< "$hook_spec"
		hook_block="$(awk -v wanted="$hook_name" '
			function flush() {
				if (matched) {
					printf "%s", block
				}
			}
			/^\\[\\[repos\\.hooks\\]\\]/ {
				flush()
				block = $0 ORS
				matched = 0
				next
			}
			{
				block = block $0 ORS
				if ($0 ~ "^[[:space:]]*id[[:space:]]*=[[:space:]]*\\"" wanted "\\"[[:space:]]*$") {
					matched = 1
				}
			}
			END {
				flush()
			}
		' "$PREK_CONFIG_PATH")"
		if [[ -z "$hook_block" ]]; then
			echo "Error: required prek hook '$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if ! rg -q "^[[:space:]]*name[[:space:]]*=[[:space:]]*\\"\${hook_display_name}\\"[[:space:]]*$" <<< "$hook_block"; then
			echo "Error: required prek hook '$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if ! rg -q "^[[:space:]]*entry[[:space:]]*=[[:space:]]*\\"\${hook_command}\\"[[:space:]]*$" <<< "$hook_block"; then
			echo "Error: required prek hook '$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if ! rg -q "^[[:space:]]*language[[:space:]]*=[[:space:]]*\\"\${hook_language}\\"[[:space:]]*$" <<< "$hook_block"; then
			echo "Error: required prek hook '$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if ! rg -q "^[[:space:]]*pass_filenames[[:space:]]*=[[:space:]]*\${hook_pass_filenames}[[:space:]]*$" <<< "$hook_block"; then
			echo "Error: required prek hook '$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if [[ -n "$hook_stages" ]] && ! rg -q "^[[:space:]]*stages[[:space:]]*=[[:space:]]*\\\\[\\"$hook_stages\\"\\\\][[:space:]]*$" <<< "$hook_block"; then
			echo "Error: required prek hook '$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
	done

	installed_hooks_dir="$(git -C "$REPO_ROOT" rev-parse --git-path hooks 2>/dev/null || true)"
	if [[ -n "$installed_hooks_dir" && -d "$installed_hooks_dir" ]]; then
		for hook_name in pre-commit pre-push commit-msg; do
			installed_hook="$installed_hooks_dir/$hook_name"
			if [[ -f "$installed_hook" ]] && rg -q "# File generated by prek: https://github.com/j178/prek" "$installed_hook" && ! rg -F -q 'PREK_HOME="\${PREK_HOME:-$HERE/../.cache/prek}"' "$installed_hook"; then
				echo "Error: installed prek hook '$hook_name' is missing repo-local PREK_HOME patch"
				echo "Fix: run node scripts/setup-git-hooks.js"
				exit 1
			fi
		done
	fi

	if [[ -f "$PACKAGE_JSON_PATH" ]]; then
		required_package_scripts=(${renderPackageScriptSpecs()})
		for script_spec in "\${required_package_scripts[@]}"; do
			script_name="\${script_spec%%|*}"
			script_command="\${script_spec#*|}"
			if ! jq -e --arg script_name "$script_name" --arg script_command "$script_command" '
				(.scripts // {})[$script_name] == $script_command
				' "$PACKAGE_JSON_PATH" >/dev/null; then
					echo "Error: package script '$script_name' is missing or out of date in $PACKAGE_JSON_PATH"
					echo "Fix: run harness init --update"
					exit 1
				fi
			done

			if jq -e '
				has("simple-git-hooks")
				or ((.dependencies // {}) | has("simple-git-hooks"))
				or ((.devDependencies // {}) | has("simple-git-hooks"))
				or (((.scripts // {}) | to_entries | any(.value | test("simple-git-hooks"))))
			' "$PACKAGE_JSON_PATH" >/dev/null; then
				echo "Error: legacy simple-git-hooks config must be removed from $PACKAGE_JSON_PATH"
				echo "Fix: delete the simple-git-hooks package/config and use node scripts/setup-git-hooks.js to install prek hooks."
				exit 1
			fi
		fi`;
}

function renderPackageCapabilityChecks(
	explicitCapabilities: readonly string[],
	capabilityDetectors: readonly CapabilityDetector[],
	requiredPackages: readonly RequiredPackagePolicy[],
): string {
	return `	if [[ -f "$PACKAGE_JSON_PATH" ]]; then
		has_package_marker() {
				local marker="$1"
				jq -e --arg marker "$marker" '
					((.dependencies // {}) + (.devDependencies // {})) | has($marker)
			' "$PACKAGE_JSON_PATH" >/dev/null
		}

			declare -a repo_capabilities=()
			declare -a explicit_capabilities=(${renderShellArray(explicitCapabilities)})
			for capability in "\${explicit_capabilities[@]:-}"; do
				[[ -n "$capability" ]] || continue
				repo_capabilities+=("$capability")
			done
${renderCapabilityDetectorBlocks(capabilityDetectors)}

			has_capability() {
				local wanted="$1"
				for capability in "\${repo_capabilities[@]:-}"; do
					if [[ "$capability" == "$wanted" ]]; then
						return 0
					fi
			done
			return 1
		}

		has_required_package() {
			local pkg="$1"
			local dependency_type="$2"
			case "$dependency_type" in
				dependencies)
					jq -e --arg pkg "$pkg" '(.dependencies // {}) | has($pkg)' "$PACKAGE_JSON_PATH" >/dev/null
					;;
				devDependencies)
					jq -e --arg pkg "$pkg" '(.devDependencies // {}) | has($pkg)' "$PACKAGE_JSON_PATH" >/dev/null
					;;
				either)
					jq -e --arg pkg "$pkg" '((.dependencies // {}) | has($pkg)) or ((.devDependencies // {}) | has($pkg))' "$PACKAGE_JSON_PATH" >/dev/null
					;;
				*)
					return 1
					;;
			esac
		}

		required_package_specs=(${renderRequiredPackageSpecs(requiredPackages)})
		for spec in "\${required_package_specs[@]}"; do
			pkg="\${spec%%|*}"
			rest="\${spec#*|}"
			dependency_type="\${rest%%|*}"
			required_caps_csv="\${rest#*|}"
			should_apply=0
			IFS=',' read -r -a required_caps <<< "$required_caps_csv"
			for capability in "\${required_caps[@]}"; do
				if has_capability "$capability"; then
					should_apply=1
					break
				fi
		done
				if [[ "$should_apply" -eq 1 ]] && ! has_required_package "$pkg" "$dependency_type"; then
					echo "Error: required package '$pkg' is missing from $PACKAGE_JSON_PATH for explicit or detected UI/App SDK capabilities"
					if [[ "$dependency_type" == "devDependencies" ]]; then
						echo "Fix: pnpm add -D $pkg"
					else
						echo "Fix: pnpm add $pkg"
					fi
					exit 1
				fi
			done
	fi

	mkdir -p "$REPO_ROOT/artifacts/policy"

echo "Running harness environment preflight..."`;
}

/**
 * Produces a Bash function that runs a candidate harness runner to execute the environment preflight and capture its attestation.
 *
 * The generated function is named `run_check_environment_with_runner` and, when invoked with a label and a runner command, executes the runner's `check-environment` action, prints its output, verifies the runner exit status, ensures an attestation file is created (recovering a JSON line from stdout if needed), and returns nonzero on failure.
 *
 * @returns A string containing the Bash function definition for `run_check_environment_with_runner`.
 */
function renderEnvironmentRunnerFunction(): string {
	return `run_check_environment_with_runner() {
	local label="$1"
	shift
	local -a runner=("$@")
	local output=""
	local exit_code=0

	rm -f "$ATTESTATION_PATH"

	echo "Using harness runner: $label"
	set +e
	output="$("\${runner[@]}" check-environment \\
		--contract "$CONTRACT_PATH" \\
		--json \\
		--attestation "$ATTESTATION_PATH" 2>&1)"
	exit_code=$?
	set -e

	if [[ -n "$output" ]]; then
		printf '%s\\n' "$output"
	fi

	if [[ "$exit_code" -ne 0 ]]; then
		echo "Runner failed: $label (exit $exit_code)"
		return 1
	fi

	if [[ ! -f "$ATTESTATION_PATH" ]]; then
		local json_line
		json_line="$(printf '%s\\n' "$output" | awk '/^\\{/{line=$0} END{if(line!="") print line}')"
		if [[ -n "$json_line" ]]; then
			printf '%s\\n' "$json_line" > "$ATTESTATION_PATH"
		fi
	fi

	if [[ ! -f "$ATTESTATION_PATH" ]]; then
		echo "Runner produced no attestation output: $label"
		return 1
	fi

	return 0
}`;
}

/**
 * Produces a Bash script that selects and invokes an appropriate harness runner to execute the repository's check-environment, validates the resulting attestation, and reports success or failure.
 *
 * The generated script prefers, in order: the repo source CLI (src/cli.ts) when Node is available, a repo wrapper (scripts/harness-cli.sh), the repo dist CLI (dist/cli.js) when Node is available, a mise-resolved harness, and finally a globally installed npm harness (@brainwav/coding-harness). It emits actionable error messages and exits on runner failures or missing tooling, and verifies the attestation at ATTESTATION_PATH before printing a success line.
 *
 * @returns The complete Bash script text that performs runner selection, executes check-environment via the chosen runner, enforces failures with informative messages, and validates the attestation.
 */
function renderEnvironmentRunnerSelection(): string {
	return `if [[ -f "$REPO_ROOT/src/cli.ts" ]] && command -v node >/dev/null 2>&1; then
	if ! run_check_environment_with_runner "repo source CLI (cd repo && node --import tsx src/cli.ts)" bash -lc 'cd "$1" && shift && exec "$@"' _ "$REPO_ROOT" node --import tsx src/cli.ts; then
		echo "Error: repo source CLI failed to run check-environment successfully."
		exit 1
	fi
elif [[ -r "$REPO_ROOT/scripts/harness-cli.sh" ]]; then
	if ! run_check_environment_with_runner "repo wrapper (bash scripts/harness-cli.sh)" bash "$REPO_ROOT/scripts/harness-cli.sh"; then
		echo "Error: repo wrapper failed to run check-environment successfully."
		exit 1
	fi
elif [[ -f "$REPO_ROOT/dist/cli.js" ]] && command -v node >/dev/null 2>&1; then
	if ! run_check_environment_with_runner "repo dist CLI (node dist/cli.js)" node "$REPO_ROOT/dist/cli.js"; then
		echo "Error: repo dist CLI failed to run check-environment successfully."
		exit 1
	fi
else
	mise_harness_bin=""
	mise_harness_bin="$(mise which harness 2>/dev/null || true)"

	if [[ -n "$mise_harness_bin" && -x "$mise_harness_bin" ]]; then
		if ! run_check_environment_with_runner "mise harness ($mise_harness_bin)" "$mise_harness_bin"; then
			echo "Error: mise-resolved harness failed to run check-environment successfully."
			printf 'Fix: ensure the session activates mise first (eval "$(mise --cd "%s" activate bash)") or invoke the mise binary directly.\\n' "$REPO_ROOT"
			exit 1
		fi
	else
		if ! command -v npm >/dev/null 2>&1; then
			echo "Error: npm is required to validate the global harness fallback."
			exit 1
		fi

		npm_global_bin=""
		npm_global_prefix="$(npm prefix -g 2>/dev/null || true)"
		if [[ -n "$npm_global_prefix" ]]; then
			npm_global_bin="$npm_global_prefix/bin"
		fi
		npm_harness_bin="$npm_global_bin/harness"

		if [[ -n "$npm_global_bin" && -x "$npm_harness_bin" ]]; then
			if ! run_check_environment_with_runner "global npm harness ($npm_harness_bin)" "$npm_harness_bin"; then
				echo "Error: global npm harness failed to run check-environment successfully."
				echo "Reinstall and retry:"
				echo "  npm i -g @brainwav/coding-harness"
				echo "If this is CI (CircleCI), confirm NPM_TOKEN is set as a project environment variable."
				exit 1
			fi
		else
			if ! npm whoami --registry=https://registry.npmjs.org/ >/dev/null 2>&1; then
				echo "Error: npm auth is missing in this process; cannot inspect private @brainwav/coding-harness."
				echo "The repo .npmrc only routes @brainwav packages to npm; it does not carry credentials."
				echo "Provide npm auth with NPM_TOKEN or a user-level ~/.npmrc, then retry."
				echo "If this is CI (CircleCI), set NPM_TOKEN as a project environment variable."
				exit 1
			fi

			if ! npm ls -g --depth=0 @brainwav/coding-harness >/dev/null 2>&1; then
				echo "Error: @brainwav/coding-harness is not installed globally via npm."
				echo "Install globally and retry:"
				echo "  npm i -g @brainwav/coding-harness"
				echo "Private registry auth is already available in this process."
				exit 1
			fi

			npm_global_prefix="$(npm prefix -g 2>/dev/null || true)"
			if [[ -n "$npm_global_prefix" ]]; then
				npm_global_bin="$npm_global_prefix/bin"
			fi
			npm_harness_bin="$npm_global_bin/harness"

			if [[ -z "$npm_global_bin" || ! -x "$npm_harness_bin" ]]; then
				echo "Error: unable to resolve npm-global harness binary."
				echo "Fix: ensure npm global bin directory is available and contains harness."
				exit 1
			fi

			if ! run_check_environment_with_runner "global npm harness ($npm_harness_bin)" "$npm_harness_bin"; then
				echo "Error: global npm harness failed to run check-environment successfully."
				echo "Reinstall and retry:"
				echo "  npm i -g @brainwav/coding-harness"
				echo "If this is CI (CircleCI), confirm NPM_TOKEN is set as a project environment variable."
				exit 1
			fi
		fi
		fi
	fi

jq -e '.passed == true' "$ATTESTATION_PATH" >/dev/null
echo "Environment check passed (attestation: $ATTESTATION_PATH)"
`;
}

function renderCapabilityDetectorBlocks(
	capabilityDetectors: readonly CapabilityDetector[],
): string {
	return capabilityDetectors
		.map(
			(
				detector,
			) => `		${detector.capability}_markers=(${renderShellArray(detector.dependencyMarkers)})
		for marker in "\${${detector.capability}_markers[@]}"; do
			if has_package_marker "$marker"; then
				repo_capabilities+=("${detector.capability}")
				break
			fi
		done`,
		)
		.join("\n\n");
}

function renderCodexActionSpecs(): string {
	return renderShellArray(
		REQUIRED_CODEX_ACTION_PAIRS.map(({ name, icon }) => `${name}|${icon}`),
	);
}

function renderPackageScriptSpecs(): string {
	return renderShellArray(
		Object.entries(REQUIRED_PACKAGE_SCRIPTS).map(
			([name, command]) => `${name}|${command}`,
		),
	);
}

function renderPrekHookSpecs(): string {
	return renderShellArray(
		Object.entries(REQUIRED_PREK_HOOKS).map(([hook, config]) => {
			const hookStages =
				hook === "pre-push"
					? REQUIRED_PREK_HOOKS["pre-push"].stages.join(",")
					: "";
			return `${hook}|${config.name}|${config.entry}|${config.language}|${String(config.pass_filenames)}|${hookStages}`;
		}),
	);
}

function renderRequiredPackageSpecs(
	requiredPackages: readonly RequiredPackagePolicy[],
): string {
	return renderShellArray(
		requiredPackages.map(
			(requiredPackage) =>
				`${requiredPackage.package}|${requiredPackage.dependencyType}|${requiredPackage.requiredWhenCapabilities.join(",")}`,
		),
	);
}

function renderShellArray(values: readonly string[]): string {
	return values.map(quoteShellArrayValue).join(" ");
}

function quoteShellArrayValue(value: string): string {
	return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}
