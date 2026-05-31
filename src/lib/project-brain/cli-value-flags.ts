/** Project Brain flags that consume the following token as a value. */
export const BRAIN_VALUE_FLAGS = new Set(
	"--content --dir --domain --files --query --rationale --severity --threshold-days --type".split(
		" ",
	),
);
