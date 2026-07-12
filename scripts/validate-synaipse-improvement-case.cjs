#!/usr/bin/env node
const {
	runFile,
	validateImprovementCase,
} = require("./lib/synaipse-contract-validators.cjs");

runFile(process.argv[2], validateImprovementCase, "synaipse-improvement-case");
