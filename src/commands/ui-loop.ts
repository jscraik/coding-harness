#!/usr/bin/env node
import {
	type CommandExecutionResult,
	type UIEvidence,
	type UIExploreOptions,
	type UIFastOptions,
	type UILoopMode,
	type UIVerifyOptions,
	buildExecutionDisabledResult,
	buildPrepareResult,
	isExecutionDisabled,
	resolveMode,
} from "./ui-loop-shared.js";
import {
	EXECUTION_DISABLE_ENV,
	EXECUTION_DISABLED_MESSAGE,
	EXIT_CODES,
	createEvidence,
	executeCommand,
	getContractUILoopContext,
	resolveFastCommandSpec,
	resolveExploreCommandSpec,
	resolveHeadSha,
	resolveVerifyCommandSpec,
	withExecutionDisabledError,
	type CommandSpec,
	type UIExecutionContext,
} from "./ui-loop-internal.js";
export type {
	UIEvidence,
	UIExploreOptions,
	UIFastOptions,
	UILoopMode,
	UIVerifyOptions,
} from "./ui-loop-shared.js";
export { EXIT_CODES } from "./ui-loop-internal.js";

type UICommandResult = {
	exitCode: number;
	message: string;
	artifact?: UIEvidence;
	evidence?: UIEvidence;
};

function uiExecutionContext(contractPath: string): {
	policy: ReturnType<typeof getContractUILoopContext>["policy"];
	executionContext: UIExecutionContext;
} {
	const contractContext = getContractUILoopContext(contractPath);
	return {
		policy: contractContext.policy,
		executionContext: {
			headSha: resolveHeadSha(),
			contractVersion: contractContext.contractVersion,
		},
	};
}

function executeOrPrepare(
	mode: UILoopMode,
	commandSpec: CommandSpec,
	timeoutMs: number,
	inheritStdio = false,
): CommandExecutionResult {
	if (mode !== "execute") return buildPrepareResult(EXIT_CODES.SUCCESS);
	if (isExecutionDisabled(EXECUTION_DISABLE_ENV)) {
		return buildExecutionDisabledResult(
			EXIT_CODES.EXECUTION_DISABLED,
			EXECUTION_DISABLED_MESSAGE,
		);
	}
	return executeCommand(commandSpec, timeoutMs, inheritStdio);
}

function exitCodeForEvidence(evidence: UIEvidence): number {
	if (evidence.exitCode === EXIT_CODES.EXECUTION_DISABLED) {
		return EXIT_CODES.EXECUTION_DISABLED;
	}
	return evidence.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.COMMAND_FAILED;
}

function jsonPayload(
	evidence: UIEvidence,
	exitCode: number,
	extra: Record<string, unknown> = {},
): string {
	return JSON.stringify(
		withExecutionDisabledError(
			{
				timestamp: evidence.timestamp,
				command: evidence.command,
				durationMs: evidence.durationMs,
				mode: evidence.mode,
				executed: evidence.executed,
				passed: evidence.passed,
				exitCode: evidence.exitCode,
				head_sha: evidence.headSha,
				contract_version: evidence.contractVersion,
				artifact_uri: evidence.artifactUri,
				artifact_checksum: evidence.artifactChecksum,
				...extra,
				...(evidence.timedOut ? { timedOut: true } : {}),
				...(evidence.stdout ? { stdout: evidence.stdout } : {}),
				...(evidence.stderr ? { stderr: evidence.stderr } : {}),
			},
			exitCode,
		),
	);
}

function humanMessage(
	label: string,
	mode: UILoopMode,
	evidence: UIEvidence,
	details: readonly string[],
): string {
	const statusLabel = evidence.passed ? "✓" : "✗";
	return [
		`${statusLabel} ${label} ${mode} ${evidence.executed ? "executed" : "prepared"}`,
		...details,
		`Artifact: ${evidence.artifactUri}`,
		`Checksum: ${evidence.artifactChecksum}`,
	]
		.map((line, index) => (index === 0 ? line : `  ${line}`))
		.join("\n");
}

function resultWithArtifact(
	evidence: UIEvidence,
	exitCode: number,
	message: string,
): UICommandResult {
	return { exitCode, message, artifact: evidence };
}

function resultWithEvidence(
	evidence: UIEvidence,
	exitCode: number,
	message: string,
): UICommandResult {
	return { exitCode, message, evidence };
}

/**
 * Run UI fast loop - Storybook-first local development
 */
export function runUIFast(options: UIFastOptions = {}): {
	exitCode: number;
	message: string;
	artifact?: UIEvidence;
} {
	const { json = false } = options;
	const mode = resolveMode(options.mode, options.dryRun);
	const contractPath = options.contractPath ?? "harness.contract.json";
	const { policy, executionContext } = uiExecutionContext(contractPath);

	const resolved = resolveFastCommandSpec(options, policy, json);
	if (!resolved.ok) {
		return { exitCode: resolved.exitCode, message: resolved.message };
	}
	const { commandSpec, fullCmd, packageManager } = resolved;
	const execution = executeOrPrepare(mode, commandSpec, 8000, true);
	const artifact = createEvidence(
		"ui:fast",
		mode,
		fullCmd,
		execution,
		{
			port: options.port ?? 6006,
			ci: options.ci ?? false,
			packageManager,
		},
		executionContext,
	);
	const exitCode = exitCodeForEvidence(artifact);

	if (json) {
		return resultWithArtifact(
			artifact,
			exitCode,
			jsonPayload(artifact, exitCode),
		);
	}
	const message = humanMessage("UI fast", mode, artifact, [
		`Command: ${fullCmd}`,
		`Duration: ${artifact.durationMs}ms`,
		`Package manager: ${packageManager}`,
	]);
	return resultWithArtifact(artifact, exitCode, message);
}

/**
 * Run UI verify - Playwright smoke suite with evidence
 */
export function runUIVerify(options: UIVerifyOptions = {}): {
	exitCode: number;
	message: string;
	evidence?: UIEvidence;
} {
	const { json = false } = options;
	const mode = resolveMode(options.mode, options.dryRun);
	const contractPath = options.contractPath ?? "harness.contract.json";
	const { policy, executionContext } = uiExecutionContext(contractPath);

	const resolved = resolveVerifyCommandSpec(options, policy, json);
	if (!resolved.ok) {
		return { exitCode: resolved.exitCode, message: resolved.message };
	}
	const { commandSpec, fullCmd, packageManager } = resolved;
	const execution = executeOrPrepare(mode, commandSpec, 10 * 60 * 1000);
	const evidence = createEvidence(
		"ui:verify",
		mode,
		fullCmd,
		execution,
		{
			outputDir: options.outputDir,
			shard: options.shard,
			timeout: options.timeout,
			packageManager,
		},
		executionContext,
	);
	const exitCode = exitCodeForEvidence(evidence);

	if (json) {
		return resultWithEvidence(
			evidence,
			exitCode,
			jsonPayload(evidence, exitCode),
		);
	}
	const message = humanMessage("UI verify", mode, evidence, [
		`Command: ${fullCmd}`,
		`Duration: ${evidence.durationMs}ms`,
		`Package manager: ${packageManager}`,
	]);
	return resultWithEvidence(evidence, exitCode, message);
}

/**
 * Run UI explore - Agent browser exploratory testing
 */
export function runUIExplore(options: UIExploreOptions = {}): {
	exitCode: number;
	message: string;
	evidence?: UIEvidence;
} {
	const { json = false } = options;
	const mode = resolveMode(options.mode, options.dryRun);
	const contractPath = options.contractPath ?? "harness.contract.json";
	const { policy, executionContext } = uiExecutionContext(contractPath);

	const url = options.url ?? "http://localhost:3000";
	const outputDir = options.outputDir ?? "./ui-explore-output";
	const interactionArgs = options.interactions ? ["--interactions"] : [];

	const resolved = resolveExploreCommandSpec(
		policy,
		url,
		outputDir,
		interactionArgs,
		json,
	);
	if (!resolved.ok) {
		return { exitCode: resolved.exitCode, message: resolved.message };
	}
	const { commandSpec, fullCmd } = resolved;
	const execution = executeOrPrepare(mode, commandSpec, 5 * 60 * 1000, true);
	const evidence = createEvidence(
		"ui:explore",
		mode,
		fullCmd,
		execution,
		{
			url,
			outputDir,
			interactions: options.interactions ?? false,
		},
		executionContext,
	);
	const exitCode = exitCodeForEvidence(evidence);

	if (json) {
		return resultWithEvidence(
			evidence,
			exitCode,
			jsonPayload(evidence, exitCode, {
				url,
				outputDir,
				interactions: options.interactions ?? false,
			}),
		);
	}
	const message = humanMessage("UI explore", mode, evidence, [
		`Target: ${url}`,
		`Output: ${outputDir}`,
		`Command: ${fullCmd}`,
		`Interactions: ${options.interactions ? "enabled" : "disabled"}`,
	]);
	return resultWithEvidence(evidence, exitCode, message);
}

/**
 * CLI entry point for ui:fast
 */
export function runUIFastCLI(options: UIFastOptions = {}): number {
	return printCLIResult(runUIFast(options));
}

/**
 * CLI entry point for ui:verify
 */
export function runUIVerifyCLI(options: UIVerifyOptions = {}): number {
	return printCLIResult(runUIVerify(options));
}

/**
 * CLI entry point for ui:explore
 */
export function runUIExploreCLI(options: UIExploreOptions = {}): number {
	return printCLIResult(runUIExplore(options));
}

function printCLIResult(result: { exitCode: number; message: string }): number {
	if (result.exitCode === EXIT_CODES.SUCCESS) {
		console.info(result.message);
	} else {
		console.error(result.message);
	}
	return result.exitCode;
}
