#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sourceManifestPath = "codestyle/CHECKSUMS.sha256";
const templateManifestPath = "src/templates/codestyle/CHECKSUMS.sha256";

const manifestHeader = [
	"# sha256 manifest for codestyle parity enforcement",
	"# format: <sha256>  <relative-path-from-repo-root>",
];

const hashFile = (path) =>
	createHash("sha256").update(readFileSync(path)).digest("hex");

const manifestPaths = readFileSync(sourceManifestPath, "utf8")
	.split(/\r?\n/)
	.map((line) => line.replace(/#.*/, "").trim())
	.filter(Boolean)
	.map((line) => {
		const match = /^(?<hash>[a-f0-9]{64})\s+(?<path>.+)$/.exec(line);
		if (!match?.groups?.path) {
			throw new Error(`Malformed codestyle checksum manifest line: ${line}`);
		}
		return match.groups.path;
	});

if (manifestPaths.length === 0) {
	throw new Error(`No codestyle paths found in ${sourceManifestPath}`);
}

const renderManifest = (basePath = "") => [
	...manifestHeader,
	...manifestPaths.map((relativePath) => {
		const hash = hashFile(
			basePath ? join(basePath, relativePath) : relativePath,
		);
		return `${hash}  ${relativePath}`;
	}),
	"",
];

writeFileSync(sourceManifestPath, renderManifest().join("\n"));
writeFileSync(templateManifestPath, renderManifest("src/templates").join("\n"));

process.stdout.write(
	`[codestyle-checksums] updated ${manifestPaths.length} entry manifest(s): ${sourceManifestPath}, ${templateManifestPath}\n`,
);
