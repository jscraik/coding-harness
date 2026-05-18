import { inspectFlagValue } from "../lib/cli/parse-utils.js";
import { validateHarnessArtifactRoutine } from "../lib/harness-artifact-routine.js";

const EXIT_CODES = {
	SUCCESS: 0,
	FAILURE: 1,
	USAGE: 2,
} as const;

/** Execute the artifact-handling routine gate for route-driving .harness inputs. */
export function runArtifactRoutineCLI(args: string[]): number {
	const json = args.includes("--json");
	const activeIndexFlag = inspectFlagValue(args, "--active-index");
	const repoRootFlag = inspectFlagValue(args, "--repo-root");
	const todayFlag = inspectFlagValue(args, "--today");
	const missingFlag = [
		{ flag: "--active-index", inspection: activeIndexFlag },
		{ flag: "--repo-root", inspection: repoRootFlag },
		{ flag: "--today", inspection: todayFlag },
	].find(({ inspection }) => inspection.missingValue);

	if (missingFlag) {
		return emitUsage(
			json,
			`harness artifact-routine requires a value after ${missingFlag.flag}.`,
		);
	}

	const options: Parameters<typeof validateHarnessArtifactRoutine>[0] = {};
	if (activeIndexFlag.value !== undefined) {
		options.activeIndexPath = activeIndexFlag.value;
	}
	if (repoRootFlag.value !== undefined) {
		options.repoRoot = repoRootFlag.value;
	}
	if (todayFlag.value !== undefined) {
		options.today = todayFlag.value;
	}

	const result = validateHarnessArtifactRoutine(options);

	if (json) {
		console.info(JSON.stringify(result, null, 2));
	} else if (result.status === "pass") {
		console.info("artifact-routine: pass");
	} else {
		console.error("artifact-routine: fail");
		for (const finding of result.findings) {
			console.error(`- ${finding.check}/${finding.code}: ${finding.message}`);
		}
	}

	return result.status === "pass" ? EXIT_CODES.SUCCESS : EXIT_CODES.FAILURE;
}

function emitUsage(json: boolean, message: string): number {
	if (json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "artifact-handling-routine/v1",
					status: "error",
					error: {
						code: "artifact-routine.flag_value_required",
						message,
					},
				},
				null,
				2,
			),
		);
	} else {
		console.error(`Error: ${message}`);
	}
	return EXIT_CODES.USAGE;
}
