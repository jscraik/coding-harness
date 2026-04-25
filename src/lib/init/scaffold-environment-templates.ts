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

function renderEnvironmentFileChecks(
	packageJsonPath: string,
	projectBrainMemoryExtensionEnabled: boolean,
	requiredProjectBrainPaths: readonly string[],
): string {
	return `#!/usr/bin/env bash
# Local environment preflight (strict)
# Fails fast when required tooling is missing.

set -euo pipefail

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
	TOOLING_DOC_PATH="\${TOOLING_DOC_PATH:-$HOME/dev/config/codex/instructions/tooling.md}"

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
				echo "Error: required Project Brain memory-extension path '\$required_path' is missing under $REPO_ROOT"
				echo "Fix: run harness init --update to restore Project Brain scaffolding."
				exit 1
			fi
		done
	fi`;
}

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
	MISE_TRUST_LINE_COUNT="$(printf '%s\n' "$MISE_TRUST_STATUS" | awk 'NF{count++} END{print count+0}')"
	if [[ "$MISE_TRUST_LINE_COUNT" -ne 1 ]] || [[ "$MISE_TRUST_STATUS" != *": trusted" ]]; then
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
	tool_pattern="$(printf '%s' "\$tool" | sed 's/[][(){}.^$*+?|\\\\]/\\\\&/g')"
	if ! rg -q "^[[:space:]]*(\\\"\${tool_pattern}\\\"|\${tool_pattern})[[:space:]]*=" "$MISE_PATH"; then
		echo "Error: required tool '\$tool' is not pinned in $MISE_PATH [tools]"
		echo "Fix: add '\$tool = \\\"<version>\\\"' to $MISE_PATH."
		exit 1
	fi
done

if [[ -f "$TOOLING_DOC_PATH" ]]; then
	required_tooling_doc_terms=(${renderShellArray(REQUIRED_TOOLING_DOC_TERMS)})
	for term in "\${required_tooling_doc_terms[@]}"; do
		if ! rg -qi "(^|[^A-Za-z0-9_-])\${term}([^A-Za-z0-9_-]|$)" "$TOOLING_DOC_PATH"; then
			echo "Error: tooling doc missing expected term '\$term': $TOOLING_DOC_PATH"
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
			echo "Error: Codex environment action '\$name' is missing or mapped to the wrong icon in $CODEX_ENVIRONMENT_PATH"
			exit 1
		fi
	done

	required_make_targets=(${renderShellArray(REQUIRED_MAKEFILE_TARGETS)})
	for target in "\${required_make_targets[@]}"; do
		if ! rg -q "^\${target}:" "$MAKEFILE_PATH"; then
			echo "Error: required Makefile target '\$target' is missing from $MAKEFILE_PATH"
			exit 1
		fi
	done

	required_prek_hooks=(${renderPrekHookSpecs()})
	for hook_spec in "\${required_prek_hooks[@]}"; do
		IFS='|' read -r hook_name hook_display_name hook_command hook_language hook_pass_filenames hook_stages <<< "$hook_spec"
		if ! rg -q "^[[:space:]]*id[[:space:]]*=[[:space:]]*\\\"\${hook_name}\\\"[[:space:]]*$" "$PREK_CONFIG_PATH"; then
			echo "Error: required prek hook '\$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if ! rg -q "^[[:space:]]*name[[:space:]]*=[[:space:]]*\\\"\${hook_display_name}\\\"[[:space:]]*$" "$PREK_CONFIG_PATH"; then
			echo "Error: required prek hook '\$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if ! rg -q "^[[:space:]]*entry[[:space:]]*=[[:space:]]*\\\"\${hook_command}\\\"[[:space:]]*$" "$PREK_CONFIG_PATH"; then
			echo "Error: required prek hook '\$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if ! rg -q "^[[:space:]]*language[[:space:]]*=[[:space:]]*\\\"\${hook_language}\\\"[[:space:]]*$" "$PREK_CONFIG_PATH"; then
			echo "Error: required prek hook '\$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if ! rg -q "^[[:space:]]*pass_filenames[[:space:]]*=[[:space:]]*\${hook_pass_filenames}[[:space:]]*$" "$PREK_CONFIG_PATH"; then
			echo "Error: required prek hook '\$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
		if [[ -n "$hook_stages" ]] && ! rg -q "^[[:space:]]*stages[[:space:]]*=[[:space:]]*\\\\[\\\"$hook_stages\\\"\\\\][[:space:]]*$" "$PREK_CONFIG_PATH"; then
			echo "Error: required prek hook '\$hook_name' is missing or out of date in $PREK_CONFIG_PATH"
			exit 1
		fi
	done

	if [[ -f "$PACKAGE_JSON_PATH" ]]; then
		required_package_scripts=(${renderPackageScriptSpecs()})
		for script_spec in "\${required_package_scripts[@]}"; do
			script_name="\${script_spec%%|*}"
			script_command="\${script_spec#*|}"
			if ! jq -e --arg script_name "$script_name" --arg script_command "$script_command" '
				(.scripts // {})[$script_name] == $script_command
			' "$PACKAGE_JSON_PATH" >/dev/null; then
				echo "Error: package script '\$script_name' is missing or out of date in $PACKAGE_JSON_PATH"
				echo "Fix: run node scripts/setup-git-hooks.js"
				exit 1
			fi
		done

		if jq -e 'has("simple-git-hooks")' "$PACKAGE_JSON_PATH" >/dev/null; then
			echo "Error: legacy simple-git-hooks config must be removed from $PACKAGE_JSON_PATH"
			echo "Fix: delete the simple-git-hooks package/config and use node scripts/setup-git-hooks.js to install prek hooks."
			exit 1
		fi`;
}

function renderPackageCapabilityChecks(
	explicitCapabilities: readonly string[],
	capabilityDetectors: readonly CapabilityDetector[],
	requiredPackages: readonly RequiredPackagePolicy[],
): string {
	return `		has_package_marker() {
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
				echo "Fix: npm i $pkg"
				exit 1
			fi
		done
	fi

	mkdir -p "$REPO_ROOT/artifacts/policy"

echo "Running harness environment preflight..."`;
}

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

function renderEnvironmentRunnerSelection(): string {
	return `if [[ -f "$REPO_ROOT/src/cli.ts" ]] && command -v pnpm >/dev/null 2>&1; then
	if ! run_check_environment_with_runner "repo source CLI (pnpm exec tsx src/cli.ts)" pnpm exec tsx "$REPO_ROOT/src/cli.ts"; then
		echo "Error: repo source CLI failed to run check-environment successfully."
		exit 1
	fi
elif [[ -f "$REPO_ROOT/dist/cli.js" ]] && command -v node >/dev/null 2>&1; then
	if ! run_check_environment_with_runner "repo dist CLI (node dist/cli.js)" node "$REPO_ROOT/dist/cli.js"; then
		echo "Error: repo dist CLI failed to run check-environment successfully."
		exit 1
	fi
elif [[ -r "$REPO_ROOT/scripts/harness-cli.sh" ]]; then
	if ! run_check_environment_with_runner "repo wrapper (bash scripts/harness-cli.sh)" bash "$REPO_ROOT/scripts/harness-cli.sh"; then
		echo "Error: repo wrapper failed to run check-environment successfully."
		exit 1
	fi
else
	mise_harness_bin=""
	mise_harness_bin="$(mise which harness 2>/dev/null || true)"

	if [[ -n "$mise_harness_bin" && -x "$mise_harness_bin" ]]; then
		if ! run_check_environment_with_runner "mise harness ($mise_harness_bin)" "$mise_harness_bin"; then
			echo "Error: mise-resolved harness failed to run check-environment successfully."
			echo 'Fix: ensure the session activates mise first (eval "$(mise --cd \"$REPO_ROOT\" activate bash)") or invoke the mise binary directly.'
			exit 1
		fi
	else
		if ! command -v npm >/dev/null 2>&1; then
			echo "Error: npm is required to validate the global harness fallback."
			exit 1
		fi

		if ! npm ls -g --depth=0 @brainwav/coding-harness >/dev/null 2>&1; then
			echo "Error: @brainwav/coding-harness is not installed globally via npm."
			echo "Install globally and retry:"
			echo "  npm i -g @brainwav/coding-harness"
			echo "Private registry auth is required:"
			echo "  - Local shell: export NPM_TOKEN=<token>"
			echo "  - CI (CircleCI): set NPM_TOKEN as a project environment variable in CircleCI project settings"
			exit 1
		fi

			npm_global_bin=""
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
