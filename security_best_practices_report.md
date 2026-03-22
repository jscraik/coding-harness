# Security Best Practices Report

## Executive Summary

Scope reviewed: recent TypeScript changes in `src/lib/init/scaffold.ts` and `src/commands/symphony-check.ts`.

Result: I found one high-confidence security issue in the workflow scaffold path. The generated `WORKFLOW.md` embeds repository metadata into a shell command without shell-safe escaping, which creates a command-injection risk if `package.json.repository` contains shell metacharacters. I did not find additional high-confidence security issues in the reviewed `symphony-check` path; that code now avoids FIFO hangs and does not echo secret values.

OWASP mapping:
- SBP-001 maps to OWASP Top 10 2025 `Injection`.

## High Severity Findings

### SBP-001: Unescaped repository metadata is interpolated into a generated shell command

Impact: A crafted `package.json.repository` value can execute unintended shell commands when an operator runs the scaffolded `after_create` workflow hook.

Evidence:
- [src/lib/init/scaffold.ts:236](/Users/jamiecraik/dev/coding-harness/src/lib/init/scaffold.ts#L236) returns most repository strings after lightweight normalization only. It strips `git+` and fragments and expands a few shorthands, but it does not reject or escape shell metacharacters.
- [src/lib/init/scaffold.ts:687](/Users/jamiecraik/dev/coding-harness/src/lib/init/scaffold.ts#L687) injects `repoUrl` directly into:

```sh
git clone --depth 1 "${repoUrl}" .
```

Why this is exploitable:
- Double quotes do not neutralize shell command substitution. Values containing `$(...)` or backticks are still evaluated by the shell.
- Example malicious metadata:

```json
{
  "repository": "https://github.com/acme/repo.git$(touch /tmp/harness-pwned)"
}
```

- With the current template, the generated hook would execute the `touch` command when run.

Recommended remediation:
- Apply shell-safe escaping before embedding repository values into shell snippets. This file already has a helper at [src/lib/init/scaffold.ts:61](/Users/jamiecraik/dev/coding-harness/src/lib/init/scaffold.ts#L61): `shellEscapeArg(...)`.
- Prefer generating:

```ts
git clone --depth 1 ${shellEscapeArg(repoUrl)} .
```

- Add a second defense layer by validating allowed repository URL forms before templating:
  - explicit `https://`
  - explicit `ssh://`
  - approved Git host shorthands that are normalized first
- Add regression tests for payloads containing `$(`, backticks, quotes, and newlines.

## Notes

- [src/commands/symphony-check.ts:69](/Users/jamiecraik/dev/coding-harness/src/commands/symphony-check.ts#L69) now treats `LINEAR_API_KEY` as availability-only and does not log values, which is the right default for a readiness command.
- [src/commands/symphony-check.ts:78](/Users/jamiecraik/dev/coding-harness/src/commands/symphony-check.ts#L78) skips non-regular files before reading env paths, which reduces local denial-of-service risk from named pipes such as `~/.codex/.env`.

## Suggested Next Step

Fix SBP-001 first, then add one focused regression test that proves a metacharacter-bearing `repository` value is rendered as a single safe shell argument in the generated workflow.
