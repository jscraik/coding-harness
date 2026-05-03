const { createHash } = require("node:crypto");
const { readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

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

const stableId = (prefix, value) => {
	const slug =
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "")
			.slice(0, 48) || prefix;
	const digest = createHash("sha1").update(value).digest("hex").slice(0, 8);
	return `${prefix}_${slug}_${digest}`;
};

const stableRawIdentity = (rawId) =>
	rawId
		.replace(/(?:[_-](?:[a-f0-9]{6,}|[0-9]{4,})){1,2}$/i, "")
		.replace(/(?:[_-][0-9]+)+$/i, "")
		.toLowerCase();

const parseArchitecture = (content) => {
	const lines = content.trimEnd().split(/\r?\n/);
	const subgraphs = [];
	let currentSubgraph = null;

	for (const line of lines) {
		const subgraphMatch = line.match(/^ {2}subgraph (\S+)\["(.+)"\]$/);
		if (subgraphMatch) {
			currentSubgraph = {
				rawId: subgraphMatch[1],
				label: subgraphMatch[2],
				nodes: [],
			};
			subgraphs.push(currentSubgraph);
			continue;
		}

		if (line === "  end") {
			currentSubgraph = null;
			continue;
		}

		const nodeMatch = line.match(/^ {4}(\S+)\["(.+)"\]$/);
		if (nodeMatch && currentSubgraph) {
			currentSubgraph.nodes.push({
				rawId: nodeMatch[1],
				label: nodeMatch[2],
			});
		}
	}

	return subgraphs;
};

const buildArchitecture = (subgraphs) => {
	const nodeMap = new Map();
	const lines = ["graph TD"];
	const sortedSubgraphs = [...subgraphs].sort(
		(left, right) =>
			left.label.localeCompare(right.label) ||
			stableRawIdentity(left.rawId).localeCompare(
				stableRawIdentity(right.rawId),
			),
	);

	for (const subgraph of sortedSubgraphs) {
		const subgraphId = stableId(
			"sg",
			`${subgraph.label}/${stableRawIdentity(subgraph.rawId)}`,
		);
		lines.push(`  subgraph ${subgraphId}["${subgraph.label}"]`);
		const sortedNodes = [...subgraph.nodes].sort(
			(left, right) =>
				left.label.localeCompare(right.label) ||
				stableRawIdentity(left.rawId).localeCompare(
					stableRawIdentity(right.rawId),
				),
		);
		for (const node of sortedNodes) {
			const nodeId = stableId(
				"node",
				`${subgraph.label}/${node.label}/${stableRawIdentity(node.rawId)}`,
			);
			nodeMap.set(node.rawId, { canonicalId: nodeId, label: node.label });
			lines.push(`    ${nodeId}["${node.label}"]`);
		}
		lines.push("  end");
	}

	return {
		content: ensureTrailingNewline(lines.join("\n")),
		nodeMap,
	};
};

const buildDependency = (content, nodeMap) => {
	const lines = content.trimEnd().split(/\r?\n/);
	if (lines.length === 0) {
		return ensureTrailingNewline(content);
	}

	const externalNodeMap = new Map();
	const dependencyEdges = [];
	const styleEntries = [];

	for (const line of lines.slice(1)) {
		const edgeMatch = line.match(/^ {2}(\S+)\["(.+)"\] --> (\S+)$/);
		if (edgeMatch) {
			const [, rawSourceId, sourceLabel, rawTargetId] = edgeMatch;
			const target = nodeMap.get(rawTargetId) ?? {
				canonicalId: stableId("node", rawTargetId),
				label: rawTargetId,
			};
			const sourceCanonicalId =
				externalNodeMap.get(rawSourceId) ?? stableId("ext", sourceLabel);
			externalNodeMap.set(rawSourceId, sourceCanonicalId);
			dependencyEdges.push({
				line: `  ${sourceCanonicalId}["${sourceLabel}"] --> ${target.canonicalId}`,
				sortKey: `${sourceLabel}::${target.label}`,
			});
			continue;
		}

		const styleMatch = line.match(/^ {2}style (\S+) (.+)$/);
		if (styleMatch) {
			const [, rawNodeId, styleSpec] = styleMatch;
			const canonicalId = externalNodeMap.get(rawNodeId);
			if (canonicalId) {
				styleEntries.push({
					line: `  style ${canonicalId} ${styleSpec}`,
					sortKey: canonicalId,
				});
			}
		}
	}

	return ensureTrailingNewline(
		[
			"graph LR",
			...dependencyEdges
				.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
				.map((entry) => entry.line),
			...styleEntries
				.sort((left, right) => left.sortKey.localeCompare(right.sortKey))
				.map((entry) => entry.line),
		].join("\n"),
	);
};

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
			generatedAt: new Date().toISOString(),
			rootPath: rootDir,
			diagramDir: ".diagram",
			diagrams,
		},
		null,
		2,
	)}\n`,
);
