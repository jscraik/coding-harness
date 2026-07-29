import type { CommandAgentCatalogMode } from "./command-capabilities.js";

const AGENT_ORIENT_COMMAND_NAMES = ["next"] as const;
const AGENT_VERIFY_COMMAND_NAMES = ["next", "check", "verify-work"] as const;
const AGENT_REVIEW_COMMAND_NAMES = ["next", "pr-closeout"] as const;
const AGENT_HANDOFF_COMMAND_NAMES = ["next", "pr-closeout"] as const;

export const AGENT_CATALOG_COMMAND_NAMES: Readonly<
	Record<"default" | CommandAgentCatalogMode, readonly string[]>
> = {
	default: ["next", "check", "init", "verify-work", "pr-closeout"],
	orient: AGENT_ORIENT_COMMAND_NAMES,
	verify: AGENT_VERIFY_COMMAND_NAMES,
	review: AGENT_REVIEW_COMMAND_NAMES,
	handoff: AGENT_HANDOFF_COMMAND_NAMES,
};

export const FIRST_CONTACT_COMMAND_NAMES = new Set<string>(["next"]);
