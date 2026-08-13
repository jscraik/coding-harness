# Init module

`src/lib/init/` implements `harness init`: CLI argument parsing, target
inspection, scaffold selection, contract rendering, and rollback-aware writes.
The public command stays in `src/commands/init.ts`; command registration stays
in `src/lib/cli/registry/init-command-spec.ts`.

## Minimal mode

`init --minimal` emits only `harness.contract.json`. The contract records the
schema version plus explicit empty CI-check and review-check selections. It
does not infer a tracker, workflow, memory system, hooks, docs site, or policy
pack. Consumers recognize that exact raw shape and report their optional
review, CI, and tracker routes as not applicable rather than silently loading
full defaults.

`projectType` may be included when the caller explicitly selects or detects a
supported type. Any other policy belongs to an explicit standard or full
contract, not the minimal scaffold.

The public CLI reference documents the five routine jobs only. Internal
workflow-contract fixtures must not force install guidance to describe
unselected migration or governance operations.

The repository-owned public-release workflow at
`.github/workflows/release-private-npm.yml` must run `sudo apt-get update`, `sudo
apt-get install --yes
--no-install-recommends ripgrep`, and `rg --version` before its selected check
command. Each command must succeed; the release workflow owner must fix any
failure before validation continues.

Generated downstream `release-private-npm.yml` scaffolds remain private by
default and use restricted publish commands. This module documentation must not
be read as a public-publication contract for generated consumer repositories.
The generated CircleCI template keeps its bootstrap executor on mise's
precompiled Python path with `MISE_PYTHON_COMPILE=false`; changes to that
template must preserve the checked-in CircleCI configuration and their focused
tests in parity.

## Change boundaries

- Keep scaffold templates, the compact-contract predicate, loader behavior, and
  their focused tests aligned.
- Preserve target path safety and rollback behavior. Relative in-repository
  symlinks are allowed; absolute or escaping links are blocked.
- Run `pnpm exec vitest run src/lib/init/scaffold.test.ts
  src/lib/init/scaffold-contract-template.test.ts` for focused init behavior,
  then `pnpm exec vitest run src/lib/contract/compact-minimal.test.ts` for the
  compact-contract boundary. Each command must pass; otherwise the owner of the
  changed init or contract path fixes the failing behavior and reruns that
  command.
- When operator-facing scaffold behavior changes, run
  `bash scripts/run-harness-gate.sh docs-gate --mode required --json`. It must
  pass; otherwise follow its diagnostic to correct the affected documentation
  before rerunning the gate.
- Keep the checked-in pre-push hook and its generated template aligned. The
  hook may continue only when docs-gate has zero errors and every warning is
  the explicit `docs-gate.docs:archive-candidates.docs.archive_candidates.advisory`
  category; documentation drift and every other gate failure remain blocking.
- Generated routine validation guidance must keep Local Memory out of routine
  execution. Preserve `--mode required` only for an explicit Local Memory
  diagnostic or acceptance lane, and keep the source and template scripts in
  byte-for-byte sync.
