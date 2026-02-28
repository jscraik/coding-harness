export interface NormalizedInitError {
	message: string;
	unavailable: boolean;
}

const ABI_MISMATCH_HINT =
	"better-sqlite3 is incompatible with this Node.js runtime. Rebuild native modules for the active Node version (pnpm rebuild better-sqlite3) or reinstall dependencies (rm -rf node_modules && pnpm install).";

function extractAbiVersions(input: string): {
	built?: string;
	required?: string;
} {
	const built = input.match(
		/compiled against a different Node\.js version using NODE_MODULE_VERSION\s+(\d+)/i,
	)?.[1];
	const required = input.match(/requires NODE_MODULE_VERSION\s+(\d+)/i)?.[1];
	return {
		...(built ? { built } : {}),
		...(required ? { required } : {}),
	};
}

export function normalizeStoreInitError(
	rawMessage: string,
): NormalizedInitError {
	const message = rawMessage.trim();
	const lowered = message.toLowerCase();
	const hasNodeAbiSignals =
		lowered.includes("compiled against a different node.js version") &&
		lowered.includes("node_module_version");
	const isAbiMismatch =
		hasNodeAbiSignals &&
		(lowered.includes("better-sqlite3") ||
			lowered.includes("better_sqlite3") ||
			lowered.includes("better sqlite3") ||
			lowered.includes(".node"));

	if (!isAbiMismatch) {
		return {
			message,
			unavailable: false,
		};
	}

	const versions = extractAbiVersions(message);
	const versionHint =
		versions.built || versions.required
			? ` (built for NODE_MODULE_VERSION ${versions.built ?? "unknown"}, runtime expects ${versions.required ?? "unknown"})`
			: "";

	return {
		message: `Node.js ABI mismatch${versionHint}. ${ABI_MISMATCH_HINT}`,
		unavailable: true,
	};
}
