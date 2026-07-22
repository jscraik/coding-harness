import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Patch one checked-in example while preserving the manifest's other entries. */
export function manifestWithExamplePatch(
	root: string,
	schemaVersion: string,
	patchExample: (example: Record<string, unknown>) => Record<string, unknown>,
): string {
	const manifest = JSON.parse(
		readFileSync("contracts/runtime-packet-schemas.manifest.json", "utf8"),
	) as { packets: Record<string, unknown>[] };
	const sourceEntry = manifest.packets.find(
		(entry) => entry.schemaVersion === schemaVersion,
	);
	if (!sourceEntry || typeof sourceEntry.examplePath !== "string")
		throw new Error(`missing manifest entry for ${schemaVersion}`);
	const example = patchExample(
		structuredClone(
			JSON.parse(readFileSync(sourceEntry.examplePath, "utf8")) as Record<
				string,
				unknown
			>,
		),
	);
	const examplePath = join(root, "patched-example.json");
	writeFileSync(examplePath, JSON.stringify(example, null, 2));
	const patched = {
		...manifest,
		packets: manifest.packets.map((entry) =>
			entry.schemaVersion === schemaVersion
				? {
						...entry,
						examplePath: relative(process.cwd(), examplePath),
					}
				: entry,
		),
	};
	const manifestPath = join(root, "runtime-packet-schemas.manifest.json");
	writeFileSync(manifestPath, JSON.stringify(patched, null, 2));
	return manifestPath;
}
