export const REQUIRED_FLAGS_BY_NAME: Partial<Record<string, string[]>> = {
	"blast-radius": ["--files"],
	"artifact-gate": ["--files"],
	"review-gate": ["--owner", "--repo", "--pr", "--sha"],
	"workflow:generate": ["--source"],
	"linear-gate": ["--branch", "--pr-title", "--pr-body"],
	"review-context": ["--files"],
	"validation-plan": ["--files"],
	"pattern-scope": ["--files"],
};
