# Coding Harness routine command reference

Coding Harness has five routine jobs. Start with the one that answers the
current delivery question; do not run all of them by default.

| Command | Use it for | What it proves |
| --- | --- | --- |
| `harness next --json` | first contact and the next useful action | local orientation only |
| `harness init --minimal --dry-run --json` | previewing a small installation | planned files, without writes |
| `harness check --json` | a fast local health diagnosis | the reported local checks |
| `harness verify-work --fast` | repository-native focused proof | the validations it actually ran |
| `harness pr-closeout --pr <number> --json` | reading a pull request's delivery state | the hosted lanes it could read at that time |

## Install

In a consumer repository, install the published package through the
repository's normal package-management route, then run `harness next --json`.
In this source repository, use `node --import tsx src/cli.ts <command>` while
testing an unbuilt change, or the built package binary when testing packaging.

## Evidence boundary

Local command success does not establish PR checks, review approval, merge,
release, or production behaviour. Record unavailable credentials or services as
`blocked` with the command and reason; do not substitute private or unrelated
context.
