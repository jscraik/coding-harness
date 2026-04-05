export interface UILoopCommandSpec {
	command: string;
	args: string[];
}

export type UILoopCommandValidationResult =
	| { ok: true; value: UILoopCommandSpec }
	| { ok: false; error: string };

const LEADING_ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=.*/;

export function parseUILoopCommandSpec(
	command: string,
): UILoopCommandValidationResult {
	const trimmed = command.trim();
	if (trimmed.length === 0) {
		return { ok: false, error: "command must not be empty" };
	}
	if (/[\n\r\0]/.test(trimmed)) {
		return {
			ok: false,
			error: "command contains unsupported control characters",
		};
	}
	if (/["'\\]/.test(trimmed)) {
		return {
			ok: false,
			error:
				"quoted or escaped command tokens are not supported; use simple argv-safe tokens",
		};
	}
	const tokens = trimmed.split(/\s+/).filter((token) => token.length > 0);
	if (tokens.length === 0) {
		return { ok: false, error: "command must include an executable" };
	}
	if (LEADING_ENV_ASSIGNMENT.test(tokens[0] ?? "")) {
		return {
			ok: false,
			error:
				"leading environment variable assignments are not supported; set env outside the command or wrap the command in a script",
		};
	}
	return {
		ok: true,
		value: {
			command: tokens[0] ?? "",
			args: tokens.slice(1),
		},
	};
}

export function isValidUILoopCommandSpec(command: unknown): command is string {
	return typeof command === "string" && parseUILoopCommandSpec(command).ok;
}
