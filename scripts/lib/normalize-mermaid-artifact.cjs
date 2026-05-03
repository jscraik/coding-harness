"use strict";

const normalizeMermaidId = (id) => {
	const roleMatch = id.match(/(_(?:create|lookup|result|update|write))$/i);
	const roleSuffix = roleMatch?.[1] ?? "";
	const baseId = roleSuffix ? id.slice(0, -roleSuffix.length) : id;

	return `${baseId
		.replace(/(?:[_-](?:[a-f0-9]{6,}|[0-9]{4,}))+$/i, "")
		.replace(/(?:[_-][0-9]+)+$/i, "")}${roleSuffix}`;
};

const normalizeMermaidLine = (line) => {
	let value = line.trim();
	if (!value) return "";
	if (/^[+-][A-Za-z0-9_./-]+\.(?:[cm]?[jt]sx?|json|md|ya?ml)$/.test(value)) {
		return "";
	}

	value = value.replace(
		/^subgraph\s+([A-Za-z0-9_:-]+)(\s*(?:\[[^\]]+\])?)/,
		(_, id, rest) => `subgraph ${normalizeMermaidId(id)}${rest}`,
	);
	value = value.replace(
		/^([A-Za-z0-9_:-]+)(\s*(\[[^\]]+\]|\([^)]*\)|\{[^}]*\}))/,
		(_, id, rest) => `${normalizeMermaidId(id)}${rest}`,
	);
	value = value.replace(
		/^class\s+([A-Za-z0-9_:-]+)\s*\{$/,
		(_, id) => `class ${normalizeMermaidId(id)} {`,
	);
	value = value.replace(
		/\b(style|class|click)\s+([A-Za-z0-9_:-]+)\b/g,
		(_, command, id) => `${command} ${normalizeMermaidId(id)}`,
	);
	value = value.replace(
		/^([A-Za-z0-9_:-]+)(\s*[-.=]+.*)$/,
		(_, id, rest) => `${normalizeMermaidId(id)}${rest}`,
	);
	value = value.replace(
		/([-.=]+>|<[-.=]+)\s*([A-Za-z0-9_:-]+)/g,
		(_, arrow, id) => `${arrow} ${normalizeMermaidId(id)}`,
	);
	return value.replace(/\s+/g, " ").trim();
};

const canonicalizeMermaidLines = (lines) => {
	const topLevel = [];
	const blocks = [];
	let currentBlock = null;

	const flushBlock = () => {
		if (!currentBlock) return;
		blocks.push(
			[currentBlock.start, ...currentBlock.body.sort(), currentBlock.end].join(
				"\n",
			),
		);
		currentBlock = null;
	};

	for (const line of lines) {
		const normalizedLine = normalizeMermaidLine(line);
		if (!normalizedLine) continue;

		if (currentBlock) {
			if (normalizedLine === "end" || normalizedLine === "}") {
				currentBlock.end = normalizedLine;
				flushBlock();
			} else {
				currentBlock.body.push(normalizedLine);
			}
			continue;
		}

		if (
			/^subgraph\s+/.test(normalizedLine) ||
			/^class\s+.+\s\{$/.test(normalizedLine)
		) {
			currentBlock = { start: normalizedLine, body: [], end: "end" };
			continue;
		}

		topLevel.push(normalizedLine);
	}

	flushBlock();

	return `${[...topLevel.sort(), ...blocks.sort()].join("\n")}\n`;
};

const normalizeMermaidLines = (lines) => canonicalizeMermaidLines(lines);

const normalizeDiagramContextLines = (lines) => {
	const normalized = [];
	let inMermaid = false;
	let mermaidLines = [];

	const flushMermaid = () => {
		normalized.push("```mermaid");
		normalized.push(
			...canonicalizeMermaidLines(mermaidLines).trimEnd().split("\n"),
		);
		normalized.push("```");
		mermaidLines = [];
	};

	for (const line of lines) {
		if (/^Generated: /.test(line)) continue;
		if (line.trim() === "```mermaid") {
			inMermaid = true;
			mermaidLines = [];
			continue;
		}
		if (inMermaid && line.trim() === "```") {
			flushMermaid();
			inMermaid = false;
			continue;
		}
		if (inMermaid) {
			mermaidLines.push(line);
			continue;
		}
		normalized.push(line.trimEnd());
	}

	if (inMermaid) {
		flushMermaid();
	}

	return `${normalized.join("\n")}\n`;
};

module.exports = {
	normalizeDiagramContextLines,
	normalizeMermaidId,
	normalizeMermaidLine,
	normalizeMermaidLines,
};
