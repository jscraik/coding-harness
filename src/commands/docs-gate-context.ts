import { resolve } from "node:path";
import { isAgentFirstStatusCadenceRegistration } from "./docs-gate-cadence.js";
import {
	buildExecutionContext,
	resolveChangedFiles,
} from "./docs-gate-files.js";
import type {
	ChangedFilesResolution,
	DocsGateExecutionContext,
	DocsGateMode,
	DocsGateOptions,
} from "./docs-gate-types.js";

/** Fully resolved inputs for one docs-gate evaluation. */
export interface RunContext {
	mode: DocsGateMode;
	repoRoot: string;
	changedFiles: string[];
	deletedFiles: Set<string>;
	resolution: ChangedFilesResolution;
	executionContext: DocsGateExecutionContext;
	cadenceRegistration: boolean;
}

/** Resolve the file and cadence context that one docs-gate invocation evaluates. */
export function buildRunContext(options: DocsGateOptions): RunContext {
	const mode = options.mode ?? "advisory";
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const resolution = resolveChangedFiles(options, repoRoot);
	return {
		mode,
		repoRoot,
		changedFiles: resolution.changedFiles,
		deletedFiles: new Set(resolution.deletedFiles),
		resolution,
		cadenceRegistration: isAgentFirstStatusCadenceRegistration(
			options,
			repoRoot,
			resolution,
		),
		executionContext: buildExecutionContext(
			options,
			undefined,
			resolution.source,
		),
	};
}
