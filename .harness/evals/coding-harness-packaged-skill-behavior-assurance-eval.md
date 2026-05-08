# Coding Harness Packaged Skill Behavior Assurance Eval

## Table of Contents

- [Status](#status)
- [Source Artifacts](#source-artifacts)
- [IU-283-001 Evidence](#iu-283-001-evidence)
- [Packaged Artifact Identity](#packaged-artifact-identity)
- [Payload Manifest Check](#payload-manifest-check)
- [Packaged CLI Invocation Check](#packaged-cli-invocation-check)
- [Reference Validator Gap](#reference-validator-gap)
- [IU-283-002 Reference Resolution Evidence](#iu-283-002-reference-resolution-evidence)
- [IU-283-003 Clean Repo Fixture Evidence](#iu-283-003-clean-repo-fixture-evidence)
- [IU-283-004 Update And Ownership Fixture Evidence](#iu-283-004-update-and-ownership-fixture-evidence)
- [Closure Limits](#closure-limits)
- [IU-283-005 Closure Evidence Package](#iu-283-005-closure-evidence-package)
- [Validation Log](#validation-log)
- [Next Required Slice](#next-required-slice)

## Status

Status: closure evidence recorded; release-gate promotion remains advisory.

This artifact records executable proof for `JSC-283` packaged skill behavior.
The local closure fixture set passes against one final candidate tarball, but
release-gate promotion should wait until the closure runner itself is automated
and committed rather than remaining an ad hoc evidence procedure.

## Source Artifacts

- Spec: `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md`
- Plan: `.harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md`
- Plan review: `.harness/review/2026-05-08-JSC-283-packaged-skill-behavior-assurance-plan-technical-review.md`
- Linear plan: `.harness/linear/coding-harness-linear-plan.md`

## IU-283-001 Evidence

Implementation unit: `IU-283-001 - Fixture Matrix And Proof Policy`.

Outcome:

- Static packaged skill validation still passes.
- Current build still produces a tarball.
- Required skill payload paths are present inside the tarball.
- Raw tarball extraction is not a valid packaged CLI invocation path because
  runtime dependencies are absent from an extracted package tree.
- Isolated local-tarball installation is mechanically possible, but CLI launch
  currently fails before behavior fixtures can run because the package imports
  `typescript` at runtime while `typescript` is only declared as a
  devDependency.
- This phase therefore proves the payload identity and exposes the first
  closure blocker; it does not complete behavior assurance.

## Packaged Artifact Identity

Current source commit:

```text
9d1c51e92cdf6aa55b76c61cd1e45149b86b3c2d
```

Local tarball:

```text
/private/tmp/jsc283-work-pack.kZNJY8/brainwav-coding-harness-0.15.1.tgz
```

Tarball SHA-256:

```text
e842aa2205786c8564a49101d678b094cf82e7964eb0db930c4ad0a1837ac8f3
```

This hash is phase evidence only. Closure-eligible fixture runs must record a
fresh tarball hash and must prove that `source_commit_sha` equals the tarball
build commit used for those fixture runs.

## Payload Manifest Check

Command:

```bash
tar -tf /private/tmp/jsc283-work-pack.kZNJY8/brainwav-coding-harness-0.15.1.tgz | rg "^(package/dist/cli\.js|package/\.agents/skills/coding-harness/SKILL\.md|package/\.agents/skills/coding-harness/references/(agent-install-guide\.md|agent-install\.json|evals\.yaml|setup-and-commands\.md)|package/\.agents/skills/coding-harness/scripts/validate_reference_contracts\.py)$"
```

Outcome: pass.

Matched required payload paths:

```text
package/dist/cli.js
package/.agents/skills/coding-harness/references/agent-install.json
package/.agents/skills/coding-harness/references/agent-install-guide.md
package/.agents/skills/coding-harness/references/setup-and-commands.md
package/.agents/skills/coding-harness/SKILL.md
package/.agents/skills/coding-harness/scripts/validate_reference_contracts.py
package/.agents/skills/coding-harness/references/evals.yaml
```

## Packaged CLI Invocation Check

Approved future fixture invocation shape:

```bash
pnpm --store-dir "$FIXTURE_ROOT/.pnpm-store" add "$TARBALL_PATH" --ignore-scripts
./node_modules/.bin/harness <fixture-command>
```

Why:

- Direct raw extraction plus `node package/dist/cli.js` is invalid because the
  extracted tarball does not include installed runtime dependencies.
- `pnpm exec harness` is not safe for closure evidence because a failed install
  can fall through to an ambient globally available `harness` binary.
- Closure fixtures must invoke `./node_modules/.bin/harness` from the fixture
  root after a successful local-tarball install.

Direct extracted CLI probe:

```bash
tmpdir=$(mktemp -d /private/tmp/jsc283-work-extract.XXXXXX)
tar -xzf /private/tmp/jsc283-work-pack.kZNJY8/brainwav-coding-harness-0.15.1.tgz -C "$tmpdir"
node "$tmpdir/package/dist/cli.js" --help
```

Outcome: fail, expected invalid invocation path.

Failure:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'picomatch' imported from /private/tmp/jsc283-work-extract.ih1sTV/package/dist/lib/blast-radius/resolver.js
```

Isolated installed CLI probe:

```bash
tmpdir=$(mktemp -d /private/tmp/jsc283-installed-cli-isolated.XXXXXX)
cd "$tmpdir"
printf '{"type":"module","private":true}\n' > package.json
pnpm --store-dir "$tmpdir/.pnpm-store" add /private/tmp/jsc283-work-pack.kZNJY8/brainwav-coding-harness-0.15.1.tgz --ignore-scripts
./node_modules/.bin/harness --help
```

Outcome: fail, real packaged-runtime blocker.

Failure:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'typescript' imported from /private/tmp/jsc283-installed-cli-isolated.regX1D/node_modules/.pnpm/@brainwav+coding-harness@file+..+jsc283-work-pack.kZNJY8+brainwav-coding-harness-0.15.1_1b85475a783aff3d2059f92ded22c382/node_modules/@brainwav/coding-harness/dist/lib/source-outline.js
```

Runtime evidence:

- `src/lib/source-outline.ts` imports `typescript`.
- `package.json` declares `typescript` in `devDependencies`.
- `package.json` does not declare `typescript` in `dependencies` or
  `peerDependencies`.

## Reference Validator Gap

Targetable validator change needed before extracted-tarball skill-root fixtures
can close:

- Status: resolved for `FX-283-REFS`.
- `.agents/skills/coding-harness/scripts/validate_reference_contracts.py` now
  accepts `--skill-root`, `--package-form`, `--truth-source`, and `--json`.
- `pnpm skill:validate` now invokes the targetable reference validator against
  the repo-local source skill root, so the reference contract is not dormant.
- Closure fixtures can run the packaged copy of the validator against the
  extracted or installed packaged `.agents/skills/coding-harness` tree.

## IU-283-002 Reference Resolution Evidence

Implementation unit: `IU-283-002 - Command Reference Resolution Proof`.

Outcome:

- The existing command-reference validation path was made targetable.
- The validator emits a machine-readable mismatch report.
- The source skill-root report passes with no findings.
- The extracted local-tarball skill-root report passes with no findings.
- The report records target skill root, package form, truth source, checked
  files, and findings.

Source skill-root command:

```bash
python3 .agents/skills/coding-harness/scripts/validate_reference_contracts.py --skill-root .agents/skills/coding-harness --package-form source-skill-root --truth-source "JSC-282 source-command truth" --json
```

Outcome: pass.

Extracted local-tarball command:

```bash
extract_dir=$(mktemp -d /private/tmp/jsc283-refs-extract.XXXXXX)
tar -xzf /private/tmp/jsc283-refs-pack.J9WY9E/brainwav-coding-harness-0.15.1.tgz -C "$extract_dir"
python3 "$extract_dir/package/.agents/skills/coding-harness/scripts/validate_reference_contracts.py" --skill-root "$extract_dir/package/.agents/skills/coding-harness" --package-form extracted-local-tarball --truth-source "JSC-282 source-command truth" --json
```

Outcome: pass.

Machine-readable report:

```json
{
  "checked_files": [
    "SKILL.md",
    "references/agent-install.json",
    "references/setup-and-commands.md",
    "references/agent-install-guide.md"
  ],
  "findings": [],
  "package_form": "extracted-local-tarball",
  "skill_root": "/private/tmp/jsc283-refs-extract.5RG3k1/package/.agents/skills/coding-harness",
  "status": "pass",
  "truth_source": "JSC-282 source-command truth"
}
```

Packaged reference tarball:

```text
/private/tmp/jsc283-refs-pack.J9WY9E/brainwav-coding-harness-0.15.1.tgz
```

Packaged reference tarball SHA-256:

```text
70544644ebbe5d7bbb1acfcd2e143635e08f90d2b513a2f436b1e2552d761738
```

This is reference-resolution proof only. It does not prove packaged CLI
behavior, clean-repo install/init behavior, update/idempotence behavior, or
release-gate readiness.

## IU-283-003 Clean Repo Fixture Evidence

Implementation unit: `IU-283-003 - Clean Repo Packed Artifact Fixture`.

Outcome:

- The local tarball installs into a clean temporary git repo fixture.
- Fixture `HOME` and `XDG_CONFIG_HOME` are isolated under the fixture root.
- Fixture dependency resolution uses an isolated pnpm store under the fixture
  root.
- The harness executable resolves to the fixture-local package bin.
- `./node_modules/.bin/harness --help` reports `harness v0.15.1`.
- `./node_modules/.bin/harness init --dry-run --json` exits `0`.
- The dry-run path reports the files it would create and does not mutate the
  fixture repo beyond package installation artifacts.

Runtime dependency fix:

- `typescript` moved from `devDependencies` to `dependencies` because
  `dist/lib/source-outline.js` imports it at runtime.
- This fixes the packaged CLI launch failure found during `IU-283-001`.

Clean fixture command:

```bash
fixture=$(mktemp -d /private/tmp/jsc283-clean-fixture.XXXXXX)
export HOME="$fixture/home"
export XDG_CONFIG_HOME="$fixture/xdg"
mkdir -p "$HOME" "$XDG_CONFIG_HOME"
cd "$fixture"
git init -q
printf '{"type":"module","private":true}\n' > package.json
pnpm --store-dir "$fixture/.pnpm-store" add /private/tmp/jsc283-clean-pack.hw4gnb/brainwav-coding-harness-0.15.1.tgz --ignore-scripts
./node_modules/.bin/harness --help
./node_modules/.bin/harness init --dry-run --json
```

Fixture evidence:

```text
fixture_dir=/private/tmp/jsc283-clean-fixture.fMiJQB
harness_path=/private/tmp/jsc283-clean-fixture.fMiJQB/node_modules/.bin/harness
harness --help exit_code=0
harness init --dry-run --json exit_code=0
reported version: harness v0.15.1
```

Clean fixture tarball:

```text
/private/tmp/jsc283-clean-pack.hw4gnb/brainwav-coding-harness-0.15.1.tgz
```

Clean fixture tarball SHA-256:

```text
b5d01d24f84d9cbb323e1cfb8e1db433d94c7749bebe0ae696ea0a0233fa2c20
```

Pre/post fixture git status:

```text
?? .pnpm-store/
?? home/
?? node_modules/
?? package.json
?? pnpm-lock.yaml
```

No service credentials were required for this baseline fixture. Package-manager
dependency resolution was allowed and is distinct from service-backed behavior.

## IU-283-004 Update And Ownership Fixture Evidence

Implementation unit: `IU-283-004 - Update And Ownership Fixtures`.

Status: pass after ownership fix and packaged fixture rerun.

What passed:

- Existing harness repo fixture could be seeded from the local tarball.
- Two consecutive `harness init --update --dry-run --json` runs completed after
  trusting the fixture `.mise.toml`.
- Both dry-run update runs left the fixture git diff empty.
- The fixture exposed a package payload gap before update evidence could run:
  several scaffold source scripts were referenced by packaged renderers but were
  absent from the npm tarball.
- The tarball payload was fixed to include the scaffolded script sources needed
  by packaged `harness init`.

What failed before the fix:

- A customized `.codex/environments/environment.toml` was overwritten by
  `harness init --update --json` instead of being preserved or conflict-marked.
- This violates the JSC-283 ownership requirement and blocks closure for
  `SA-283-040`.

Source comparison decision:

- OpenAI Codex local-environment documentation validates local environment
  actions as a first-class Codex app surface. The correct decision is not to
  remove or weaken `.codex/environments/environment.toml` generation.
- Repo source defines `.codex/environments/environment.toml` as a harness-owned,
  autogenerated environment action file only while the sentinel is present.
- Therefore tracked update must continue refreshing sentinel-owned files and
  must skip user-customized files that have lost the autogenerated sentinel.

Update fixture:

```text
/private/tmp/jsc283-update-fixture.5B3fWk
```

Update fixture tarball:

```text
/private/tmp/jsc283-update-pack.6fielD/brainwav-coding-harness-0.15.1.tgz
```

Update fixture tarball SHA-256:

```text
6a32e2de99781f5fd2f846d1b39ab1c9f831bda4accae4581af877eaf1555a51
```

Dry-run update commands:

```bash
./node_modules/.bin/harness init --update --dry-run --json
./node_modules/.bin/harness init --update --dry-run --json
```

Dry-run update outcome: pass, with empty fixture git diff after each run.

Customized environment command:

```bash
printf "# Jamie-owned custom environment\n[tools]\ncustom = \"preserve-me\"\n" > .codex/environments/environment.toml
./node_modules/.bin/harness init --update --json
```

Ownership outcome: fail.

Evidence:

```text
before_sha=cbeb4da64c149fb45ce14923360e62d9fcb6846ca5199207980107531b0f6899
after_sha=2ad7325698e05a764ae3db8f0a5e1d1d81d4fe753d93433d94a469df5130bed3
.codex/environments/environment.toml | 404 ++++++++++++++++++++++++++++++++++-
```

The post-update file begins:

```text
# THIS IS AUTOGENERATED. DO NOT EDIT MANUALLY
version = 1
name = "harness local environment"
```

The customized fixture content was not preserved before the fix. The bug was in
the tracked update path: normal `harness init` already checked the generated
sentinel, while `harness init --update` refreshed every tracked template without
re-checking environment-file ownership.

Fix implemented:

- `src/lib/init/update-core.ts` now reuses `shouldAutoUpdateTemplate()` for
  tracked `.codex/environments/environment.toml` updates.
- `src/commands/init.test.ts` now covers a tracked install where
  `.codex/environments/environment.toml` is customized and then update is run.

Post-fix packaged fixture:

```text
/private/tmp/jsc283-envfix-final-fixture.vha7MM
```

Post-fix tarball:

```text
/private/tmp/jsc283-envfix-final-pack.LaFZnX/brainwav-coding-harness-0.15.1.tgz
```

Post-fix tarball SHA-256:

```text
fb37fae88ce8b419314424f4e8e1dfec7309c79d5c13f4c1b32386aebc84db15
```

Packaged update invocation:

```bash
/opt/homebrew/bin/node --input-type=module -e "const cwd = process.argv[1]; const modulePath = process.argv[2]; process.chdir(cwd); process.argv = [process.execPath, modulePath, \"init\", \"--update\", \"--json\"]; await import(modulePath);" "$fixture" "$fixture/node_modules/@brainwav/coding-harness/dist/cli.js"
```

Packaged update outcome: pass. The update output included
`.codex/environments/environment.toml` in `skipped`, did not include it in
`updated`, and the customized file content was preserved byte-for-byte.

## Closure Limits

This artifact proves `IU-283-004` update ownership behavior after the
environment-file fix.

Closure evidence has now been recorded by `IU-283-005`. Release-gate promotion
remains deferred because the closure runner is not yet a committed reusable
fixture.

## IU-283-005 Closure Evidence Package

Implementation unit: `IU-283-005 - Eval And Gate Recommendation`.

Closure evidence directory:

```text
.harness/evidence/jsc-283-closure
```

Final candidate tarball:

```text
.harness/evidence/jsc-283-closure/package/brainwav-coding-harness-0.15.1.tgz
```

Final candidate tarball SHA-256:

```text
fb37fae88ce8b419314424f4e8e1dfec7309c79d5c13f4c1b32386aebc84db15
```

Source commit recorded for the candidate:

```text
9d1c51e92cdf6aa55b76c61cd1e45149b86b3c2d
```

Important qualification: the candidate tarball was built from the current dirty
working tree, not a committed clean tree. The evidence records the source HEAD
and source dirty status separately. This is enough to prove local behavior for
this implementation slice, but not enough to promote the fixture into a release
gate without committing the fixture runner and rerunning from a clean candidate.

Determinism group:

```text
jsc-283-closure-2026-05-08
```

Closure records:

| Fixture | Run 1 | Run 2 | Closure claim |
| --- | --- | --- | --- |
| `FX-283-STATIC` | pass | pass | allowed |
| `FX-283-REFS` | pass | pass | allowed |
| `FX-283-CLEAN` | pass | pass | allowed |
| `FX-283-ENV` | pass | pass | allowed |
| `FX-283-REMOTE` | blocked | n.a. | not allowed |

Credential-blocked path:

- `FX-283-REMOTE` remains blocked because NPM publishing or service-backed
  verification credentials were not supplied.
- This is acceptable for closure because the plan allows remote published
  package verification to remain blocked when the missing credential is named
  exactly.

Evidence files:

- `.harness/evidence/jsc-283-closure/closure-summary.json`
- `.harness/evidence/jsc-283-closure/fixture-records.json`
- `.harness/evidence/jsc-283-closure/artifact-index.json`
- `.harness/evidence/jsc-283-closure/raw/build.stdout.log`
- `.harness/evidence/jsc-283-closure/raw/pack.stdout.log`
- `.harness/evidence/jsc-283-closure/runs/**/record.json`
- `.harness/evidence/jsc-283-closure/runs/**/stdout.log`
- `.harness/evidence/jsc-283-closure/runs/**/stderr.log`

Gate recommendation:

- Keep the packaged behavior fixtures advisory for now.
- Do not promote them to release gates until the closure runner is implemented
  as a committed, reusable fixture command and rerun from a clean committed
  candidate.
- The behavior evidence is strong enough to close `IU-283-005` locally, but not
  strong enough to harden release governance yet.

Release-gate promotion is still deferred until:

- The closure runner is committed as a reusable fixture command.
- The closure set is rerun from a clean committed candidate.
- Governance wiring consumes that committed fixture rather than this ad hoc
  evidence bundle.

## Validation Log

Command:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/jsc283-pycache python3 -m py_compile .agents/skills/coding-harness/scripts/validate_reference_contracts.py .agents/skills/coding-harness/scripts/test_validate_reference_contracts.py
```

Outcome: pass.

Command:

```bash
python3 .agents/skills/coding-harness/scripts/validate_reference_contracts.py --skill-root .agents/skills/coding-harness --package-form source-skill-root --truth-source "JSC-282 source-command truth" --json
```

Outcome: pass.

Command:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/jsc283-pycache python3 -m pytest .agents/skills/coding-harness/scripts/test_validate_reference_contracts.py
```

Outcome: pass, 3 tests.

Command:

```bash
pnpm skill:validate
```

Outcome: pass.

Command:

```bash
pnpm pack --pack-destination /private/tmp/jsc283-update-pack.6fielD
```

Outcome: pass.

Command:

```bash
./node_modules/.bin/harness init --update --dry-run --json
```

Outcome: pass twice in `/private/tmp/jsc283-update-fixture.5B3fWk`; fixture git
diff remained empty after each dry-run.

Command:

```bash
./node_modules/.bin/harness init --update --json
```

Outcome: fail ownership expectation in `/private/tmp/jsc283-update-fixture.5B3fWk`;
customized `.codex/environments/environment.toml` was overwritten.

Command:

```bash
pnpm test src/commands/init.test.ts -- --runInBand
```

Outcome: pass, 135 tests.

Command:

```bash
pnpm exec biome check src/lib/init/update-core.ts src/commands/init.test.ts
```

Outcome: pass after formatting the new test string.

Command:

```bash
pnpm build
```

Outcome: pass.

Command:

```bash
pnpm pack --pack-destination /private/tmp/jsc283-envfix-final-pack.LaFZnX
```

Outcome: pass.

Command:

```bash
shasum -a 256 /private/tmp/jsc283-envfix-pack.IP5yC9/brainwav-coding-harness-0.15.1.tgz
```

Outcome: pass.

Output:

```text
fb37fae88ce8b419314424f4e8e1dfec7309c79d5c13f4c1b32386aebc84db15  /private/tmp/jsc283-envfix-final-pack.LaFZnX/brainwav-coding-harness-0.15.1.tgz
```

Command:

```bash
/opt/homebrew/bin/node --input-type=module -e "const cwd = process.argv[1]; const modulePath = process.argv[2]; process.chdir(cwd); process.argv = [process.execPath, modulePath, \"init\", \"--update\", \"--json\"]; await import(modulePath);" "$fixture" "$fixture/node_modules/@brainwav/coding-harness/dist/cli.js"
```

Outcome: pass in `/private/tmp/jsc283-envfix-final-fixture.vha7MM`; customized
`.codex/environments/environment.toml` was preserved and listed under `skipped`.

Command:

```bash
pnpm --store-dir /private/tmp/jsc283-main-pnpm-store install --lockfile-only
```

Outcome: pass.

Command:

```bash
pnpm build
```

Outcome: pass after moving `typescript` into runtime dependencies.

Command:

```bash
pnpm pack --pack-destination /private/tmp/jsc283-clean-pack.hw4gnb
```

Outcome: pass.

Command:

```bash
./node_modules/.bin/harness --help
```

Outcome: pass in `/private/tmp/jsc283-clean-fixture.fMiJQB`.

Command:

```bash
./node_modules/.bin/harness init --dry-run --json
```

Outcome: pass in `/private/tmp/jsc283-clean-fixture.fMiJQB`.

Command:

```bash
shasum -a 256 /private/tmp/jsc283-clean-pack.hw4gnb/brainwav-coding-harness-0.15.1.tgz
```

Outcome: pass.

Output:

```text
b5d01d24f84d9cbb323e1cfb8e1db433d94c7749bebe0ae696ea0a0233fa2c20  /private/tmp/jsc283-clean-pack.hw4gnb/brainwav-coding-harness-0.15.1.tgz
```

Command:

```bash
pnpm build
```

Outcome: pass.

Command:

```bash
pnpm pack --pack-destination /private/tmp/jsc283-work-pack.kZNJY8
```

Outcome: pass.

Command:

```bash
shasum -a 256 /private/tmp/jsc283-work-pack.kZNJY8/brainwav-coding-harness-0.15.1.tgz
```

Outcome: pass.

Output:

```text
e842aa2205786c8564a49101d678b094cf82e7964eb0db930c4ad0a1837ac8f3  /private/tmp/jsc283-work-pack.kZNJY8/brainwav-coding-harness-0.15.1.tgz
```

Command:

```bash
pnpm build
```

Outcome: pass after the validator change.

Command:

```bash
pnpm pack --pack-destination /private/tmp/jsc283-refs-pack.J9WY9E
```

Outcome: pass.

Command:

```bash
python3 "$extract_dir/package/.agents/skills/coding-harness/scripts/validate_reference_contracts.py" --skill-root "$extract_dir/package/.agents/skills/coding-harness" --package-form extracted-local-tarball --truth-source "JSC-282 source-command truth" --json
```

Outcome: pass.

## Next Required Slice

Recommended next implementation slice:

1. Run `IU-283-005` closure evidence packaging.
2. Record final raw logs, tarball SHA-256, source commit SHA, and toolchain
   versions.
3. Rerun closure-eligible fixture sets twice against the final tarball.
4. Evaluate whether release-gate wiring is ready or should remain deferred.
