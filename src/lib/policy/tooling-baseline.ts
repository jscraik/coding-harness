export const TOOLING_READINESS_SCRIPT_PATH =
	"scripts/check-environment.sh" as const;
export const TOOLING_CODEX_ENVIRONMENT_PATH =
	".codex/environments/environment.toml" as const;
export const TOOLING_MAKEFILE_PATH = "Makefile" as const;
export const TOOLING_PACKAGE_JSON_PATH = "package.json" as const;
export const TOOLING_PREK_CONFIG_PATH = "prek.toml" as const;

export const REQUIRED_PREK_INSTALL_HOOK_TYPES = [
	"pre-commit",
	"pre-push",
	"commit-msg",
] as const;
export const REQUIRED_PREK_VERSION = "0.3.9" as const;

export const REQUIRED_PREK_HOOKS = {
	"pre-commit": {
		name: "Pre-commit",
		entry: "make hooks-pre-commit",
		language: "system",
		pass_filenames: false,
	},
	"pre-push": {
		name: "Pre-push",
		entry: "make hooks-pre-push",
		language: "system",
		pass_filenames: false,
		stages: ["pre-push"],
	},
	"commit-msg": {
		name: "Commit-msg",
		entry: "bash scripts/check-commit-msg.sh",
		language: "system",
		pass_filenames: true,
		stages: ["commit-msg"],
	},
} as const;

export const REQUIRED_PACKAGE_SCRIPTS = {
	"codestyle:validate": "bash scripts/validate-codestyle.sh",
	"secrets:staged": "bash scripts/check-staged-secrets.sh",
	"docs:style:changed": "bash scripts/check-doc-style.sh",
	"test:related": "bash scripts/check-related-tests.sh",
	"semgrep:changed": "bash scripts/check-semgrep-changed.sh",
} as const;

export const REQUIRED_TOOLING_DOC_TERMS = [
	"node",
	"pnpm",
	"python",
	"uv",
	"make",
	"rg",
	"fd",
	"jq",
	"prek",
	"diagram",
	"mise",
	"vale",
	"argos",
	"cosign",
	"cloudflared",
	"vitest",
	"ruff",
	"eslint",
	"agent-browser",
	"agentation",
	"mermaid-cli",
	"markdownlint-cli2",
	"wrangler",
	"beautiful-mermaid",
	"semgrep",
	"semver",
	"trivy",
	"rsearch",
	"wsearch",
] as const;

export const REQUIRED_TOOLING_BINARIES = [
	"pnpm",
	"node",
	"jq",
	"make",
	"rg",
	"fd",
	"prek",
	"diagram",
	"mise",
	"vale",
	"argos",
	"cosign",
	"cloudflared",
	"vitest",
	"ruff",
	"eslint",
	"agent-browser",
	"agentation-mcp",
	"mmdc",
	"markdownlint-cli2",
	"wrangler",
	"beautiful-mermaid",
	"semgrep",
	"semver",
	"trivy",
	"rsearch",
	"wsearch",
] as const;

export const PROJECT_MISE_REQUIRED_TOOLS = [
	["node", "24.13.1"],
	["pnpm", "10.33.0"],
	["python", "3.12"],
	["uv", "0.11.3"],
	["cargo:prek", REQUIRED_PREK_VERSION],
	["npm:@brainwav/diagram", "1.0.8"],
	["npm:@argos-ci/cli", "4.1.1"],
	["cosign", "3.0.5"],
	["cloudflared", "2026.3.0"],
	["npm:vitest", "4.0.18"],
	["ruff", "0.15.5"],
	["npm:eslint", "10.0.3"],
	["npm:agent-browser", "0.17.1"],
	["npm:agentation", "2.3.2"],
	["npm:agentation-mcp", "1.2.0"],
	["npm:@mermaid-js/mermaid-cli", "11.12.0"],
	["npm:@brainwav/rsearch", "0.1.6"],
	["npm:@brainwav/wsearch-cli", "0.1.9"],
	["npm:beautiful-mermaid", "1.1.3"],
	["npm:markdownlint-cli2", "0.21.0"],
	["npm:semver", "7.7.4"],
	["npm:wrangler", "4.69.0"],
	["semgrep", "1.153.1"],
	["trivy", "0.69.3"],
	["vale", "3.13.1"],
] as const;

export const REQUIRED_CODEX_TOOL_ACTIONS = [
	{
		name: "Prek",
		icon: "test",
		command: "command -v prek >/dev/null 2>&1\nprek --version",
	},
	{
		name: "Release Finalize",
		icon: "tool",
		command:
			'release_branch="${1:-}"\nif [ -z "$release_branch" ]; then\n  echo "Usage: Release Finalize <release-branch>"\n  echo "Example: Release Finalize codex/release-0.12.1-coherence"\n  exit 2\nfi\n\ncase "$release_branch" in\n  codex/release-*|release-*) ;;\n  *)\n    echo "Expected a release branch matching codex/release-* or release-*"\n    exit 2\n    ;;\nesac\n\ngit fetch --prune origin main "$release_branch"\ngit checkout main\nlocal_main_ahead_count="$(git rev-list --count origin/main..HEAD)"\nif [ "$local_main_ahead_count" -ne 0 ]; then\n  echo "Local main is ahead of origin/main; aborting."\n  echo "Reconcile local commits before running Release Finalize."\n  exit 2\nfi\nif git pull --ff-only origin main; then\n  :\nelse\n  pull_status=$?\n  local_main_ahead_count="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"\n  if [ "$local_main_ahead_count" -ne 0 ]; then\n    echo "Local main is ahead of origin/main; aborting."\n    echo "Reconcile local commits before running Release Finalize."\n    exit 2\n  fi\n  exit "$pull_status"\nfi\n\ngit merge --ff-only "origin/$release_branch"\ngit push origin main\n\necho "Merged $release_branch into main and pushed origin/main."\necho "Optional PR follow-up:"\necho "  gh pr list --state open --head \\"$release_branch\\" --json number,url"\necho "  gh pr comment <number> --body \\"Published to npm and merged into main.\\""\necho "  gh pr close <number> --delete-branch=false"',
	},
	{
		name: "Diagram",
		icon: "tool",
		command: "command -v diagram >/dev/null 2>&1\ndiagram --help",
	},
	{
		name: "Ralph",
		icon: "debug",
		command: "command -v ralph >/dev/null 2>&1\nralph --help",
	},
	{
		name: "Mise",
		icon: "tool",
		command: "command -v mise >/dev/null 2>&1\nmise install",
	},
	{
		name: "Vale",
		icon: "debug",
		command: "command -v vale >/dev/null 2>&1\nvale --version",
	},
	{
		name: "Argos",
		icon: "test",
		command: "command -v argos >/dev/null 2>&1\nargos --help",
	},
	{
		name: "Cosign",
		icon: "debug",
		command: "command -v cosign >/dev/null 2>&1\ncosign version",
	},
	{
		name: "Cloudflared",
		icon: "run",
		command: "command -v cloudflared >/dev/null 2>&1\ncloudflared --version",
	},
	{
		name: "Vitest",
		icon: "test",
		command: "command -v vitest >/dev/null 2>&1\nvitest --version",
	},
	{
		name: "Ruff",
		icon: "debug",
		command: "command -v ruff >/dev/null 2>&1\nruff --version",
	},
	{
		name: "ESLint",
		icon: "debug",
		command: "command -v eslint >/dev/null 2>&1\neslint --version",
	},
	{
		name: "Agent Browser",
		icon: "tool",
		command: "command -v agent-browser >/dev/null 2>&1\nagent-browser --help",
	},
	{
		name: "Agentation",
		icon: "tool",
		command: "command -v agentation-mcp >/dev/null 2>&1\nagentation-mcp --help",
	},
	{
		name: "Mermaid CLI",
		icon: "tool",
		command: "command -v mmdc >/dev/null 2>&1\nmmdc --help",
	},
	{
		name: "MarkdownLint",
		icon: "debug",
		command:
			"command -v markdownlint-cli2 >/dev/null 2>&1\nmarkdownlint-cli2 --help",
	},
	{
		name: "Wrangler",
		icon: "run",
		command: "command -v wrangler >/dev/null 2>&1\nwrangler --help",
	},
	{
		name: "1Password",
		icon: "tool",
		command: "command -v op >/dev/null 2>&1\nop --help",
	},
	{
		name: "Beautiful Mermaid",
		icon: "tool",
		command:
			"command -v beautiful-mermaid >/dev/null 2>&1\nbeautiful-mermaid --help",
	},
	{
		name: "Auth0",
		icon: "tool",
		command: "command -v auth0 >/dev/null 2>&1\nauth0 --help",
	},
	{
		name: "Semgrep",
		icon: "debug",
		command: "command -v semgrep >/dev/null 2>&1\nsemgrep --help",
	},
	{
		name: "Semver",
		icon: "tool",
		command: "command -v semver >/dev/null 2>&1\nsemver --help",
	},
	{
		name: "Trivy",
		icon: "debug",
		command: "command -v trivy >/dev/null 2>&1\ntrivy --help",
	},
	{
		name: "Gitleaks",
		icon: "debug",
		command: "command -v gitleaks >/dev/null 2>&1\ngitleaks --help",
	},
	{
		name: "Research",
		icon: "tool",
		command: "command -v rsearch >/dev/null 2>&1\nrsearch --help",
	},
	{
		name: "WSearch",
		icon: "tool",
		command: "command -v wsearch >/dev/null 2>&1\nwsearch --help",
	},
] as const;

export const REQUIRED_CODEX_ACTION_PAIRS = [
	{ name: "Tools", icon: "tool" },
	{ name: "Run", icon: "run" },
	{ name: "Debug", icon: "debug" },
	{ name: "Test", icon: "test" },
	...REQUIRED_CODEX_TOOL_ACTIONS.map(({ name, icon }) => ({ name, icon })),
] as const;

export const REQUIRED_MAKEFILE_TARGETS = [
	"help",
	"install",
	"setup",
	"preflight",
	"worktree-ready",
	"verify-work",
	"codestyle",
	"hooks",
	"hooks-pre-commit",
	"hooks-pre-push",
	"hooks-commit-msg",
	"secrets-staged",
	"docs-style-changed",
	"related-tests",
	"semgrep-changed",
	"diagrams-check",
	"lint",
	"docs-lint",
	"fmt",
	"typecheck",
	"test",
	"check",
	"audit",
	"secrets",
	"security",
	"clean",
	"reset",
	"ci",
	"diagrams",
	"env-check",
] as const;

export const REQUIRED_PROJECT_BRAIN_MEMORY_EXTENSION_PATHS = [
	".harness/memory/LEARNINGS.md",
	".harness/knowledge/INDEX.md",
	".harness/knowledge/cli/knowledge.md",
	".harness/knowledge/cli/hypotheses.md",
	".harness/knowledge/cli/rules.md",
	".harness/knowledge/ci/knowledge.md",
	".harness/knowledge/ci/hypotheses.md",
	".harness/knowledge/ci/rules.md",
	".harness/knowledge/governance/knowledge.md",
	".harness/knowledge/governance/hypotheses.md",
	".harness/knowledge/governance/rules.md",
	".harness/knowledge/tooling/knowledge.md",
	".harness/knowledge/tooling/hypotheses.md",
	".harness/knowledge/tooling/rules.md",
	".harness/knowledge/tooling/codex-learn-summary.md",
	".harness/decisions",
	".harness/quality/criteria.md",
	".harness/review-log.md",
] as const;

export const REQUIRED_HOOK_SUPPORT_FILES = [
	"scripts/codex-preflight.sh",
	"scripts/codex-preflight-local-memory-legacy.sh",
	"scripts/codex-learn",
	"scripts/codex-enforced",
	"scripts/verify-work.sh",
	"scripts/validate-codestyle.sh",
	"scripts/prepare-worktree.sh",
	"scripts/new-task.sh",
	"scripts/new-task-and-bootstrap.sh",
	"scripts/validate-commit-msg.js",
	"scripts/check-commit-msg.sh",
	"scripts/check-hook-critical-config-sync.sh",
	"scripts/check-staged-secrets.sh",
	"scripts/check-doc-style.sh",
	"scripts/check-related-tests.sh",
	"scripts/check-semgrep-changed.sh",
	"scripts/semgrep-pre-push.yml",
] as const;

export const TOOLING_CAPABILITY_DEPENDENCY_MARKERS = [
	{
		capability: "ui",
		dependencyMarkers: [
			"react",
			"react-dom",
			"next",
			"vite",
			"tailwindcss",
			"@storybook/react",
			"@storybook/react-vite",
			"@radix-ui/react-slot",
		],
	},
	{
		capability: "chatgpt_apps_sdk",
		dependencyMarkers: [
			"@openai/chatkit",
			"@openai/agents",
			"@openai/agents-realtime",
		],
	},
] as const;

export const REQUIRED_CONDITIONAL_PACKAGES = [
	{
		package: "@brainwav/design-system-guidance",
		dependencyType: "either",
		requiredWhenCapabilities: ["ui", "chatgpt_apps_sdk"],
	},
] as const;

export const DEFAULT_EXPLICIT_TOOLING_CAPABILITIES = [] as const;
