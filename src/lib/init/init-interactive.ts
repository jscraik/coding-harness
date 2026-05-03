import { applyProposedChange, generateDiff } from "./interactive.js";
import type { ProposedChange } from "./types.js";

/**
 * Prompt user for each proposed change and collect approvals.
 */
export async function promptForChanges(
	proposedChanges: ProposedChange[],
): Promise<{
	approved: ProposedChange[];
	rejected: string[];
	cancelled: boolean;
}> {
	const { select, confirm } = await import("@inquirer/prompts");
	const approved: ProposedChange[] = [];
	const rejected: string[] = [];

	for (const change of proposedChanges) {
		let message: string;
		if (change.action === "create") {
			message = `${change.path} does not exist. Create?`;
		} else if (change.action === "modify") {
			message = `${change.path} exists. Overwrite?`;
		} else {
			rejected.push(change.path);
			continue;
		}

		try {
			const answer = await select({
				message,
				choices: [
					{ value: "yes", name: "Yes" },
					{ value: "no", name: "No" },
					{ value: "diff", name: "Show diff" },
				],
				default: change.action === "create" ? "yes" : "no",
			});

			if (answer === "diff") {
				console.info(`\n${generateDiff(change)}\n`);

				const confirmApply = await confirm({
					message: "Apply this change?",
					default: false,
				});

				if (confirmApply) {
					approved.push(change);
				} else {
					rejected.push(change.path);
				}
			} else if (answer === "yes") {
				approved.push(change);
			} else {
				rejected.push(change.path);
			}
		} catch (e) {
			if (e instanceof Error && e.name === "ExitPromptError") {
				console.info("\nCancelled by user");
				return { approved, rejected, cancelled: true };
			}
			throw e;
		}
	}

	return { approved, rejected, cancelled: false };
}

/**
 * Apply approved interactive changes and report per-file results.
 */
export function applyApprovedChanges(
	dir: string,
	approved: ProposedChange[],
): { applied: string[]; failed: string[] } {
	const applied: string[] = [];
	const failed: string[] = [];

	for (const change of approved) {
		const applyResult = applyProposedChange(dir, change);
		if (applyResult.ok) {
			applied.push(change.path);
			console.info(`  ✓ ${change.path}`);
		} else {
			failed.push(change.path);
			console.error(`  ✗ ${change.path}: ${applyResult.error.message}`);
		}
	}

	return { applied, failed };
}
