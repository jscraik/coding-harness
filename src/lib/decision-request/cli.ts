import { inspectFlagList, inspectFlagValue } from "../cli/parse-utils.js";
import { buildDecisionRequest } from "./builder.js";
import type {
	DecisionRequestBuildInput,
	DecisionRequestOption,
	DecisionRequestPacket,
	DecisionRequestUsageError,
	DecisionRequestUsageErrorCode,
} from "./types.js";

const EXIT_CODES = {
	SUCCESS: 0,
	USAGE: 2,
} as const;

/** Run the read-only decision-request command from CLI arguments. */
export function runDecisionRequestCLI(args: string[]): number {
	const json = args.includes("--json");
	const scalarError = firstScalarFlagIssue(args, [
		"--intent",
		"--default-option",
		"--authority",
		"--status",
		"--freshness",
		"--boundary",
		"--expires-at",
		"--generated-at",
		"--producer",
		"--request-id",
		"--escalation-target",
		"--escalation-channel",
		"--escalation-reason",
	]);
	if (scalarError) {
		return emitUsage(json, scalarError.code, scalarError.message);
	}

	const options = parseOptions(args);
	if (!options.ok) return emitUsage(json, options.code, options.message);
	const tradeoffs = parseTradeoffs(args, options.options);
	if (!tradeoffs.ok) return emitUsage(json, tradeoffs.code, tradeoffs.message);

	const input: DecisionRequestBuildInput = {
		options: tradeoffs.options,
		evidenceRefs: inspectFlagList(args, "--evidence").values,
	};
	assignFlag(input, "intent", args, "--intent");
	assignFlag(input, "defaultOptionId", args, "--default-option");
	assignFlag(input, "authority", args, "--authority");
	assignFlag(input, "status", args, "--status");
	assignFlag(input, "freshness", args, "--freshness");
	assignFlag(input, "boundaryType", args, "--boundary");
	assignFlag(input, "expiresAt", args, "--expires-at");
	assignFlag(input, "generatedAt", args, "--generated-at");
	assignFlag(input, "producer", args, "--producer");
	assignFlag(input, "requestId", args, "--request-id");
	input.escalation = buildEscalationInput(args);

	const result = buildDecisionRequest(input);
	if (!result.ok) return emitUsage(json, result.code, result.message);

	if (json) {
		console.info(JSON.stringify(result.packet, null, 2));
	} else {
		emitHumanReport(result.packet);
	}
	return EXIT_CODES.SUCCESS;
}

function emitHumanReport(packet: DecisionRequestPacket): void {
	console.info(`decision-request: ${packet.status}`);
	console.info(`schema: ${packet.schemaVersion} (${packet.evidenceUse})`);
	console.info(`intent: ${packet.intent}`);
	console.info(`authority: ${packet.authority}`);
	console.info(`default option: ${packet.defaultOptionId}`);
	console.info(`freshness: ${packet.freshness}`);
	console.info(`claim support: ${packet.claimSupport}`);
	console.info(`boundary: ${packet.hiltBoundary.boundaryType}`);
	console.info(`blocker class: ${packet.hiltBoundary.blockerClass}`);
	console.info(
		`escalation: ${packet.escalation.targetRole} via ${packet.escalation.channel}`,
	);
	if (packet.staleState.length > 0) {
		console.info("stale state:");
		for (const state of packet.staleState) {
			console.info(
				`  - ${state.surface}: ${state.freshness} (${state.reason})`,
			);
		}
	}
}

function parseOptions(
	args: string[],
):
	| { ok: true; options: DecisionRequestOption[] }
	| { ok: false; code: DecisionRequestUsageErrorCode; message: string } {
	const optionList = collectRepeatedFlagValues(args, "--option");
	if (optionList.present && optionList.missingValue) {
		return {
			ok: false,
			code: "decision-request.flag_value_required",
			message: "--option requires a value.",
		};
	}

	const options: DecisionRequestOption[] = [];
	for (const rawOption of optionList.values) {
		const parsed = splitAssignment(rawOption);
		if (!parsed || parsed.key.length === 0 || parsed.value.length === 0) {
			return {
				ok: false,
				code: "decision-request.option_malformed",
				message: "--option must use id=label.",
			};
		}
		options.push({
			id: parsed.key,
			label: parsed.value,
			tradeoffs: [],
		});
	}
	return { ok: true, options };
}

function parseTradeoffs(
	args: string[],
	options: DecisionRequestOption[],
):
	| { ok: true; options: DecisionRequestOption[] }
	| { ok: false; code: DecisionRequestUsageErrorCode; message: string } {
	const tradeoffList = collectRepeatedFlagValues(args, "--tradeoff");
	if (tradeoffList.present && tradeoffList.missingValue) {
		return {
			ok: false,
			code: "decision-request.flag_value_required",
			message: "--tradeoff requires a value.",
		};
	}

	const byId = new Map(options.map((option) => [option.id, option]));
	for (const rawTradeoff of tradeoffList.values) {
		const parsed = splitAssignment(rawTradeoff);
		if (!parsed || parsed.key.length === 0 || parsed.value.length === 0) {
			return {
				ok: false,
				code: "decision-request.option_malformed",
				message: "--tradeoff must use optionId=text.",
			};
		}
		const option = byId.get(parsed.key);
		if (!option) {
			return {
				ok: false,
				code: "decision-request.tradeoff_unknown_option",
				message: "--tradeoff option id must match an emitted --option id.",
			};
		}
		option.tradeoffs.push(parsed.value);
	}
	return { ok: true, options };
}

function splitAssignment(
	value: string,
): { key: string; value: string } | undefined {
	const separatorIndex = value.indexOf("=");
	if (separatorIndex === -1) return undefined;
	return {
		key: value.slice(0, separatorIndex).trim(),
		value: value.slice(separatorIndex + 1).trim(),
	};
}

function collectRepeatedFlagValues(
	args: readonly string[],
	flag: string,
): { present: boolean; values: string[]; missingValue: boolean } {
	const values: string[] = [];
	let present = false;
	let missingValue = false;
	for (const [index, token] of args.entries()) {
		if (token !== flag) continue;
		present = true;
		const value = args[index + 1];
		if (value === undefined || value.startsWith("-")) {
			missingValue = true;
		} else {
			values.push(value);
		}
	}
	return { present, values, missingValue };
}

function buildEscalationInput(
	args: string[],
): NonNullable<DecisionRequestBuildInput["escalation"]> {
	const escalation: NonNullable<DecisionRequestBuildInput["escalation"]> = {};
	const targetRole = inspectFlagValue(args, "--escalation-target").value;
	const channel = inspectFlagValue(args, "--escalation-channel").value;
	const reason = inspectFlagValue(args, "--escalation-reason").value;
	if (targetRole !== undefined) escalation.targetRole = targetRole;
	if (channel !== undefined) escalation.channel = channel;
	if (reason !== undefined) escalation.reason = reason;
	return escalation;
}

function firstScalarFlagIssue(
	args: string[],
	flags: readonly string[],
): { code: DecisionRequestUsageErrorCode; message: string } | undefined {
	for (const flag of flags) {
		const matchCount = args.filter((token) => token === flag).length;
		if (matchCount > 1) {
			return {
				code: "decision-request.scalar_flag_duplicate",
				message: `${flag} can only be provided once.`,
			};
		}
		if (inspectFlagValue(args, flag).missingValue) {
			return {
				code: "decision-request.flag_value_required",
				message: `${flag} requires a value.`,
			};
		}
	}
	return undefined;
}

function assignFlag(
	input: DecisionRequestBuildInput,
	field: keyof DecisionRequestBuildInput,
	args: string[],
	flag: string,
): void {
	const value = inspectFlagValue(args, flag).value;
	if (value !== undefined) {
		Object.assign(input, { [field]: value });
	}
}

function emitUsage(
	json: boolean,
	code: DecisionRequestUsageError["error"]["code"],
	message: string,
): number {
	if (json) {
		const payload: DecisionRequestUsageError = {
			schemaVersion: "decision-request-error/v1",
			status: "error",
			error: { code, message },
		};
		console.info(JSON.stringify(payload, null, 2));
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}
