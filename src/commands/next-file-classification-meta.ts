import type { ChangedFileClassification } from "./next-file-classification.js";

/** Build optional changed-file classification metadata for next decisions. */
export function changedFileClassificationMeta(
	classification: ChangedFileClassification | undefined,
): Record<string, unknown> {
	return classification
		? {
				changedFileClassification: classification.byCategory,
				validationFileCount: classification.validationFiles.length,
				excludedChangedFiles: classification.excludedFiles,
				exclusionReasons: classification.exclusionReasons,
			}
		: {};
}
