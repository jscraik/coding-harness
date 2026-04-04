# Contributing to Coding Harness

## Table of Contents

- [Quick path](#quick-path)
- [Canonical guide](#canonical-guide)
- [Work intake](#work-intake)
- [Review and merge gates](#review-and-merge-gates)
- [Security reporting](#security-reporting)

## Quick path

If you only need the shortest reliable contribution flow:

1. Create a dedicated branch from `main`.
2. Make the smallest focused change that solves the task.
3. Run the smallest relevant validation first, then `pnpm check` when behavior changes.
4. Open a pull request with the repository template.
5. Keep CodeRabbit review independent from the coding agent.

## Canonical guide

The repository's full contribution policy lives in
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

Use that document for:

- branch naming and worktree rules
- required local gates
- CodeRabbit setup and review policy
- branch protection expectations
- credential-safe evidence handling

## Work intake

This repository uses **Linear-first** intake for bugs, features, policy gaps,
automation work, and release follow-ups.

Create or update work in the
[coding-harness Linear project](https://linear.app/jscraik/project/coding-harness-bb735dbbda79).

## Review and merge gates

Before merge, contributors are expected to satisfy the repo's documented
workflow:

- no direct pushes to `main`
- pull request required for every merge
- required checks must pass
- CodeRabbit and Codex review artifacts must be present unless explicitly waived
- CodeRabbit review must be performed by an independent reviewer

## Security reporting

Do not report vulnerabilities through public GitHub issues or pull requests.

Use the private disclosure path in
[`SECURITY.md`](../SECURITY.md).
