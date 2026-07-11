#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

const root = process.cwd();
const docsRoot = resolve(root, "docs/public");
const required = [
	".gitbook.yaml",
	"docs/public/README.md",
	"docs/public/SUMMARY.md",
];
const findings = [];
for (const path of required)
	if (!existsSync(resolve(root, path))) findings.push(`${path}: missing`);
const gitbookConfigPath = resolve(root, ".gitbook.yaml");
if (existsSync(gitbookConfigPath)) {
	const normalizedConfig = readFileSync(gitbookConfigPath, "utf8")
		.replace(/\r\n/g, "\n")
		.trim();
	const expectedConfig = [
		"root: ./docs/public/",
		"",
		"structure:",
		"  readme: README.md",
		"  summary: SUMMARY.md",
	].join("\n");
	if (normalizedConfig !== expectedConfig)
		findings.push(
			".gitbook.yaml: publication root or structure differs from the governed public-docs contract",
		);
}
const collect = (directory) =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isSymbolicLink()) {
			findings.push(`${relative(root, path)}: symbolic links are prohibited`);
			return [];
		}
		return entry.isDirectory() ? collect(path) : [path];
	});
if (existsSync(docsRoot)) {
	const forbidden = [
		[/\/Users\//, "workstation path"],
		[/00-LLM Wiki/i, "private registry name"],
		[/project-context/i, "private context path"],
		[/\.harness\//, "repository control-plane path"],
		[/privacy:\s*(confidential|restricted)/i, "private classification"],
		[/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/, "private key material"],
	];
	for (const file of collect(docsRoot))
		for (const [pattern, label] of forbidden)
			if (pattern.test(readFileSync(file, "utf8")))
				findings.push(`${relative(root, file)}: ${label}`);
	const summaryPath = resolve(docsRoot, "SUMMARY.md");
	if (existsSync(summaryPath))
		for (const match of readFileSync(summaryPath, "utf8").matchAll(
			/\]\(([^)]+\.md)\)/g,
		)) {
			const link = match[1];
			const target = resolve(dirname(summaryPath), normalize(link));
			if (relative(docsRoot, target).startsWith(".."))
				findings.push(`SUMMARY.md: path escapes public root: ${link}`);
			else if (!existsSync(target))
				findings.push(`SUMMARY.md: missing target: ${link}`);
		}
}
if (findings.length) {
	console.error(
		JSON.stringify(
			{ schema_version: "gitbook-readiness/v1", status: "fail", findings },
			null,
			2,
		),
	);
	process.exit(1);
}
console.log(
	JSON.stringify(
		{
			schema_version: "gitbook-readiness/v1",
			status: "pass",
			source: "docs/public",
		},
		null,
		2,
	),
);
