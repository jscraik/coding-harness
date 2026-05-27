import type { CommandAgentCatalogMode } from "./command-capabilities.js";

export const AGENT_CATALOG_COMMAND_NAMES: Readonly<
	Record<"default" | CommandAgentCatalogMode, readonly string[]>
> = {
	default: ["next"],
	orient: [
		"next",
		"agent-readiness",
		"runtime-card",
		"session-context",
		"commands",
	],
	verify: ["next", "runtime-card", "validation-plan", "evidence-verify"],
	review: ["next", "runtime-card", "review-gate", "review-context"],
	handoff: [
		"next",
		"runtime-card",
		"decision-request",
		"pr-closeout",
		"evidence-verify",
	],
};

export const FIRST_CONTACT_COMMAND_NAMES = new Set<string>(
	AGENT_CATALOG_COMMAND_NAMES.default,
);
