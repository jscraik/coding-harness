import { runLinearAction } from "./linear-command-actions.js";
import {
	collectLinearCommandFlags,
	parseLinearAction,
	validateLinearValueFlags,
} from "./linear-command-options.js";

/** Run the Linear workflow command from parsed registry arguments. */
export function runLinearCommand(args: string[]) {
	const action = parseLinearAction(args);
	if (action === undefined) return 2;
	const validationResult = validateLinearValueFlags(args);
	if (validationResult !== undefined) return validationResult;
	return runLinearAction(action, args, collectLinearCommandFlags(args));
}
