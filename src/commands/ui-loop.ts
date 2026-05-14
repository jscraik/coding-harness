#!/usr/bin/env node
import {
	type UIEvidence,
	type UIExploreOptions,
	type UIFastOptions,
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
	const contractContext = getContractUILoopContext(contractPath);
	const policy = contractContext.policy;
	const executionContext: UIExecutionContext = {
		headSha: resolveHeadSha(),
		contractVersion: contractContext.contractVersion,
	};

	const resolved = resolveFastCommandSpec(options, policy, json);
	if (!resolved.ok) {
		return { exitCode: resolved.exitCode, message: resolved.message };
	}
	const { commandSpec, fullCmd, packageManager } = resolved;

	const execution =
		mode === "execute"
			? isExecutionDisabled(EXECUTION_DISABLE_ENV)
				? buildExecutionDisabledResult(
						EXIT_CODES.EXECUTION_DISABLED,
						EXECUTION_DISABLED_MESSAGE,
					)
				: executeCommand(commandSpec, 8000, true)
			: buildPrepareResult(EXIT_CODES.SUCCESS);
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
	const exitCode =
		artifact.exitCode === EXIT_CODES.EXECUTION_DISABLED
			? EXIT_CODES.EXECUTION_DISABLED
			: artifact.passed
				? EXIT_CODES.SUCCESS
				: EXIT_CODES.COMMAND_FAILED;

	if (json) {
		const payload = withExecutionDisabledError(
			{
				timestamp: artifact.timestamp,
				command: artifact.command,
				durationMs: artifact.durationMs,
				mode: artifact.mode,
				executed: artifact.executed,
				passed: artifact.passed,
				exitCode: artifact.exitCode,
				head_sha: artifact.headSha,
				contract_version: artifact.contractVersion,
				artifact_uri: artifact.artifactUri,
				artifact_checksum: artifact.artifactChecksum,
				...(artifact.timedOut ? { timedOut: true } : {}),
				...(artifact.stdout ? { stdout: artifact.stdout } : {}),
				...(artifact.stderr ? { stderr: artifact.stderr } : {}),
			},
			exitCode,
		);
		return {
			exitCode,
			message: JSON.stringify(payload),
			artifact,
		};
	}

	const statusLabel = artifact.passed ? "✓" : "✗";
	const message = `${statusLabel} UI fast ${mode} ${artifact.executed ? "executed" : "prepared"}\n  Command: ${fullCmd}\n  Duration: ${artifact.durationMs}ms\n  Package manager: ${packageManager}\n  Artifact: ${artifact.artifactUri}\n  Checksum: ${artifact.artifactChecksum}`;
	return {
		exitCode,
		message,
		artifact,
	};
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
	const contractContext = getContractUILoopContext(contractPath);
	const policy = contractContext.policy;
	const executionContext: UIExecutionContext = {
		headSha: resolveHeadSha(),
		contractVersion: contractContext.contractVersion,
	};

	const resolved = resolveVerifyCommandSpec(options, policy, json);
	if (!resolved.ok) {
		return { exitCode: resolved.exitCode, message: resolved.message };
	}
	const { commandSpec, fullCmd, packageManager } = resolved;

	const execution =
		mode === "execute"
			? isExecutionDisabled(EXECUTION_DISABLE_ENV)
				? buildExecutionDisabledResult(
						EXIT_CODES.EXECUTION_DISABLED,
						EXECUTION_DISABLED_MESSAGE,
					)
				: executeCommand(commandSpec, 10 * 60 * 1000)
			: buildPrepareResult(EXIT_CODES.SUCCESS);
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
	const exitCode =
		evidence.exitCode === EXIT_CODES.EXECUTION_DISABLED
			? EXIT_CODES.EXECUTION_DISABLED
			: evidence.passed
				? EXIT_CODES.SUCCESS
				: EXIT_CODES.COMMAND_FAILED;

	if (json) {
		const payload = withExecutionDisabledError(
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
				...(evidence.timedOut ? { timedOut: true } : {}),
				...(evidence.stdout ? { stdout: evidence.stdout } : {}),
				...(evidence.stderr ? { stderr: evidence.stderr } : {}),
			},
			exitCode,
		);
		return {
			exitCode,
			message: JSON.stringify(payload),
			evidence,
		};
	}

	const statusLabel = evidence.passed ? "✓" : "✗";
	const message = `${statusLabel} UI verify ${mode} ${evidence.executed ? "executed" : "prepared"}\n  Command: ${fullCmd}\n  Duration: ${evidence.durationMs}ms\n  Package manager: ${packageManager}\n  Artifact: ${evidence.artifactUri}\n  Checksum: ${evidence.artifactChecksum}`;
	return {
		exitCode,
		message,
		evidence,
	};
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
	const contractContext = getContractUILoopContext(contractPath);
	const policy = contractContext.policy;
	const executionContext: UIExecutionContext = {
		headSha: resolveHeadSha(),
		contractVersion: contractContext.contractVersion,
	};

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

	const execution =
		mode === "execute"
			? isExecutionDisabled(EXECUTION_DISABLE_ENV)
				? buildExecutionDisabledResult(
						EXIT_CODES.EXECUTION_DISABLED,
						EXECUTION_DISABLED_MESSAGE,
					)
				: executeCommand(commandSpec, 5 * 60 * 1000, true)
			: buildPrepareResult(EXIT_CODES.SUCCESS);
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
	const exitCode =
		evidence.exitCode === EXIT_CODES.EXECUTION_DISABLED
			? EXIT_CODES.EXECUTION_DISABLED
			: evidence.passed
				? EXIT_CODES.SUCCESS
				: EXIT_CODES.COMMAND_FAILED;

	if (json) {
		const payload = withExecutionDisabledError(
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
				url,
				outputDir,
				interactions: options.interactions ?? false,
				...(evidence.timedOut ? { timedOut: true } : {}),
				...(evidence.stdout ? { stdout: evidence.stdout } : {}),
				...(evidence.stderr ? { stderr: evidence.stderr } : {}),
			},
			exitCode,
		);
		return {
			exitCode,
			message: JSON.stringify(payload),
			evidence,
		};
	}

	const statusLabel = evidence.passed ? "✓" : "✗";
	const message = `${statusLabel} UI explore ${mode} ${evidence.executed ? "executed" : "prepared"}\n  Target: ${url}\n  Output: ${outputDir}\n  Command: ${fullCmd}\n  Interactions: ${options.interactions ? "enabled" : "disabled"}\n  Artifact: ${evidence.artifactUri}\n  Checksum: ${evidence.artifactChecksum}`;
	return {
		exitCode,
		message,
		evidence,
	};
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
