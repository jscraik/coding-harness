import type { CommandAgentCatalogMode } from "./command-capabilities.js";

const AGENT_ORIENT_COMMAND_NAMES = [
	"next",
	"agent-readiness",
	"agent-native-ratchets",
	"agent-rework",
	"governance-decision-surface",
	"runtime-card",
	"reviewer-decision",
	"session-context",
	"session-distill",
	"commands",
] as const;
const AGENT_VERIFY_COMMAND_NAMES = [
	"next",
	"check",
	"runtime-card",
	"validation-plan",
	"fitness",
	"evidence-verify",
] as const;
const AGENT_REVIEW_COMMAND_NAMES = [
	"next",
	"runtime-card",
	"review-gate",
	"review-context",
] as const;
const AGENT_HANDOFF_COMMAND_NAMES = [
	"next",
	"runtime-card",
	"decision-request",
	"pr-closeout",
	"evidence-verify",
] as const;

export const AGENT_CATALOG_COMMAND_NAMES: Readonly<
	Record<"default" | CommandAgentCatalogMode, readonly string[]>
> = {
	default: [
		...new Set([
			...AGENT_ORIENT_COMMAND_NAMES,
			...AGENT_VERIFY_COMMAND_NAMES,
			...AGENT_REVIEW_COMMAND_NAMES,
			...AGENT_HANDOFF_COMMAND_NAMES,
		]),
	],
	orient: AGENT_ORIENT_COMMAND_NAMES,
	verify: AGENT_VERIFY_COMMAND_NAMES,
	review: AGENT_REVIEW_COMMAND_NAMES,
	handoff: AGENT_HANDOFF_COMMAND_NAMES,
};

export const FIRST_CONTACT_COMMAND_NAMES = new Set<string>(["next"]);
