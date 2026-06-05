#!/usr/bin/env tsx
import { runDocsArchiveCandidatesCli } from "../src/lib/docs-surface/archive-candidates-cli.js";

process.exitCode = runDocsArchiveCandidatesCli(process.argv.slice(2), {
	stdout: process.stdout,
	stderr: process.stderr,
});
