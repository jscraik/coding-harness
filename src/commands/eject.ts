import {
	EjectCancelledError,
	type EjectOptions,
	ejectHarness,
} from "../lib/init/eject.js";

/**
 * Execute the eject command linearly.
 */
export async function runEjectCLI(
	targetDir: string | undefined,
	options: EjectOptions,
): Promise<number> {
	try {
		const result = await ejectHarness(targetDir || process.cwd(), options);
		if (options.json) {
			console.info(JSON.stringify({ ok: true, ...result }, null, 2));
		}
		return 0;
	} catch (error) {
		if (options.json) {
			console.info(
				JSON.stringify(
					{
						ok: false,
						error: {
							code:
								error instanceof EjectCancelledError
									? "EJECT_CANCELLED"
									: "EJECT_ERROR",
							message: error instanceof Error ? error.message : String(error),
						},
					},
					null,
					2,
				),
			);
			return 1;
		}
		console.error(
			"Eject Error:",
			error instanceof Error ? error.message : String(error),
		);
		return 1;
	}
}
