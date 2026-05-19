import type { runReviewGateCLI } from "../../../commands/review-gate.js";
import {
	getFlagValue,
	inspectFlagValue,
	parseIntegerArg,
} from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type ReviewGateOptions = Parameters<typeof runReviewGateCLI>[0];
type FlagInspection = ReturnType<typeof inspectFlagValue>;
type ReviewGateFlagState = ReturnType<typeof inspectReviewGateFlags>;

/** Build the review-gate registry seam. */
export function createReviewGateCommandSpec(): CommandSpec {
	return {
		name: "review-gate",
		summary: "Review gate with SHA enforcement",
		example:
			"review-gate --token $GH_TOKEN --owner org --repo repo --pr 42 --sha 0123456789abcdef0123456789abcdef01234567 --json",
		errorLabel: "Review Gate Error",
		execute: runReviewGateCommand,
	};
}

function runReviewGateCommand(args: string[]): Promise<number> | number {
	const envToken =
		process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
	const flags = inspectReviewGateFlags(args);
	const flagStatus = validateReviewGateFlags(args, flags, envToken);
	if (flagStatus !== undefined) return flagStatus;
	const options = buildReviewGateOptions(args, flags, envToken);
	if (typeof options === "number") return options;

	return import("../../../commands/review-gate.js").then(
		({ runReviewGateCLI }) => runReviewGateCLI(options),
	);
}

function inspectReviewGateFlags(args: string[]) {
	return {
		tokenInspection: inspectFlagValue(args, "--token"),
		checkInspection: inspectFlagValue(args, "--check"),
		botLoginInspection: inspectFlagValue(args, "--bot-login"),
		contractInspection: inspectFlagValue(args, "--contract"),
		reviewContextInspection: inspectFlagValue(args, "--review-context"),
		reviewContextMaxAgeInspection: inspectFlagValue(
			args,
			"--review-context-max-age-minutes",
		),
	} as const;
}

function validateReviewGateFlags(
	args: string[],
	flags: ReviewGateFlagState,
	envToken: string | undefined,
): number | undefined {
	const { tokenInspection } = flags;
	if (tokenInspection.present && tokenInspection.missingValue) {
		console.error("Error: --token requires a value");
		return 2;
	}
	const optionalFlagStatus = validateReviewGateOptionalFlags(flags);
	if (optionalFlagStatus !== undefined) return optionalFlagStatus;
	return validateReviewGateRequiredFlags(args, flags, envToken);
}

function validateReviewGateRequiredFlags(
	args: string[],
	{ tokenInspection }: ReviewGateFlagState,
	envToken: string | undefined,
): number | undefined {
	const missingRequiredFlags: string[] = [];
	const resolvedToken = tokenInspection.value ?? envToken;
	const requiredFlagSpecs = [
		{ flag: "--owner", label: "owner" },
		{ flag: "--repo", label: "repo" },
		{ flag: "--pr", label: "pr" },
		{ flag: "--sha", label: "sha" },
	] as const;

	if (!resolvedToken) missingRequiredFlags.push("--token");
	for (const { flag, label } of requiredFlagSpecs) {
		const inspected = inspectFlagValue(args, flag);
		if (inspected.present && inspected.missingValue) {
			console.error(`Error: ${flag} requires a value`);
			return 2;
		}
		if (!inspected.value) missingRequiredFlags.push(`--${label}`);
	}
	if (missingRequiredFlags.length === 0) return undefined;
	console.error(
		`Error: missing required flags for review-gate: ${missingRequiredFlags.join(", ")}`,
	);
	return 2;
}

function validateReviewGateOptionalFlags({
	checkInspection,
	botLoginInspection,
	contractInspection,
	reviewContextInspection,
	reviewContextMaxAgeInspection,
}: {
	checkInspection: FlagInspection;
	botLoginInspection: FlagInspection;
	contractInspection: FlagInspection;
	reviewContextInspection: FlagInspection;
	reviewContextMaxAgeInspection: FlagInspection;
}): number | undefined {
	for (const { flag, inspected } of [
		{ flag: "--check", inspected: checkInspection },
		{ flag: "--bot-login", inspected: botLoginInspection },
		{ flag: "--contract", inspected: contractInspection },
		{ flag: "--review-context", inspected: reviewContextInspection },
		{
			flag: "--review-context-max-age-minutes",
			inspected: reviewContextMaxAgeInspection,
		},
	]) {
		if (inspected.present && inspected.missingValue) {
			console.error(`Error: ${flag} requires a value`);
			return 2;
		}
	}
	return undefined;
}

function buildReviewGateOptions(
	args: string[],
	flags: ReviewGateFlagState,
	envToken: string | undefined,
): ReviewGateOptions | number {
	const options: ReviewGateOptions = {
		token: flags.tokenInspection.value ?? envToken ?? "",
		owner: getFlagValue(args, args.indexOf("--owner")) ?? "",
		repo: getFlagValue(args, args.indexOf("--repo")) ?? "",
		prNumber: 0,
		headSha: getFlagValue(args, args.indexOf("--sha")) ?? "",
		checkName: "",
		contractPath: "harness.contract.json",
	};
	if (args.includes("--json")) options.json = true;
	const parsedPr = parseReviewGatePr(args);
	if (!parsedPr.ok) return parsedPr.status;
	options.prNumber = parsedPr.value;
	applyReviewGateOptionalOptions(options, args, flags);
	const strictReviewContextStatus = applyStrictReviewContextOptions(
		options,
		args,
		flags.reviewContextMaxAgeInspection,
	);
	return strictReviewContextStatus ?? options;
}

function parseReviewGatePr(
	args: string[],
): { ok: true; value: number } | { ok: false; status: 2 } {
	const prArg = getFlagValue(args, args.indexOf("--pr"));
	const parsedPr = prArg ? parseIntegerArg(prArg, 1) : undefined;
	if (parsedPr !== undefined) return { ok: true, value: parsedPr };
	console.error("Error: --pr expects a positive integer");
	return { ok: false, status: 2 };
}

function applyReviewGateOptionalOptions(
	options: ReviewGateOptions,
	args: string[],
	{
		checkInspection,
		botLoginInspection,
		contractInspection,
		reviewContextInspection,
	}: ReviewGateFlagState,
): void {
	if (checkInspection.value !== undefined)
		options.checkName = checkInspection.value;
	if (botLoginInspection.value !== undefined)
		options.botLogin = botLoginInspection.value;
	if (args.includes("--auto-resolve-bot-threads")) {
		options.autoResolveBotThreads = true;
	}
	if (contractInspection.value !== undefined) {
		options.contractPath = contractInspection.value;
	}
	if (reviewContextInspection.value !== undefined) {
		options.reviewContextPath = reviewContextInspection.value;
	}
}

function applyStrictReviewContextOptions(
	options: ReviewGateOptions,
	args: string[],
	reviewContextMaxAgeInspection: FlagInspection,
): number | undefined {
	if (args.includes("--require-review-context")) {
		options.requireReviewContext = true;
	}
	if (reviewContextMaxAgeInspection.value === undefined) {
		return undefined;
	}
	const parsedMaxAge = parseIntegerArg(reviewContextMaxAgeInspection.value, 1);
	if (parsedMaxAge === undefined) {
		console.error(
			"Error: --review-context-max-age-minutes expects a positive integer",
		);
		return 2;
	}
	options.reviewContextMaxAgeMinutes = parsedMaxAge;
	return undefined;
}
