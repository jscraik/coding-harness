import {
	executionArtifactLabel,
	LocalExecutionCoordinator,
} from "../lib/execution/local-coordinator.js";
import { parseExecutionRunOptions } from "../lib/execution/execution-run-options.js";

export {
	parseExecutionRunOptions,
	type ExecutionRunOptions,
} from "../lib/execution/execution-run-options.js";

/** Execute one local command through the conflict-aware coordinator. */
export async function runExecutionCLI(
	args: readonly string[],
): Promise<number> {
	const parsed = parseExecutionRunOptions(args);
	if (!parsed.ok) {
		console.error(`Execution Run Error: ${parsed.message}`);
		return 2;
	}
	const handle = new LocalExecutionCoordinator().run(parsed.options);
	const result = await handle.result;
	if (parsed.options.json) {
		console.info(JSON.stringify(result));
	} else {
		console.info(`${result.status}: ${parsed.options.command.join(" ")}`);
		console.info(`Result: ${executionArtifactLabel(result)}`);
		if (result.status !== "pass") console.info(result.nextAction);
	}
	return result.status === "pass" ? 0 : 1;
}
