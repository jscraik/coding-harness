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

const normalizeMermaidLines = (lines) =>
	`${lines.map(normalizeMermaidLine).filter(Boolean).sort().join("\n")}\n`;

const normalizeDiagramContextLines = (lines) => {
	const normalized = [];
	let inMermaid = false;
	let mermaidLines = [];

	const flushMermaid = () => {
		normalized.push("```mermaid");
		normalized.push(
			...mermaidLines.map(normalizeMermaidLine).filter(Boolean).sort(),
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
