import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Typed package.json reader (avoids any from JSON.parse)
interface PackageJson {
	version: string;
}

function readPackageJson(path: string): PackageJson {
	const content = readFileSync(path, "utf-8");
	const data = JSON.parse(content) as unknown;
	if (typeof data !== "object" || data === null) {
		throw new Error("Invalid package.json: not an object");
	}
	if (!("version" in data) || typeof data.version !== "string") {
		throw new Error("Invalid package.json: missing or invalid version");
	}
	return { version: data.version };
}

let _cachedVersion: string | null = null;

/**
 * Get the current CLI version from package.json.
 * Cached after first read.
 */
export function getVersion(): string {
	if (_cachedVersion !== null) {
		return _cachedVersion;
	}

	// ESM-compatible way to get __dirname
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	// package.json is at the project root (relative to dist/lib/version.js)
	const pkgPath = join(__dirname, "..", "..", "package.json");
	const pkg = readPackageJson(pkgPath);
	_cachedVersion = pkg.version;
	return _cachedVersion;
}
