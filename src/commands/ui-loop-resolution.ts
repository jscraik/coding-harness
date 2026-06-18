import type { UILoopPolicy } from "../lib/contract/types.js";
import type { UIFastOptions, UIVerifyOptions } from "./ui-loop-shared.js";
import { hasUnsafeShellChars } from "./ui-loop-shared.js";
import {
	appendForwardedArgsToPolicyCommand,
	formatCommandDisplay,
	parseCommandSpec,
	type CommandSpec,
} from "./ui-loop-command-spec.js";
import { EXIT_CODES } from "./ui-loop-exit-codes.js";
import {
	buildScriptCommand,
	detectPackageManager,
	hasPlaywright,
	hasStorybook,
} from "./ui-loop-tooling.js";

type ResolveFailure = { ok: false; exitCode: number; message: string };

type ResolveSuccess = {
	ok: true;
	commandSpec: CommandSpec;
	fullCmd: string;
};

type ManagedResolveSuccess = ResolveSuccess & { packageManager: string };

function validationFailure(message: string, json: boolean): ResolveFailure {
	return {
		ok: false,
		exitCode: EXIT_CODES.VALIDATION_ERROR,
		message: json
			? JSON.stringify({ error: message, code: "VALIDATION_ERROR" })
			: message,
	};
}

function notFoundFailure(message: string, json: boolean): ResolveFailure {
	return {
		ok: false,
		exitCode: EXIT_CODES.NOT_FOUND,
		message: json
			? JSON.stringify({ error: message, code: "NOT_FOUND" })
			: message,
	};
}

function invalidPolicyMessage(policyKey: string, reason: string): string {
	return `Invalid uiLoopPolicy.${policyKey}: ${reason}`;
}

function resolvePolicyCommand(
	command: string,
	policyKey: string,
	forwardedArgs: string[],
	json: boolean,
): ResolveSuccess | ResolveFailure {
	if (hasUnsafeShellChars(command)) {
		return validationFailure(
			invalidPolicyMessage(policyKey, "unsafe shell characters"),
			json,
		);
	}
	const parsedPolicyCommand = parseCommandSpec(command);
	if (!parsedPolicyCommand.ok) {
		return validationFailure(
			invalidPolicyMessage(policyKey, parsedPolicyCommand.error),
			json,
		);
	}
	const commandSpec = appendForwardedArgsToPolicyCommand(
		parsedPolicyCommand.value,
		forwardedArgs,
	);
	return {
		ok: true,
		commandSpec,
		fullCmd: formatCommandDisplay(commandSpec),
	};
}

function fastForwardedArgs(options: UIFastOptions): string[] {
	return [
		...(options.ci ? ["--ci"] : []),
		...(typeof options.port === "number"
			? ["--port", String(options.port)]
			: []),
	];
}

function verifyArgs(options: UIVerifyOptions): string[] {
	const args: string[] = ["test"];
	if (options.shard) {
		args.push(`--shard=${options.shard}`);
	}
	if (typeof options.timeout === "number" && Number.isFinite(options.timeout)) {
		args.push(`--timeout=${options.timeout}`);
	}
	if (options.outputDir) {
		args.push(`--output=${options.outputDir}`);
	}
	return args;
}

/** Resolve the command spec for ui:fast. */
export function resolveFastCommandSpec(
	options: UIFastOptions,
	policy: UILoopPolicy | undefined,
	json: boolean,
): ManagedResolveSuccess | ResolveFailure {
	if (policy?.fastCommand) {
		const resolved = resolvePolicyCommand(
			policy.fastCommand,
			"fastCommand",
			fastForwardedArgs(options),
			json,
		);
		return resolved.ok ? { ...resolved, packageManager: "contract" } : resolved;
	}
	if (!hasStorybook()) {
		return notFoundFailure(
			"Storybook not found. Ensure .storybook/ directory exists.",
			json,
		);
	}
	const pm = detectPackageManager();
	const commandSpec = buildScriptCommand(
		pm,
		"storybook",
		fastForwardedArgs(options),
	);
	return {
		ok: true,
		commandSpec,
		fullCmd: formatCommandDisplay(commandSpec),
		packageManager: pm.name,
	};
}

/** Resolve the command spec for ui:verify. */
export function resolveVerifyCommandSpec(
	options: UIVerifyOptions,
	policy: UILoopPolicy | undefined,
	json: boolean,
): ManagedResolveSuccess | ResolveFailure {
	const args = verifyArgs(options);
	if (policy?.verifyCommand) {
		const resolved = resolvePolicyCommand(
			policy.verifyCommand,
			"verifyCommand",
			args,
			json,
		);
		return resolved.ok ? { ...resolved, packageManager: "contract" } : resolved;
	}
	if (!hasPlaywright()) {
		return notFoundFailure(
			"Playwright not found. Ensure playwright.config.{js,ts,mjs} exists.",
			json,
		);
	}
	const pm = detectPackageManager();
	const commandSpec = buildScriptCommand(pm, "playwright", args);
	return {
		ok: true,
		commandSpec,
		fullCmd: formatCommandDisplay(commandSpec),
		packageManager: pm.name,
	};
}

/** Resolve the command spec for ui:explore. */
export function resolveExploreCommandSpec(
	policy: UILoopPolicy | undefined,
	url: string,
	outputDir: string,
	interactionArgs: string[],
	json: boolean,
): ResolveSuccess | ResolveFailure {
	if (policy?.exploreCommand) {
		return resolvePolicyCommand(
			policy.exploreCommand,
			"exploreCommand",
			[url, outputDir, ...interactionArgs],
			json,
		);
	}
	const commandSpec: CommandSpec = {
		command: "npx",
		args: [
			"@agent-browser/cli",
			"explore",
			url,
			"--output",
			outputDir,
			...interactionArgs,
		],
	};
	return { ok: true, commandSpec, fullCmd: formatCommandDisplay(commandSpec) };
}
