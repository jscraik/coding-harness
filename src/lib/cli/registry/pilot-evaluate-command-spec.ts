import { getFlagValue, parseCsvList } from "../parse-utils.js";
import type { PilotEvaluateOptions } from "../../pilot-evaluation/types.js";
import type { CommandSpec } from "./types.js";

type PilotEvaluateRunner = (options: PilotEvaluateOptions) => number;

function validEnum<T extends string>(
	value: string | undefined,
	valid: readonly T[],
): T | undefined {
	return valid.includes(value as T) ? (value as T) : undefined;
}

function applyEnumOption<const Value extends string>(
	args: string[],
	flag: string,
	valid: readonly Value[],
	assign: (value: Value) => void,
): void {
	const value = validEnum(getFlagValue(args, args.indexOf(flag)), valid);
	if (value) assign(value);
}

/** Build the pilot-evaluate command adapter. */
export function createPilotEvaluateCommandSpec(
	runPilotEvaluateCLI: PilotEvaluateRunner,
): CommandSpec {
	return {
		name: "pilot-evaluate",
		summary: "Evaluate pilot gate safety criteria",
		example: "pilot-evaluate --artifacts artifacts/ --json",
		errorLabel: "Pilot Evaluate Error",
		execute: (args) => {
			const artifactsIndex = args.indexOf("--artifacts");
			const artifactsArg = getFlagValue(args, artifactsIndex);
			if (!artifactsArg) {
				console.error("Error: --artifacts is required");
				return 2;
			}

			const options: PilotEvaluateOptions = { artifactsDir: artifactsArg };
			applySimplePilotEvaluateOptions(options, args);
			applyModePilotEvaluateOptions(options, args);
			applyOverridePilotEvaluateOptions(options, args);
			return runPilotEvaluateCLI(options);
		},
	};
}

function applySimplePilotEvaluateOptions(
	options: PilotEvaluateOptions,
	args: string[],
): void {
	if (args.includes("--json")) options.json = true;
	if (args.includes("--kill-switch")) options.killSwitch = true;
	for (const [flag, field] of [
		["--contract", "contractPath"],
		["--output", "outputPath"],
		["--adapter-registry", "adapterRegistryPath"],
		["--metric-registry", "metricRegistryPath"],
		["--docs-gate-report", "docsGateReportPath"],
		["--pr-template-ref", "prTemplateRef"],
		["--actor-id", "actorId"],
		["--provider-id", "providerId"],
		["--model-descriptor", "modelDescriptor"],
	] as const) {
		const value = getFlagValue(args, args.indexOf(flag));
		if (value) options[field] = value;
	}
}

function applyModePilotEvaluateOptions(
	options: PilotEvaluateOptions,
	args: string[],
): void {
	applyEnumOption(args, "--lane", ["advisory", "health"], (value) => {
		options.lane = value;
	});
	applyEnumOption(
		args,
		"--evaluation-mode",
		["local", "pr", "merge_group"],
		(value) => {
			options.evaluationMode = value;
		},
	);
	applyEnumOption(
		args,
		"--rollout-stage",
		["shadow", "advisory", "enforced"],
		(value) => {
			options.rolloutStage = value;
		},
	);
	applyEnumOption(
		args,
		"--pr-template-status",
		["passed", "failed", "missing"],
		(value) => {
			options.prTemplateStatus = value;
		},
	);
	applyEnumOption(
		args,
		"--client-family",
		["codex", "claude_family", "gemini_family", "kimi_family", "custom"],
		(value) => {
			options.clientFamily = value;
		},
	);
	applyEnumOption(
		args,
		"--execution-mode",
		["interactive", "automation", "ci"],
		(value) => {
			options.executionMode = value;
		},
	);
	applyEnumOption(
		args,
		"--operator-type",
		["human_directed", "automation", "autonomous"],
		(value) => {
			options.operatorType = value;
		},
	);
}

function applyOverridePilotEvaluateOptions(
	options: PilotEvaluateOptions,
	args: string[],
): void {
	const principal = getFlagValue(
		args,
		args.indexOf("--override-authorized-principal"),
	);
	if (principal) options.overrideAuthorizedPrincipal = principal;
	const scope = getFlagValue(args, args.indexOf("--override-scope"));
	if (
		scope === "advisory_hold" ||
		scope === "temporary_unblock" ||
		scope === "temporary_promote"
	) {
		options.overrideScope = scope;
	}
	const reason = getFlagValue(args, args.indexOf("--override-reason"));
	if (reason) options.overrideReason = reason;
	const ticket = getFlagValue(args, args.indexOf("--override-ticket"));
	if (ticket) options.overrideTicketRef = ticket;
	const approvedBy = getFlagValue(args, args.indexOf("--override-approved-by"));
	if (approvedBy !== undefined)
		options.overrideApprovedBy = parseCsvList(approvedBy);
	const createdAt = getFlagValue(args, args.indexOf("--override-created-at"));
	if (createdAt) options.overrideCreatedAt = createdAt;
	const expiresAt = getFlagValue(args, args.indexOf("--override-expires-at"));
	if (expiresAt) options.overrideExpiresAt = expiresAt;
}
