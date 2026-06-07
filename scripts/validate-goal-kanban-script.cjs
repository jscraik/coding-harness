#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const vm = require("node:vm");

function usage() {
	console.error(
		"Usage: node scripts/validate-goal-kanban-script.cjs <html-path>",
	);
}

function main(argv) {
	const htmlPath = argv[2];
	if (!htmlPath) {
		usage();
		return 2;
	}

	let html;
	try {
		html = fs.readFileSync(htmlPath, "utf8");
	} catch (error) {
		console.error(`Failed to read ${htmlPath}: ${error.message}`);
		return 1;
	}

	const start = html.indexOf("<script>");
	const end = html.indexOf("</script>", start);
	if (start < 0 || end < 0 || end <= start) {
		console.error(`No inline <script> block found in ${htmlPath}`);
		return 1;
	}

	const script = html.slice(start + "<script>".length, end);
	try {
		new vm.Script(script, { filename: htmlPath });
	} catch (error) {
		console.error(
			`Inline script in ${htmlPath} failed to parse: ${error.message}`,
		);
		return 1;
	}

	console.log("PASS: goal kanban inline script parses");
	return 0;
}

process.exitCode = main(process.argv);
