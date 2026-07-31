import type { CommandVisibility } from "./command-capabilities.js";

export const COMMAND_VISIBILITY_BY_NAME: Partial<
	Record<string, CommandVisibility>
> = {
	next: "default",
	commands: "advanced",
	check: "advanced",
	init: "advanced",
	doctor: "advanced",
	contract: "advanced",
	"pr-closeout": "advanced",
	"review-context": "advanced",
	"validation-plan": "advanced",
	upgrade: "advanced",
	"ci-migrate": "advanced",
	"verify-work": "advanced",
};
