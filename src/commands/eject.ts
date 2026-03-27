import { type EjectOptions, ejectHarness } from "../lib/init/eject.js";

/**
 * Execute the eject command linearly.
 */
export async function runEjectCLI(
	targetDir: string | undefined,
	options: EjectOptions,
): Promise<number> {
	try {
		await ejectHarness(targetDir || process.cwd(), options);
		return 0;
	} catch (error) {
		console.error(
			"Eject Error:",
			error instanceof Error ? error.message : String(error),
		);
		return 1;
	}
}
