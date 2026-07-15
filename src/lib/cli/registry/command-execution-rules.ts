import type { CommandInvocationEffect } from "./command-invocation-effects.js";

/** Resource lanes used by the local execution coordinator. */
export type CommandResourceLane =
	| "repo-read"
	| "repo-write"
	| "validation"
	| "style"
	| "artifacts"
	| "runtime"
	| "git"
	| "external";

/** Execution scheduling metadata exposed alongside command capabilities. */
export interface CommandExecutionCapability {
	resourceLanes: CommandResourceLane[];
	parallelSafe: boolean;
	conflictsWith: CommandResourceLane[];
	timeoutSeconds: number;
	cancellable: boolean;
}

/** Map invocation effect classes to scheduler resource lanes. */
function lanesForEffects(
	effects: readonly CommandInvocationEffect[],
): CommandResourceLane[] {
	const lanes = new Set<CommandResourceLane>();
	for (const effect of effects) {
		for (const effectClass of effect.effectClasses) {
			if (effectClass === "pure_read") lanes.add("repo-read");
			if (effectClass === "writes_repository") lanes.add("repo-write");
			if (effectClass === "writes_artifact") lanes.add("artifacts");
			if (effectClass === "mutates_git") lanes.add("git");
			if (effectClass === "mutates_external") lanes.add("external");
		}
	}
	return [...lanes].toSorted();
}

/** Derive conservative scheduling metadata from the characterized effects. */
export function getCommandExecutionCapability(
	effects: readonly CommandInvocationEffect[],
	mutability: "read" | "write",
): CommandExecutionCapability {
	const resourceLanes = lanesForEffects(effects);
	if (resourceLanes.length === 0) resourceLanes.push("repo-read");
	const parallelSafe =
		mutability === "read" &&
		resourceLanes.every((lane) => lane === "repo-read");
	return {
		resourceLanes,
		parallelSafe,
		conflictsWith: parallelSafe ? [] : [...resourceLanes],
		timeoutSeconds: parallelSafe ? 300 : 900,
		cancellable: true,
	};
}
