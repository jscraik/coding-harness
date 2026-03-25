# GitHub → Linear Automation

## Table of Contents

- [Purpose](#purpose)
- [Current state (audited 2026-03-25)](#current-state-audited-2026-03-25)
- [Branch naming convention](#branch-naming-convention)
- [PR linking convention](#pr-linking-convention)
- [Linear settings](#linear-settings)
- [Known gaps and manual steps](#known-gaps-and-manual-steps)
- [Validation checklist](#validation-checklist)

## Purpose

Wire GitHub branch and PR activity back into Linear so issue state moves
automatically from engineering activity rather than manual ticket updates.

## Current state (audited 2026-03-25)

| Signal | Status | Notes |
|---|---|---|
| GitHub integration connected | ✅ Active | PR attachments auto-appear on Linear issues when PRs are opened |
| Branch convention `codex/JSC-N-slug` | ✅ In use | All open/merged branches follow this pattern |
| PR title includes Linear key | ✅ Consistent | e.g. `fix(branch-protect): … (JSC-50)` |
| PR link auto-attached to issue | ✅ Working | Linear receives and stores the GitHub PR link |
| Issue moves to `In Progress` on PR/commit open | ✅ Configured | Team workflow automation: *On PR or commit open → In Progress* |
| Issue moves to `In Review` on review request | ✅ Configured | Team workflow automation: *On PR review request or activity → In Review* |
| Issue moves to `In Review` when PR ready for merge | ✅ Configured | Team workflow automation: *On PR ready for merge → In Review* |
| Issue moves to `Done` on merge | ✅ Configured | Team workflow automation: *On PR or commit merge → Done* |
| Issue moves to `In Progress` on branch creation | ✅ Confirmed | Personal preference: *On git branch copy, move issue to started status* |

**All automations confirmed active as of 2026-03-25.** No manual gaps remain
for standard Linear-initiated branch creation. See [Known gaps](#known-gaps-and-manual-steps)
for the agent-branch edge case.

## Branch naming convention

**Canonical format:** `codex/JSC-<number>-<short-slug>`

**Examples:**
- `codex/JSC-37-github-linear-automation`
- `codex/JSC-50-branch-protect-enforce-ruleset-defaults`

**Rules:**
- Always preserve the `codex/` prefix (required by repo automation + Codex)
- Always include the Linear issue key (`JSC-N`) for auditability
- Keep the slug concise (3–5 words max)

## PR linking convention

### PR description linking statements

Use **non-closing language** while work is still in review:

```
Refs JSC-37
```

Use **closing language** only when merge should complete the issue:

```
Closes JSC-37
Fixes JSC-37
```

> [!WARNING]
> Only use `Closes` / `Fixes` for issues that are truly completed by this PR.
> Partial slices or multi-PR work should use `Refs` and stay open.

### Multi-issue PRs

Use an explicit reference for each issue:

```
Refs JSC-50
Closes JSC-70
```

## Linear settings

### Team workflow automation — ✅ Confirmed active

**Linear → Settings → Team: Jscraik → Workflows & automations**

| Trigger | Configured target |
|---|---|
| On draft PR open | `Todo` |
| On PR or commit open | `In Progress` |
| On PR review request or activity | `In Review` |
| On PR ready for merge | `In Review` |
| On PR or commit merge | `Done` |

Verified 2026-03-25 via settings screenshot.

### Personal preference settings — ✅ Confirmed active

**Linear → Settings → My Account → Preferences → Behavior**

1. ✅ **On git branch copy, move issue to started status** — confirmed 2026-03-25
2. ✅ **On git branch copy, auto-assign to yourself** — confirm per team member

This is a per-user setting and cannot be configured at the team level.

> [!NOTE]
> Linear also respects `Closes JSC-N` language in PR descriptions as a
> closing trigger independent of workflow automation. Use explicit `Closes`
> language in PR descriptions as a belt-and-suspenders fallback — it's
> self-documenting and works even if workflow automation is misconfigured.

### GitHub integration scope — ✅ Confirmed

- Repository `jscraik/coding-harness` is connected
- PR events (open, review, merge) are relayed to Linear
- PR links auto-attach to issues based on branch name or PR description

## Known gaps and manual steps

| Scenario | Gap | Manual workaround |
|---|---|---|
| Branch created outside Linear (e.g. by Codex agent) | Branch-copy automation does not fire | Manually move issue to `In Progress` |
| PR opened without issue key in branch or title | No auto-link to Linear | Add `Refs JSC-N` to PR description |
| Partial-slice PR | Do not use `Closes` — issue must stay open | Manually verify status after merge |
| Blocked work after branch creation | Automation moves to `In Progress`; block state not detected | Add `Blocked` label + blocker note manually |

> [!TIP]
> Codex-agent-created branches (e.g. `codex/JSC-54-ci-migrate-upgrade-ux`) do
> **not** trigger the branch-copy automation because they are pushed directly,
> not copied from a Linear issue card. The issue key in the branch name still
> enables PR auto-linking — only the `In Progress` transition must be set
> manually when an agent does the branching.

## Validation checklist

This setup is complete when:

- [ ] Copying a branch name from a Linear issue card moves the issue to `In Progress`
- [ ] All branch names preserve `codex/` and include the Linear key
- [ ] Opening a PR auto-attaches the PR link to the Linear issue
- [ ] PR description uses `Closes`/`Refs` language intentionally
- [ ] A merged PR with `Closes JSC-N` marks the issue `Done` automatically
- [ ] `harness doctor` (or equivalent) does not warn about stale Linear states

## See also

- [Linear workflow compact](./16-linear-production-compact.md)
- [Linear production workflow](./13-linear-production-workflow.md)
- [Branch protection defaults](../agents/02-tooling-policy.md)
- [Linear baseline doc (Linear native)](https://linear.app/jscraik/document/coding-harness-github-to-linear-automation-baseline-c736f8a03a4f)
