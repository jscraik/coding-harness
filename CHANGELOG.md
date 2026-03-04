# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## Unreleased

### Features

* **init:** scaffold `mise.toml` and update generated environment checks to enable `uv` pinning with `CLAUDE_APPROVAL_POSTURE` defaults, while adding fallback installation paths (`uv`/`pipx`/`python`) for ralph to better support mixed Node/Python projects.


# [0.6.0](https://github.com/jscraik/coding-harness/compare/v0.5.8...v0.6.0) (2026-03-03)


### Features

* add packaged coding-harness skill bundle ([bbe37e2](https://github.com/jscraik/coding-harness/commit/bbe37e20b727b4e7cc969ef518ea2097cc38b91a))
* **init:** add Codex environment action template ([c5d24ba](https://github.com/jscraik/coding-harness/commit/c5d24ba090233f514a451671abfc2e87f2ee5ec6))
* **init:** generate codex actions from project scripts ([781463b](https://github.com/jscraik/coding-harness/commit/781463beff271ca6113b28ce2bb574de1efb32ce))



## [0.5.7](https://github.com/jscraik/coding-harness/compare/v0.5.6...v0.5.7) (2026-03-03)


### Bug Fixes
* **ci:** use correct SBOM package name ([#49](https://github.com/jscraik/coding-harness/issues/49))
  - Switch from non-existent `@cyclonedx/cyclonedx-pnpm` to `@cyclonedx/cyclonedx-npm`
  - Add `--ignore-npm-errors` flag for pnpm compatibility with overrides


## [0.5.6](https://github.com/jscraik/coding-harness/compare/v0.5.5...v0.5.6) (2026-03-03)


### Bug Fixes
* **ci:** proper release hardening fixes ([#46](https://github.com/jscraik/coding-harness/issues/46)) ([06fc66b](https://github.com/jscraik/coding-harness/commit/06fc66b))
  - Remove dependency-review workflow (requires GitHub Advanced Security)
  - Switch SBOM generation to @cyclonedx/cyclonedx-npm with `--ignore-npm-errors` flag for pnpm compatibility
  - Fix postinstall script to work with git worktrees


## [0.5.5](https://github.com/jscraik/coding-harness/compare/v0.5.4...v0.5.5) (2026-03-03)


### Bug Fixes

* **ci:** proper release hardening fixes ([#46](https://github.com/jscraik/coding-harness/issues/46)) ([06fc66b](https://github.com/jscraik/coding-harness/commit/06fc66b))
  - Remove dependency-review workflow (requires GitHub Advanced Security)
  - Switch SBOM generation to @cyclonedx/cyclonedx-pnpm for pnpm compatibility
  - Fix postinstall script to work with git worktrees


## [0.5.4](https://github.com/jscraik/coding-harness/compare/v0.5.3...v0.5.4) (2026-03-02)


### Bug Fixes

* **ci:** address Codex review issues in workflow files ([#38](https://github.com/jscraik/coding-harness/issues/38)) ([c5b3249](https://github.com/jscraik/coding-harness/commit/c5b324958259e9de0d03e54d8f1cb617a4efe77b))
* **ci:** skip preview publish for fork PRs ([6b166aa](https://github.com/jscraik/coding-harness/commit/6b166aa6e6b1b31b9a4e88bfe9e60abaf53a64f8))
* **security:** add CODEOWNERS security contact for private vulnerability reporting ([#39](https://github.com/jscraik/coding-harness/issues/39)) ([52fac71](https://github.com/jscraik/coding-harness/commit/52fac7154af3d5a7965b93cb832cf6b51071d307))
* **init:** remove hardcoded URL from issue template config ([52fac71](https://github.com/jscraik/coding-harness/commit/52fac7154af3d5a7965b93cb832cf6b51071d307))


### Features

* **ci:** add release workflow upgrades (dependency review, branch cleanup, preview releases) ([#37](https://github.com/jscraik/coding-harness/issues/37)) ([c69ee8c](https://github.com/jscraik/coding-harness/commit/c69ee8c8e7a6a4b5b4d5e6f7a8b9c0d1e2f3a4b5))



## [0.5.3](https://github.com/jscraik/coding-harness/compare/v0.5.1...v0.5.3) (2026-02-28)


### Bug Fixes

* **ci:** keep release tag after formatting amend ([2b3a865](https://github.com/jscraik/coding-harness/commit/2b3a86521c6595e24407cdcb2a1bc6c9755caaee))
* **ci:** normalize npm release commit formatting ([bdf17eb](https://github.com/jscraik/coding-harness/commit/bdf17eb617a47221b7b27c11c80c52565f12eeb9))



## [0.5.2](https://github.com/jscraik/coding-harness/compare/v0.5.1...v0.5.2) (2026-02-28)


### Bug Fixes

* **ci:** normalize npm release commit formatting ([bdf17eb](https://github.com/jscraik/coding-harness/commit/bdf17eb617a47221b7b27c11c80c52565f12eeb9))



## [0.5.1](https://github.com/jscraik/coding-harness/compare/v0.4.0...v0.5.1) (2026-02-28)


### Bug Fixes

* use default contract for preflight risk-tier ([#18](https://github.com/jscraik/coding-harness/issues/18)) ([803b9f4](https://github.com/jscraik/coding-harness/commit/803b9f4df023ae876c82db856ade7c98f52dcef0))



# [0.5.0](https://github.com/jscraik/coding-harness/compare/v0.4.0...v0.5.0) (2026-02-28)


### Bug Fixes

* use default contract for preflight risk-tier ([81d2609](https://github.com/jscraik/coding-harness/commit/81d26094aa57f2c613d4186b13b97b50a93efa6f))


### Features

* align governance rules and contract defaults ([76cd5f0](https://github.com/jscraik/coding-harness/commit/76cd5f023c78e7b4ea5464b5f3d2536bcb231845))



# [0.4.0](https://github.com/jscraik/coding-harness/compare/v0.3.8...v0.4.0) (2026-02-28)


### Bug Fixes

* **cli:** restore command dispatch compatibility ([4633600](https://github.com/jscraik/coding-harness/commit/46336000d1ee8a18637dffefa843ff5d46db02b7))
* harden CLI argument parsing and validation ([aeb9c1a](https://github.com/jscraik/coding-harness/commit/aeb9c1ae3bd646fd9109b5879dbfe11b6a0e6d70))
* harden context path validation and option parsing ([7f3c6c2](https://github.com/jscraik/coding-harness/commit/7f3c6c2aa32af45e8955ecfba44212196c725a5a))
* resolve contract and indexer policy parsing ([fc89f52](https://github.com/jscraik/coding-harness/commit/fc89f52548be5e5be2db2b982f00f38bb4b5bccc))
* wire up gap-case and pilot-evaluate commands in CLI ([151a8d2](https://github.com/jscraik/coding-harness/commit/151a8d2b0cb1f18229ccc845b795f8a2de5774b9))


### Features

* **contract:** add pilot policy types and preflight commands for agent-first throughput v1 ([5f6bb37](https://github.com/jscraik/coding-harness/commit/5f6bb3727138071bc7361ccbc131567e2f5a9fcd))
* **gap-case:** implement minimal incident tracking workflow for v1 pilot ([a645f03](https://github.com/jscraik/coding-harness/commit/a645f03e5ea80cbbf2e4d345d4b7a6e9781da6bb))
* **pilot:** implement pilot scorecard and promotion gate ([7ff7340](https://github.com/jscraik/coding-harness/commit/7ff734084eb639f6d6fe5d02b0b44b91da162376))
* **remediation:** implement Phase 2 deterministic throughput hardening ([14f5fd5](https://github.com/jscraik/coding-harness/commit/14f5fd51a3128583a23087998d9b5463599cfc1e))



## [0.3.8](https://github.com/jscraik/coding-harness/compare/v0.3.7...v0.3.8) (2026-02-28)



## [0.3.7](https://github.com/jscraik/coding-harness/compare/v0.3.6...v0.3.7) (2026-02-28)



## [0.3.6](https://github.com/jscraik/coding-harness/compare/v0.3.5...v0.3.6) (2026-02-28)



## [0.3.5](https://github.com/jscraik/coding-harness/compare/v0.3.4...v0.3.5) (2026-02-28)



## [0.3.4](https://github.com/jscraik/coding-harness/compare/v0.3.3...v0.3.4) (2026-02-28)



## [0.3.3](https://github.com/jscraik/coding-harness/compare/v0.3.2...v0.3.3) (2026-02-28)



## [0.3.2](https://github.com/jscraik/coding-harness/compare/v0.3.1...v0.3.2) (2026-02-28)



## [0.3.1](https://github.com/jscraik/coding-harness/compare/v0.3.0...v0.3.1) (2026-02-28)



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
