import { loadManifest } from "./rollback.js";
import {
	type CIProvider,
	EXIT_CODES,
	type InitOptions,
	type InitResult,
	MANIFEST_FILE,
	type RestoreManifest,
} from "./types.js";

/**
 * Validate mutually exclusive init mode flags.
 */
export function validateModeExclusivity(
	options: InitOptions,
): InitResult | null {
	if (options.migrate && options.dryRun) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "--migrate cannot be combined with --dry-run.",
			},
		};
	}

	if (options.migrate && options.interactive) {
		return {
			ok: false,
			error: {
				code: "INVALID_PATH",
				message: "--migrate cannot be combined with --interactive.",
			},
		};
	}

	if (options.update && options.track) {
		return {
			ok: false,
			error: {
				code: "INVALID_OPTIONS",
				message:
					"--update cannot be combined with --track. Use `harness upgrade --dry-run` for existing installs, or run `harness init --track` separately when bootstrapping tracked files.",
			},
		};
	}

	if (
		options.update &&
		(options.minimal !== undefined || options.issueTracker !== undefined)
	) {
		return {
			ok: false,
			error: {
				code: "INVALID_OPTIONS",
				message:
					"--update reuses the tracked scaffold configuration and cannot be combined with --minimal or --issue-tracker. Re-run without those flags.",
			},
		};
	}

	return null;
}

/**
 * Probe for an existing manifest when reusing tracked provider state.
 */
export function probeManifest(
	dir: string,
	options: InitOptions,
	requestedCiProvider: CIProvider,
): {
	existingManifest: RestoreManifest | null;
	ciProvider: CIProvider;
	error?: InitResult;
} {
	const shouldReuseTrackedProvider =
		!options.ciProvider &&
		(options.rollback || options.checkUpdates || options.update);
	if (!shouldReuseTrackedProvider) {
		return { existingManifest: null, ciProvider: requestedCiProvider };
	}
	const manifestProbeResult = loadManifest(dir, {
		requireMetadata: options.update === true,
		operation: options.update
			? "update"
			: options.rollback
				? "rollback"
				: "check-updates",
		preferredCiProvider: requestedCiProvider,
	});
	if (!manifestProbeResult.ok) {
		if (
			options.update &&
			options.dryRun &&
			manifestProbeResult.error.path === MANIFEST_FILE &&
			manifestProbeResult.error.message.includes("No restore manifest found")
		) {
			return { existingManifest: null, ciProvider: requestedCiProvider };
		}
		if (options.rollback || options.update) {
			return {
				existingManifest: null,
				ciProvider: requestedCiProvider,
				error: manifestProbeResult,
			};
		}
		return { existingManifest: null, ciProvider: requestedCiProvider };
	}
	return {
		existingManifest: manifestProbeResult.value,
		ciProvider: manifestProbeResult.value.ciProvider ?? requestedCiProvider,
	};
}

/**
 * Map an init error code to a process exit code.
 */
export function getExitCodeFromError(error: { code: string }): number {
	if (error.code === "PATH_TRAVERSAL") {
		return EXIT_CODES.PATH_TRAVERSAL;
	}
	if (error.code === "WRITE_ERROR" || error.code === "INCOMPLETE_MANIFEST") {
		return EXIT_CODES.WRITE_ERROR;
	}
	return EXIT_CODES.INVALID_PATH;
}
