const { readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const {
	parseArchitecture,
	buildArchitecture,
	buildDependency,
} = require("./lib/diagram-utils.cjs");

const rootDir = process.env.ROOT_DIR;
const tmpDir = process.env.TMP_DIR;
const manifestPath = process.env.MANIFEST_PATH;

if (!rootDir || !tmpDir || !manifestPath) {
	throw new Error(
		"diagram manifest generation requires ROOT_DIR, TMP_DIR, and MANIFEST_PATH",
	);
}

const diagramsDir = join(tmpDir, "diagrams");
const ensureTrailingNewline = (content) =>
	content.endsWith("\n") ? content : `${content}\n`;

const diagramFiles = readdirSync(diagramsDir).filter((entry) =>
	entry.endsWith(".mmd"),
);
const architecturePath = join(diagramsDir, "architecture.mmd");
const dependencyPath = join(diagramsDir, "dependency.mmd");

if (diagramFiles.includes("architecture.mmd")) {
	const architectureContent = readFileSync(architecturePath, "utf8");
	const { content: canonicalArchitecture, nodeMap } = buildArchitecture(
		parseArchitecture(architectureContent),
	);
	writeFileSync(architecturePath, canonicalArchitecture);

	if (diagramFiles.includes("dependency.mmd")) {
		const dependencyContent = readFileSync(dependencyPath, "utf8");
		writeFileSync(dependencyPath, buildDependency(dependencyContent, nodeMap));
	}
} else if (diagramFiles.includes("dependency.mmd")) {
	console.info(
		`dependency.mmd exists at ${dependencyPath} but architecture.mmd is missing; applying only whitespace normalization because no nodeMap is available`,
	);
	const dependencyContent = readFileSync(dependencyPath, "utf8");
	writeFileSync(
		dependencyPath,
		ensureTrailingNewline(dependencyContent.trimEnd()),
	);
}

for (const file of diagramFiles) {
	if (file === "architecture.mmd" || file === "dependency.mmd") {
		continue;
	}
	const filePath = join(diagramsDir, file);
	writeFileSync(
		filePath,
		ensureTrailingNewline(readFileSync(filePath, "utf8").trimEnd()),
	);
}

const diagrams = readdirSync(diagramsDir)
	.filter((file) => file.endsWith(".mmd"))
	.sort()
	.map((file) => {
		const content = readFileSync(join(diagramsDir, file), "utf8");
		return {
			type: file.replace(/\.mmd$/, ""),
			file,
			outputPath: `.diagram/${file}`,
			lines: content.split(/\r?\n/).length,
			bytes: Buffer.byteLength(content),
			isPlaceholder:
				/placeholder/i.test(content) ||
				/not enough/i.test(content) ||
				/limited to/i.test(content),
		};
	});

writeFileSync(
	manifestPath,
	`${JSON.stringify(
		{
			diagramDir: ".diagram",
			diagrams,
		},
		null,
		2,
	)}\n`,
);