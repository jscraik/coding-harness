import { getFlagValue, parseIntegerArg } from "../cli/parse-utils.js";
import type { ObservabilityGateOptions } from "./types.js";

/** Convert raw observability-gate argv into the typed command contract. */
export function buildObservabilityGateOptionsFromCliArgs(
	args: string[],
): ObservabilityGateOptions {
	const options: ObservabilityGateOptions = {};

	if (args.includes("--json")) {
		options.json = true;
	}

	const labelsValue = getFlagValue(args, args.indexOf("--labels"));
	if (labelsValue) {
		options.labels = labelsValue;
	}

	const cardinalityValue = getFlagValue(
		args,
		args.indexOf("--max-cardinality"),
	);
	if (cardinalityValue) {
		const parsed = parseIntegerArg(cardinalityValue, 0);
		if (parsed !== undefined) {
			options.maxCardinality = parsed;
		}
	}

	const lengthValue = getFlagValue(args, args.indexOf("--max-length"));
	if (lengthValue) {
		const parsed = parseIntegerArg(lengthValue, 0);
		if (parsed !== undefined) {
			options.maxLength = parsed;
		}
	}

	return options;
}
