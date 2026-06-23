import type { CommandVisibility } from "./command-capabilities.js";
import {
	AGENT_NATIVE_PACKET_COMMAND_NAMES,
	mapCommands,
} from "./command-agent-native-capability-rules.js";

export const COMMAND_VISIBILITY_BY_NAME: Partial<
	Record<string, CommandVisibility>
> = {
	next: "default",
	"agent-readiness": "agent",
	commands: "advanced",
	check: "advanced",
	init: "advanced",
	...(mapCommands(AGENT_NATIVE_PACKET_COMMAND_NAMES, "advanced") as Partial<
		Record<string, CommandVisibility>
	>),
	"prompt-context-drift:write": "advanced",
	"prompt-context-drift:validate": "advanced",
	"decision-request": "advanced",
	doctor: "advanced",
	health: "advanced",
	fitness: "advanced",
	"fleet-plan": "advanced",
	"validation-plan": "advanced",
	"review-context": "advanced",
	"pattern-scope": "advanced",
	"artifact-routine": "advanced",
	"runtime-budget": "advanced",
	contract: "advanced",
	linear: "advanced",
	"review-gate": "plumbing",
	"pr-closeout": "advanced",
	"docs-gate": "plumbing",
};
