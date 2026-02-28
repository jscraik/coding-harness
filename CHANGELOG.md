# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

# 0.3.0 (2026-02-28)


### Bug Fixes

* add pilot policy keys to validator and tests ([664525c](https://github.com/jscraik/coding-harness/commit/664525cc180fc5e2de0abec9e0a8fe508dfcf7fc))
* address cubic-dev-ai review feedback for PR [#12](https://github.com/jscraik/coding-harness/issues/12) ([ed04c9a](https://github.com/jscraik/coding-harness/commit/ed04c9a7d70f3b7cbd041cadd8b36e07a73dc379))
* **brainstorm:** resolve TypeScript errors, close todo 010 ([6891e8e](https://github.com/jscraik/coding-harness/commit/6891e8e9a07e14cfb439b3fac43dc47bf6f127e7))
* **ci:** add GITHUB_TOKEN for gitleaks PR scanning ([d3aee23](https://github.com/jscraik/coding-harness/commit/d3aee23cc4d53db22b9c0fac35f322f923038888))
* **ci:** add GITHUB_TOKEN for gitleaks PR scanning ([b8a2553](https://github.com/jscraik/coding-harness/commit/b8a25533cd6e6f6be80195393e6ee08b0b34b0ff))
* **ci:** add pull_requests permission for gitleaks ([52e9e45](https://github.com/jscraik/coding-harness/commit/52e9e45e9d701d750546e37a130956bab4e1cc3b))
* **ci:** add pull_requests permission for gitleaks ([7db6498](https://github.com/jscraik/coding-harness/commit/7db64986e4f2c428992e0b5e68c2b52548838e2b))
* **ci:** exclude npmjs.com from lychee link checks ([5094ea8](https://github.com/jscraik/coding-harness/commit/5094ea838988d03a8a008f8ca0732dd273fcb679))
* **ci:** remove deprecated gitleaks inputs ([2131e21](https://github.com/jscraik/coding-harness/commit/2131e21ce493a8a8c0c5be914a587a623daba31d))
* **ci:** remove TruffleHog base/head params causing same-commit error ([7541b82](https://github.com/jscraik/coding-harness/commit/7541b8283f0a4294fcecb303c475efb8039db4b8))
* **ci:** use correct permission name (pull-requests not pull_requests) ([a2cf995](https://github.com/jscraik/coding-harness/commit/a2cf9953958bf10f8ba2830ca5c3c7fc20ec6514))
* correct critical bugs found during comprehensive code review ([47db928](https://github.com/jscraik/coding-harness/commit/47db9287727ce4d7f0c36c2f522054779ad8752e))
* **evidence:** prevent path-traversal bypass via sibling-prefix attack ([dffe657](https://github.com/jscraik/coding-harness/commit/dffe6576dd20447d2e4301ec6e104570a9ee2afc))
* **gardener:** capture JSON output and use needsPR field ([9ffe8c0](https://github.com/jscraik/coding-harness/commit/9ffe8c0dc0943425a8a22024505aaf63520db113))
* **gardener:** prevent mixed JSON and human-readable output ([d17ffc2](https://github.com/jscraik/coding-harness/commit/d17ffc2228d606aeb35d2a450f0d50dce0904d92))
* guard missing flag values in CLI parsing ([a8e1434](https://github.com/jscraik/coding-harness/commit/a8e1434f0560c717f96ccb0edf54a3d4a3631e5b))
* harden path traversal detection in validator ([0732c3c](https://github.com/jscraik/coding-harness/commit/0732c3ca7669fd79e90014a7e5cfab7c47546981))
* refresh diagram context generation paths ([24dbbca](https://github.com/jscraik/coding-harness/commit/24dbbca78792a4e283e5e85de9b13eb59279b3a2))
* resolve multiple test failures across CLI and lib modules ([ab031b8](https://github.com/jscraik/coding-harness/commit/ab031b8fda55eed424efa4145331782ccbfc34b5))
* satisfy markdownlint and strict optional typing ([0815cd5](https://github.com/jscraik/coding-harness/commit/0815cd5c1f1ed09463a8ed62582fdd0f1e206436))
* **security:** harden path and input validation surfaces ([9cf5cc8](https://github.com/jscraik/coding-harness/commit/9cf5cc838f8a7b86a21518e7116de4ebd6d7222e))
* **security:** harden rollback event logging with atomic writes and crypto IDs ([a0e8d78](https://github.com/jscraik/coding-harness/commit/a0e8d7805eae8f59513d990c875468a253d7ebff))


### Features

* add agent-first hybrid search command ([74ab19b](https://github.com/jscraik/coding-harness/commit/74ab19bf51fe27df94c2adf441e5f705f4f0f7ef))
* Add Deterministic Remediation Loop ([#13](https://github.com/jscraik/coding-harness/issues/13)) ([7fd6c17](https://github.com/jscraik/coding-harness/commit/7fd6c177dc4c76035636a66c38f5e7272b781b46))
* add docs, plans, and regression tests ([3fc8d07](https://github.com/jscraik/coding-harness/commit/3fc8d0786d1160f7dcbe01b8f5a25233415b73f8))
* add evidence verification and structured logging ([0156bdd](https://github.com/jscraik/coding-harness/commit/0156bdd8717a50b3ba91a350503e123198dd0396))
* add remediation and gap-case control-plane commands ([9d64045](https://github.com/jscraik/coding-harness/commit/9d640459aac144856f7e83f4a8a7ea57eb90349b))
* add scripts/check for local CI parity ([a247b38](https://github.com/jscraik/coding-harness/commit/a247b38720d2103d6f86fadaebbaac04d006e4af)), closes [#1](https://github.com/jscraik/coding-harness/issues/1)
* Agent-First Throughput v1 Pilot ([#16](https://github.com/jscraik/coding-harness/issues/16)) ([ab4d870](https://github.com/jscraik/coding-harness/commit/ab4d8707c434583d94ffc2fc7fde9611af2d752f))
* **cli:** wire up context and index-context commands ([4bea0db](https://github.com/jscraik/coding-harness/commit/4bea0dbe1eee4f48ec9982fd86b099a8c2f91ec0))
* **context-compound:** implement Phase 1 and Phase 2 ([90b4418](https://github.com/jscraik/coding-harness/commit/90b4418c021a949c99abd4791b926e61746d2403))
* enhance commands with additional test coverage and refinements ([95f02c5](https://github.com/jscraik/coding-harness/commit/95f02c5be1ff8ff1e1b1438f0c8a695bf880908c))
* **gap-case:** add automatic rollback trigger for high-risk incidents ([e132d5e](https://github.com/jscraik/coding-harness/commit/e132d5ee6b7449151b3262ee3b560076ddd84a25))
* **gap-case:** wire contract policy for SLA, evidence, and causality ([973a78d](https://github.com/jscraik/coding-harness/commit/973a78d8e3e11da678d6458f54a2df4cb1868db3))
* **gardener:** add nightly docs maintenance workflow ([#10](https://github.com/jscraik/coding-harness/issues/10)) ([216e579](https://github.com/jscraik/coding-harness/commit/216e5796830c7e5c7452c19dfbeff73a50008d2c))
* GitHub API integration (Phase 4) ([#3](https://github.com/jscraik/coding-harness/issues/3)) ([5a9c650](https://github.com/jscraik/coding-harness/commit/5a9c650b5b9473b7819359bda3c9f0ef4a43d42f))
* implement all Section 27 deferred items ([5bcf631](https://github.com/jscraik/coding-harness/commit/5bcf6316b339512fd766ce8f968a6abdaf1ef29e))
* implement remaining optional items from harness plan ([fdef969](https://github.com/jscraik/coding-harness/commit/fdef969fa6a6e63ebe2327a03b578e975dfe4969))
* implement Section 27 deferred acceptance criteria ([2773e47](https://github.com/jscraik/coding-harness/commit/2773e471e6709d4827f54eca5bb5d066ce6588cf))
* implement silent error detection command ([a50784f](https://github.com/jscraik/coding-harness/commit/a50784fec5563bc10856ca770130da456f4495b6))
* **init:** add harness init command with package manager detection ([068601e](https://github.com/jscraik/coding-harness/commit/068601e01a9cd8f99dd709a1c208444137104dce))
* **init:** add interactive mode with --interactive flag ([52f5b7a](https://github.com/jscraik/coding-harness/commit/52f5b7a955bf1e71d67146b5d4d814e46c918c61))
* **init:** add rollback system with --track and --rollback flags ([032e162](https://github.com/jscraik/coding-harness/commit/032e1628c375927715a598391694ac3a7e07d45b))
* **init:** add schema migration with --migrate flag ([#8](https://github.com/jscraik/coding-harness/issues/8)) ([9ab8c8e](https://github.com/jscraik/coding-harness/commit/9ab8c8ec72b15425bb359ec81e4c1ccbb45d5d6e))
* **init:** add update detection with --check-updates and --update flags ([47f5337](https://github.com/jscraik/coding-harness/commit/47f5337b073d8917fbd32a44648c3bc7818a6fbf))
* **init:** enhance contract template with full policy configuration ([a46db41](https://github.com/jscraik/coding-harness/commit/a46db41de3f6cc08d7e9c9c20251cfd68b6da7c6))
* **memory:** add codex branch enforcement and reliability metrics ([6347453](https://github.com/jscraik/coding-harness/commit/63474537a3b567c4fa77fb7f591596417c5c47bf))
* **memory:** add memory policy gate for workflow compliance ([f1bf0c2](https://github.com/jscraik/coding-harness/commit/f1bf0c21673f9fafde8697b03471b75e8d4f202b))
* Phase 2 - Contract and Policy Core ([#1](https://github.com/jscraik/coding-harness/issues/1)) ([21ed895](https://github.com/jscraik/coding-harness/commit/21ed895ab300921ee1a48a28a612b2dc18f668b6))
* **pilot-rollback:** add machine-proof rollback interface ([29c1134](https://github.com/jscraik/coding-harness/commit/29c113448894546316fd8d60c869e12dd57207bf))
* **policy-gate:** Phase 3 GitHub workflow orchestration ([#2](https://github.com/jscraik/coding-harness/issues/2)) ([e4c4bd0](https://github.com/jscraik/coding-harness/commit/e4c4bd05aeb8cd592fb60577f6a0613e0e794144))
* **preflight:** add preflight policy gate for fast pre-build checks ([c17c26a](https://github.com/jscraik/coding-harness/commit/c17c26ac10e84e73994661a0b8f44d42ba568b08))
* **remediate:** wire contract policy to remediation orchestrator ([e3c3add](https://github.com/jscraik/coding-harness/commit/e3c3add247bfb3673f5cac30fce3d29fc9163eec))
* Roadmap/CLI Gap Closure (P0/P1/P2) ([#17](https://github.com/jscraik/coding-harness/issues/17)) ([b06fb1e](https://github.com/jscraik/coding-harness/commit/b06fb1e007d746958178ccd0d62986b97e233903))
* serialize github mutations and add review authz gate ([92169a8](https://github.com/jscraik/coding-harness/commit/92169a8cc3451f267aa12f94e62ca9fbbfb3f35a))



# Changelog

All notable changes for this repository are documented in this file.

## Table of Contents
- [Unreleased](#unreleased)
- [Release Template](#release-template-copy-to-next-tagged-release)
  - [Added](#added)
  - [Changed](#changed)
  - [Fixed](#fixed)
  - [Other](#other)

## Unreleased
(entries compiled from recent history)
### Added

- `2026-02-23` [9ab8c8e] feat(init): add schema migration with --migrate flag (#8)
- `2026-02-23` [52f5b7a] feat(init): add interactive mode with --interactive flag
- `2026-02-23` [47f5337] feat(init): add update detection with --check-updates and --update flags
- `2026-02-23` [032e162] feat(init): add rollback system with --track and --rollback flags
- `2026-02-23` [068601e] feat(init): add harness init command with package manager detection
- `2026-02-23` [5a9c650] feat: GitHub API integration (Phase 4) (#3)
- `2026-02-23` [e4c4bd0] feat(policy-gate): Phase 3 GitHub workflow orchestration (#2)
- `2026-02-23` [21ed895] feat: Phase 2 - Contract and Policy Core (#1)

### Changed

- `2026-02-23` [53a02ed] docs: mark Phase 4 Installability plan as completed
- `2026-02-23` [f12ce19] chore: sync changes
- `2026-02-23` [1a48e78] docs: sync plans and todos

### Fixed


### Other

- `2026-02-23` [d04f8ff] Add installability planning docs
- `2026-02-23` [dad7226] Add secret scan config and CI hardening
- `2026-02-23` [db97f9e] Initial commit
## Release Template (copy to next tagged release)
### Added
- `2026-02-23` [9ab8c8e] feat(init): add schema migration with --migrate flag (#8)
- `2026-02-23` [52f5b7a] feat(init): add interactive mode with --interactive flag
- `2026-02-23` [47f5337] feat(init): add update detection with --check-updates and --update flags
- `2026-02-23` [032e162] feat(init): add rollback system with --track and --rollback flags
- `2026-02-23` [068601e] feat(init): add harness init command with package manager detection
- `2026-02-23` [5a9c650] feat: GitHub API integration (Phase 4) (#3)
- `2026-02-23` [e4c4bd0] feat(policy-gate): Phase 3 GitHub workflow orchestration (#2)
- `2026-02-23` [21ed895] feat: Phase 2 - Contract and Policy Core (#1)

### Changed
- `2026-02-23` [53a02ed] docs: mark Phase 4 Installability plan as completed
- `2026-02-23` [f12ce19] chore: sync changes
- `2026-02-23` [1a48e78] docs: sync plans and todos

### Fixed

### Other
- `2026-02-23` [d04f8ff] Add installability planning docs
- `2026-02-23` [dad7226] Add secret scan config and CI hardening
- `2026-02-23` [db97f9e] Initial commit
