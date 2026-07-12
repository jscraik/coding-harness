#!/usr/bin/env node
const {
	runFile,
	validateTransition,
} = require("./lib/synaipse-contract-validators.cjs");

runFile(process.argv[2], validateTransition, "synaipse-transition");
