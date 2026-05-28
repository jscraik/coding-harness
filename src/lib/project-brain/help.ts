const BRAIN_SUBCOMMANDS = [
	"status",
	"query",
	"add",
	"preflight",
	"stale",
	"lint",
] as const;

export const BRAIN_SUBCOMMAND_SET = new Set<string>(BRAIN_SUBCOMMANDS);

/** Render top-level Project Brain usage. */
export function renderBrainTopLevelHelp(): string {
	return `Usage: harness brain <subcommand> [options]

Subcommands:
  status              Health summary of Project Brain artifacts
  query               Search across knowledge, rules, and quality criteria
  add                 Capture a learning, decision, rule, or hypothesis
  preflight           Load relevant context for a set of changed files
  stale               Report staleness of Project Brain artifacts
  lint                Validate Project Brain metadata, citations, and wiki links

Options:
  --json              Output in JSON format
  --dir <path>        Target directory (default: current directory)
  --help, -h          Show this help

Examples:
  harness brain status --json
  harness brain query --query "vitest" --json
  harness brain add --type rule --domain cli --content "All commands must have --help"
  harness brain lint --json
  harness brain add --type learning --content "Biome requires tabs for JSON"
`;
}

/** Render Project Brain add usage. */
export function renderBrainAddHelp(): string {
	return [
		"Usage: harness brain add --type <type> --content <text> [options]",
		"",
		"Capture a learning, decision, rule, or hypothesis into Project Brain.",
		"",
		"Options:",
		"  --type <type>        learning | rule | hypothesis | decision",
		"  --content <text>     Content to capture",
		"  --domain <domain>    Required for rule and hypothesis",
		"  --severity <level>   Rule severity: must | should | may",
		"  --rationale <text>   Rule rationale when adding a rule",
		"  --dir <path>         Repository root (default: current directory)",
		"  --json               Output in JSON format",
		"  --help, -h           Show this help",
		"",
	].join("\n");
}

/** Render Project Brain preflight usage. */
export function renderBrainPreflightHelp(): string {
	return `Usage: harness brain preflight --files <path...> [options]

Load Project Brain context relevant to changed files before implementation or review.

Options:
  --files <path...>    Changed files to map into Brain domains
  --dir <path>         Repository root (default: current directory)
  --json               Output in JSON format
  --help, -h           Show this help
`;
}

/** Render Project Brain stale usage. */
export function renderBrainStaleHelp(): string {
	return `Usage: harness brain stale [options]

Report Project Brain knowledge files whose verification metadata is stale.

Options:
  --threshold-days <n> Non-negative staleness threshold (default: 30)
  --dir <path>         Repository root (default: current directory)
  --json               Output in JSON format
  --help, -h           Show this help
`;
}

/** Render command-owned Project Brain subcommand help. */
export function renderBrainSubcommandHelp(subcommand: string): string | null {
	switch (subcommand) {
		case "status":
			return "Usage: harness brain status [--json] [--dir <path>]\n";
		case "query":
			return "Usage: harness brain query --query <text> [--json] [--dir <path>]\n";
		case "add":
			return renderBrainAddHelp();
		case "preflight":
			return renderBrainPreflightHelp();
		case "stale":
			return renderBrainStaleHelp();
		case "lint":
			return "Usage: harness brain lint [--json] [--dir <path>]\n";
		default:
			return null;
	}
}
