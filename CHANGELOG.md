# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### Added

- Added source-checkout public `pnpm exec harness ...` support and a
  `harness orient --json` cold-start rail for agent context discovery.

### Changed

- Aligned public product language and package metadata on SynAIpse as the AI
  Delivery Harness while keeping the coding-harness repository and package
  identifiers unchanged.
- Clarified the pull request template with problem-oriented section headings,
  regression test plan evidence, AI traceability guidance, and changelog
  classification checkboxes.

## [0.15.1](https://github.com/jscraik/coding-harness/compare/v0.15.0...v0.15.1) (2026-05-06)

### Bug Fixes

- bound external harness normalization in `verify-work` so raw fallback checks no longer wait on slow `mise which harness` resolution
- make `ci-migrate prepare --dry-run --json` emit a machine-readable no-write plan without creating target artifacts or nested init state
- raise the transitive `axios` override used by `@vvago/vale` to the patched `1.16.x` line so `pnpm audit` is clean
- tighten update dry-run rollback manifest validation so dry runs report CircleCI, CodeRabbit, CODESTYLE, and legacy Greptile drift without mutating target repos

### Features

- add `harness fleet-plan` to turn upgrade matrix artifacts into agent-native safe-wave remediation plans
- expand upgrade matrix checks to verify CircleCI, CodeRabbit, CODESTYLE parity, and Greptile removal before live fleet rollout

### Validation

- `pnpm check`
- `bash scripts/verify-work.sh --fast`

## [0.15.0](https://github.com/jscraik/coding-harness/compare/v0.14.0...v0.15.0) (2026-05-03)

### Bug Fixes

- **review:** harden learning evidence surfaces ([8ebda15](https://github.com/jscraik/coding-harness/commit/8ebda15179e6f0b6eb77abaaf15469a9efdd3442)), closes [#219](https://github.com/jscraik/coding-harness/issues/219)

### Features

- add cockpit eval and readiness surfaces ([#220](https://github.com/jscraik/coding-harness/issues/220)) ([468a24f](https://github.com/jscraik/coding-harness/commit/468a24feb122607ab012b04cb95bd833c5c023a1))

## [0.14.0](https://github.com/jscraik/coding-harness/compare/v0.13.1...v0.14.0) (2026-04-24)

### Features

- Narrowed the product surface around a codex-first, north-star-driven harness model and documented the contract explicitly in repo-facing surfaces.
- Expanded the CLI contract and command registry coverage so machine-readable command behavior is easier to discover and safer to automate against.
- Tightened `review-gate`, `preflight`, `verify-work`, and related workflow gates to make required-check resolution, resume behavior, and evidence handling more deterministic.
- Moved non-release CI responsibility fully into CircleCI while keeping GitHub Actions reserved for tag-driven private npm publishing and release creation.
- Added stronger init scaffolding for release workflow, changelog generation, and downstream contract surfaces so new repos inherit the same release discipline.

### Commits

- `feat(init)`: scaffold npm release workflow and changelog generation.
- `feat(ci)`: move non-release CI ownership to CircleCI and tighten template contracts.
- `feat(review-gate)`: add provider-aware required-check resolution.
- `feat(validation)`: tighten preflight and workflow gates.
- `feat(north-star)`: add contract surfaces and scaffold docs for the agent-first north star.
- `feat(cli)`: expand contract and command registry coverage.

## [0.13.1](https://github.com/jscraik/coding-harness/compare/v0.13.0...v0.13.1) (2026-04-19)

### Bug Fixes

- **agents:** handle unreadable instruction surfaces gracefully ([d94c925](https://github.com/jscraik/coding-harness/commit/d94c925572284108be98ad9b957d95f34d76815c))
- **agents:** harden canonical reference policy ([e5b0dcf](https://github.com/jscraik/coding-harness/commit/e5b0dcf061854e4a4fb72c97e6a8fdbe3dcb2990))
- **agents:** refactor instruction consistency checks ([628f303](https://github.com/jscraik/coding-harness/commit/628f3034fd6e5504ac00da0d7528fb5cf4505aa3))
- **agents:** tighten consistency scoring and overlap ([4b7ae15](https://github.com/jscraik/coding-harness/commit/4b7ae1563be12f41fae5683d2fbbacb3bd3bef8c))
- **agents:** tighten instruction consistency checks ([b9dcdd0](https://github.com/jscraik/coding-harness/commit/b9dcdd030453db8cf46b645ce0f25f9a78eba020)), closes [#199](https://github.com/jscraik/coding-harness/issues/199)
- **ci:** address CodeRabbit findings on pr203 ([614e46e](https://github.com/jscraik/coding-harness/commit/614e46e4af121d18a1c388400bdd8b27d956bd64))
- **ci:** align circleci scaffold and check contracts ([#201](https://github.com/jscraik/coding-harness/issues/201)) ([d29db16](https://github.com/jscraik/coding-harness/commit/d29db16087618304da671fd8d4863f08fe4d89bd))
- **ci:** align pnpm and contract check baselines ([be59dfc](https://github.com/jscraik/coding-harness/commit/be59dfc3b87c12549ee7cf5dbdf31bfc9a815480))
- **ci:** remove security-scan from required checks and add billing guards ([#193](https://github.com/jscraik/coding-harness/issues/193)) ([539da41](https://github.com/jscraik/coding-harness/commit/539da41e25fd617cc8341e37a904f25da84eafdd))
- **codex:** restore required environment action mappings ([be9f74f](https://github.com/jscraik/coding-harness/commit/be9f74f5497592350c5fd59be48aa6b4fb483cbe))
- **contract:** align WC-004 construct mapping ([2b64f89](https://github.com/jscraik/coding-harness/commit/2b64f891cbc59ad63965c8e6befc9bd5e94ff709))
- **contract:** harden standards map API contracts ([96b5fc6](https://github.com/jscraik/coding-harness/commit/96b5fc6ba98906abee5b2b50fb07b57580302768))
- **contract:** harden standards-map reporting and API safety ([1392e3d](https://github.com/jscraik/coding-harness/commit/1392e3da865f8c461da4370d63a86566dbaf3b15))
- **diagram:** align scaffold context path with contract ([918884c](https://github.com/jscraik/coding-harness/commit/918884c51cc6025170616814bba9a3c55ccb00ad))
- **hooks:** fail fast on staged biome config drift ([2615cbb](https://github.com/jscraik/coding-harness/commit/2615cbb9ea6e289ae30667a58f2fa04863833e7c))
- **init:** make branch-protect guidance executable ([31604b8](https://github.com/jscraik/coding-harness/commit/31604b8dacfcd79da6bbff71bced162569a72e9f))
- **init:** mirror config-drift guard in scaffold template ([856aab4](https://github.com/jscraik/coding-harness/commit/856aab4cf6a359d8d433a2a30c97c36791c7e520))
- **init:** normalize and dedupe bootstrap summary labels ([3f62348](https://github.com/jscraik/coding-harness/commit/3f62348e6c491037bf8d50d7a4e7297ae3db49ea))
- **init:** normalize contract recommendation path check ([1d9cf42](https://github.com/jscraik/coding-harness/commit/1d9cf42ad848185709ce7441f25703650c5e628f))
- **init:** scope index-context recommendation ([61793c8](https://github.com/jscraik/coding-harness/commit/61793c866f539a0021a292a0ad1ecc9222805e30))
- **init:** tighten post-bootstrap summary matching ([52dc76c](https://github.com/jscraik/coding-harness/commit/52dc76c7fcb4c160e4bbafb0f73d36498d2d4c58))
- **pilot-eval:** close threshold and trace gaps ([aa924fa](https://github.com/jscraik/coding-harness/commit/aa924fa9ebf033601483bb1cbff29033a58dfd65))
- **project-brain:** filter non-actionable findings ([21451b7](https://github.com/jscraik/coding-harness/commit/21451b71831f74c40480f640164723ed62ecab7f))
- **project-brain:** harden suggestion dedupe semantics ([ca2e6a4](https://github.com/jscraik/coding-harness/commit/ca2e6a420a1ef5fcb5fb8107b72bd0ed23a3bc5c))
- **project-brain:** harden suggestion generator safety ([0bd25ba](https://github.com/jscraik/coding-harness/commit/0bd25ba4b46012450f3801f5401ea390574c1997))
- **project-brain:** replace scaffold placeholders with seeded baseline (JSC-187) ([#187](https://github.com/jscraik/coding-harness/issues/187)) ([01e0b16](https://github.com/jscraik/coding-harness/commit/01e0b16fc984341a1f4d57b28096376a5744584a))
- **project-brain:** tighten suggestion dedupe and error reporting ([76271f3](https://github.com/jscraik/coding-harness/commit/76271f3a3dcda1788b18a16dd0992eba85a9e557))
- register audit and brain commands in category catalog (CI fix) ([#192](https://github.com/jscraik/coding-harness/issues/192)) ([e3cc821](https://github.com/jscraik/coding-harness/commit/e3cc821dfc008f6d8fe69976b322fb150e1a09ac))
- **release:** avoid pnpm cache bootstrap failure ([#172](https://github.com/jscraik/coding-harness/issues/172)) ([7d515f9](https://github.com/jscraik/coding-harness/commit/7d515f9740abf3ba0bb21159b22f0a615e53c7ff))
- **replay:** harden trace normalization and redaction ([c453932](https://github.com/jscraik/coding-harness/commit/c4539325ddba0c080598720c42fab656a78c7a70))
- **replay:** normalize environment paths in traces ([2d5cd40](https://github.com/jscraik/coding-harness/commit/2d5cd406e15435da37d5f53d7eea1aecc519e8fa))
- **replay:** remove unsafe path-normalization casts ([e5b7c9b](https://github.com/jscraik/coding-harness/commit/e5b7c9b903873ec2b978de437eeb16650ae21b48))
- stabilize worktree pre-push validation ([#171](https://github.com/jscraik/coding-harness/issues/171)) ([ae75f18](https://github.com/jscraik/coding-harness/commit/ae75f18a65326e4d5e54b91427282db45740fbdf))
- **workflow:** preserve last_validated in plan frontmatter ([2f33912](https://github.com/jscraik/coding-harness/commit/2f3391248cf7a533f5caae2d8fbf73bea8fc5c1a))
- **worktree:** sync bootstrap branches to latest origin ([3f701c7](https://github.com/jscraik/coding-harness/commit/3f701c76df626a39748bd4d13745b55108628550))

### Features

- **agents:** add cross-agent instruction compatibility (JSC-125) ([801a165](https://github.com/jscraik/coding-harness/commit/801a165e8d05ef9e1f3449d21f96c775c371a13c))
- **audit:** comprehensive governance state check command (JSC-158) ([#191](https://github.com/jscraik/coding-harness/issues/191)) ([b2d7bd8](https://github.com/jscraik/coding-harness/commit/b2d7bd8bb7c060ecd0db21e7af097f5919065b64))
- **brain:** add brain status/query/add command suite (JSC-184) ([#188](https://github.com/jscraik/coding-harness/issues/188)) ([89d0c16](https://github.com/jscraik/coding-harness/commit/89d0c162773fcf1271ebfea5de830183432f2c07))
- **brain:** add relevance-aware preflight for changed-file context (JSC-185) ([#189](https://github.com/jscraik/coding-harness/issues/189)) ([f54382d](https://github.com/jscraik/coding-harness/commit/f54382d1f10072b1975cccea2e80065d3d7ba17a))
- **brain:** add suggestion generator for gate artifacts (JSC-186) ([4abc81e](https://github.com/jscraik/coding-harness/commit/4abc81e79899c37451be749a3737642d40980b00))
- **brain:** add trust/freshness metadata and stale knowledge surfacing (JSC-188) ([#190](https://github.com/jscraik/coding-harness/issues/190)) ([ee45e19](https://github.com/jscraik/coding-harness/commit/ee45e19a5a27e0a4c8b823c8cd84168881a0d3a7))
- **contract:** add contextCompact policy to contract schema (JSC-134) ([#179](https://github.com/jscraik/coding-harness/issues/179)) ([3942b5b](https://github.com/jscraik/coding-harness/commit/3942b5ba86e77f44cc4485013a2492a2192f6a4f))
- **contract:** add public API barrel and NIST standards map (JSC-108) ([3f43a52](https://github.com/jscraik/coding-harness/commit/3f43a52b5ff0b5584016996effb2713b1a9dd8da))
- **indexer:** add sync contract and backend diagnostics for Project Brain (JSC-189) ([#194](https://github.com/jscraik/coding-harness/issues/194)) ([f499ca9](https://github.com/jscraik/coding-harness/commit/f499ca9806eedef575354726f21951c615bf6f76))
- **init:** add post-bootstrap summary for immediate value (JSC-126) ([74c144a](https://github.com/jscraik/coding-harness/commit/74c144a9c2312ee1b5ab7d2e33b39b68742d5014))
- **linear:** blocked governance model and escalation SLA (JSC-196) ([#177](https://github.com/jscraik/coding-harness/issues/177)) ([7392c8a](https://github.com/jscraik/coding-harness/commit/7392c8aca5e4d685846786623898b1cc90963027))
- **linear:** enforce required metadata gate before issue execution starts (JSC-193) ([#175](https://github.com/jscraik/coding-harness/issues/175)) ([b859925](https://github.com/jscraik/coding-harness/commit/b859925e635bc7b268e53fa8a32dd6142c00475d))
- **linear:** status-aging watchdog for In Progress and In Review lanes (JSC-192) ([#176](https://github.com/jscraik/coding-harness/issues/176)) ([f741a5b](https://github.com/jscraik/coding-harness/commit/f741a5be1be12e0c8d49a6aa50d99676251d8ce7))
- **linear:** triage inbox SLA and deterministic routing policy (JSC-191) ([#174](https://github.com/jscraik/coding-harness/issues/174)) ([1efea6b](https://github.com/jscraik/coding-harness/commit/1efea6b8ad7de00db877467c1cac84836a56471a))
- **linear:** weekly governance status report generation (JSC-195) ([#178](https://github.com/jscraik/coding-harness/issues/178)) ([cc10e3b](https://github.com/jscraik/coding-harness/commit/cc10e3b0f0c365c1729382f3a8ca10792d548035))
- **pilot-eval:** add NIST AI RMF-aligned evaluation engine (JSC-109) ([13177a4](https://github.com/jscraik/coding-harness/commit/13177a42e0419b7a82125c000548c16bb9598e98))
- **project-brain:** v1 contract and validation (JSC-183) ([#186](https://github.com/jscraik/coding-harness/issues/186)) ([33b6bd0](https://github.com/jscraik/coding-harness/commit/33b6bd018d890795d27104683b9b9b0c1fc024e8))
- **replay:** normalize traces for simulation stability (JSC-132) ([4e945ed](https://github.com/jscraik/coding-harness/commit/4e945ed241d75bb6c04788ad1fffe6635bc3fe7a))

# [0.13.0](https://github.com/jscraik/coding-harness/compare/v0.12.1...v0.13.0) (2026-04-13)

### Bug Fixes

- **cli:** restore help contract and clean e2e logging ([b79c58c](https://github.com/jscraik/coding-harness/commit/b79c58ca7135370ce76bfe4326e8a1c69e5b158d))
- **coderabbit:** fail closed release finalize main drift ([017375e](https://github.com/jscraik/coding-harness/commit/017375e01fb825cf660fa0eb3927c2a571f85929))
- **coderabbit:** harden release finalize action ([c08ca21](https://github.com/jscraik/coding-harness/commit/c08ca21dc950182a1d3fc30af14c95a74c34f8d9))
- **hooks:** unblock pre-push parity and freshness gates ([672d634](https://github.com/jscraik/coding-harness/commit/672d634db4cbce287a6b3aeb919479153419b5ad))
- **semgrep:** quote shell patterns in pre-push config ([0e31ad9](https://github.com/jscraik/coding-harness/commit/0e31ad9772c5b1179bf7b0749140f3bc67ea228a))
- **test:** force single-worker vitest runs ([c45a8de](https://github.com/jscraik/coding-harness/commit/c45a8de9b0e4c1ac67e7301328b794985b2a6907))
- **test:** harden git-env-sensitive pre-push specs ([86aa8ac](https://github.com/jscraik/coding-harness/commit/86aa8acecb57ce6f28e0338322c1758ce588f0d6))
- **test:** isolate ci-migrate from hook env leakage ([200d8b3](https://github.com/jscraik/coding-harness/commit/200d8b32bc11d2ed0deaaeca41778200bc3e8e7c))
- **test:** isolate hook env in git-sensitive test paths ([f10c168](https://github.com/jscraik/coding-harness/commit/f10c1684d5e8ef49510e8d54a18bcf37a62e3ade))
- **test:** route check through resilient ci test lane ([5ca9d54](https://github.com/jscraik/coding-harness/commit/5ca9d54c1c91d4ef7298f2fbbd6b72e583ce4ba5))
- **verify-work:** allow missing local conformance artifact ([b8af0ea](https://github.com/jscraik/coding-harness/commit/b8af0eabb8d1e2dcab4b5d36cac3c3514f322395))

### Features

- **cli:** add guardrail metadata to unknown command suggestions ([62145e5](https://github.com/jscraik/coding-harness/commit/62145e57c80d87540d7f0359f134ffb47f8f57a6))
- **cli:** consume catalog for unknown-command suggestions ([c6cf17c](https://github.com/jscraik/coding-harness/commit/c6cf17c65561530568e152d8182646884674f446))

## [0.12.1](https://github.com/jscraik/coding-harness/compare/v0.11.12...v0.12.1) (2026-04-12)

### Bug Fixes

- align CircleCI workflow name with branch protection ([75a8bde](https://github.com/jscraik/coding-harness/commit/75a8bdef3f5a887f45d74cd019cac4f73d934968))
- align uv policy pin and prefer mise harness resolution ([#154](https://github.com/jscraik/coding-harness/issues/154)) ([92d31b9](https://github.com/jscraik/coding-harness/commit/92d31b9089c05f076da4cc40bfa6d49fb1f5137a))
- apply CodeRabbit auto-fixes ([c4ccef4](https://github.com/jscraik/coding-harness/commit/c4ccef4c9e73c50ad5607c55b2b400ed27726d48))
- apply CodeRabbit auto-fixes ([cf50c5d](https://github.com/jscraik/coding-harness/commit/cf50c5d7be7d8c3bf2363a8727537fe441235f7e))
- apply CodeRabbit auto-fixes ([b5676af](https://github.com/jscraik/coding-harness/commit/b5676affc958c989400cd30b6831bb64e867a276))
- apply CodeRabbit auto-fixes ([9c4894d](https://github.com/jscraik/coding-harness/commit/9c4894de482ea22d6f13ff84c301b26a73deb776))
- apply CodeRabbit auto-fixes ([e327f8e](https://github.com/jscraik/coding-harness/commit/e327f8e054437783e4f7cc54faf9152f038ea8bd))
- apply CodeRabbit auto-fixes ([742551f](https://github.com/jscraik/coding-harness/commit/742551f2b8afed5e9cb460f5062741d74b2ecaed))
- apply CodeRabbit auto-fixes ([11e8915](https://github.com/jscraik/coding-harness/commit/11e89159442de587598a71c3b76de079e7f3e0f0))
- apply CodeRabbit auto-fixes ([be1f31c](https://github.com/jscraik/coding-harness/commit/be1f31cd976aa43b8e289b9549c9cf216c8de184))
- apply CodeRabbit auto-fixes ([4746969](https://github.com/jscraik/coding-harness/commit/4746969eb52d2f4c56680a8cb30a35a332919772))
- apply CodeRabbit auto-fixes ([b0a594f](https://github.com/jscraik/coding-harness/commit/b0a594f391cc8447478500e64658b7520adfe279))
- **ci:** rename bridge workflow to break GitHub trigger cache (JSC-101) ([#146](https://github.com/jscraik/coding-harness/issues/146)) ([445ce48](https://github.com/jscraik/coding-harness/commit/445ce484f209a91893ace571e35e8df06623cab4))
- **cli:** restore command registry dispatch imports ([667f73c](https://github.com/jscraik/coding-harness/commit/667f73c937eb46be9e0bf6d15a8c0d572f05ff47))
- **deps/cli:** Vite CVE patch + JSC-105 CLI refactor + agent-friendly error messages ([#147](https://github.com/jscraik/coding-harness/issues/147)) ([e22a26d](https://github.com/jscraik/coding-harness/commit/e22a26df52eb3dc698e7d7a7135d56c35f90b05f))
- **env-check:** remove hanging prek tomllib validation ([0af9906](https://github.com/jscraik/coding-harness/commit/0af99060bd6e3d290cb20273890e3e672617f0bf))
- **github:** remove invalid retryCount from error mock ([#164](https://github.com/jscraik/coding-harness/issues/164)) ([884b940](https://github.com/jscraik/coding-harness/commit/884b94009ea21f8418670f9c5c713614f77fead7))
- harden version coherence and prek hook setup ([#167](https://github.com/jscraik/coding-harness/issues/167)) ([c901966](https://github.com/jscraik/coding-harness/commit/c901966d6ade7b3f804de2014b2fe0499b969f81)), closes [#164](https://github.com/jscraik/coding-harness/issues/164) [#164](https://github.com/jscraik/coding-harness/issues/164)
- **init:** structured JSON errors and harden setup checks (JSC-96) ([f966189](https://github.com/jscraik/coding-harness/commit/f9661890bf6dda6f22544fb0b5f9d7d267925b2c))
- **init:** structured JSON errors and harden setup checks (JSC-96) ([#151](https://github.com/jscraik/coding-harness/issues/151)) ([fff84e3](https://github.com/jscraik/coding-harness/commit/fff84e3f7c87ad41c99e1e05ef1520e2f29232bf))
- **lint:** resolve all Biome lint errors to restore CI signal ([#118](https://github.com/jscraik/coding-harness/issues/118)) ([bd1c5b1](https://github.com/jscraik/coding-harness/commit/bd1c5b1d55a8665184ca69f7fa6b29dc7b76420d))
- **merge:** resolve main conflicts for jsc-178 ([edc0596](https://github.com/jscraik/coding-harness/commit/edc059630d29897363e5fb397f6d2f912d97b404))
- **release:** harden deterministic publish pipeline ([#166](https://github.com/jscraik/coding-harness/issues/166)) ([29c0788](https://github.com/jscraik/coding-harness/commit/29c07882ed697ff5fe3f17d25093b422566ceebf))
- restore CircleCI pr-pipeline status ([6e1ded0](https://github.com/jscraik/coding-harness/commit/6e1ded0b03dfcb601107433cefa105a75e5d2007))
- **test:** sanitize git hook env vars in check-diagram-freshness tests ([#149](https://github.com/jscraik/coding-harness/issues/149)) ([0fe7736](https://github.com/jscraik/coding-harness/commit/0fe77360438f1bb75656f32b1ce9b4e422574e14))

### Features

- bootstrap worktree hook setup helper ([#134](https://github.com/jscraik/coding-harness/issues/134)) ([e4906fc](https://github.com/jscraik/coding-harness/commit/e4906fc3da294eea9e076e98a996aa029c200a31))
- **check:** zero-config harness check entrypoint (JSC-127) ([#152](https://github.com/jscraik/coding-harness/issues/152)) ([05ba6c6](https://github.com/jscraik/coding-harness/commit/05ba6c6d2b5c6bf687ea395a8ef987a1a5943d83))
- **cli:** add grouped taxonomy commands and drift guard ([#159](https://github.com/jscraik/coding-harness/issues/159)) ([db6cd5c](https://github.com/jscraik/coding-harness/commit/db6cd5c67ef8284b03809235ac25c23a89e87954))
- **cli:** publish machine-readable command catalog ([#162](https://github.com/jscraik/coding-harness/issues/162)) ([75463c2](https://github.com/jscraik/coding-harness/commit/75463c27e51a6f09c4508801310c6d3a7b4da355))
- **contract:** add lite-mode onboarding profile ([#160](https://github.com/jscraik/coding-harness/issues/160)) ([a259667](https://github.com/jscraik/coding-harness/commit/a259667e98b9ad369f85b0a99c440099589fb80f))
- **contract:** harness contract init with preset tiers (JSC-123) ([#150](https://github.com/jscraik/coding-harness/issues/150)) ([d46a073](https://github.com/jscraik/coding-harness/commit/d46a07360ce739c26ff5021e3077a77f4af72bbe))
- **linear-triage:** enforce cycle throughput guard ([#156](https://github.com/jscraik/coding-harness/issues/156)) ([341113e](https://github.com/jscraik/coding-harness/commit/341113ea8e858cf981192111c9f73abc8029d02e))
- **linear:** add triage workflow and label governance ([684c514](https://github.com/jscraik/coding-harness/commit/684c5148afba16d8f3aab31b8725b779af496f6d))
- **output:** normalize gate decision envelopes ([#163](https://github.com/jscraik/coding-harness/issues/163)) ([2a7a916](https://github.com/jscraik/coding-harness/commit/2a7a916736b9bc707067ffb8ccda516111efa8f8))
- **policy:** align required-check orchestration metadata ([#155](https://github.com/jscraik/coding-harness/issues/155)) ([5c46c6e](https://github.com/jscraik/coding-harness/commit/5c46c6eb4d99aa6195d44be9677a94be59360ada))
- **scaffold:** harden init flags and wire eject command ([#130](https://github.com/jscraik/coding-harness/issues/130)) ([deb3683](https://github.com/jscraik/coding-harness/commit/deb36839aba139e3d332d269a22e9ec5a11708a6))
- **security:** adopt OpenSSF OSPS scorecard baseline ([#157](https://github.com/jscraik/coding-harness/issues/157)) ([30e0eca](https://github.com/jscraik/coding-harness/commit/30e0eca2a7ba63899d1deba0d87efe8613c2d6f4))
- switch required-check contract to CodeRabbit ([336b6ad](https://github.com/jscraik/coding-harness/commit/336b6adac0b546b7397b55bb3f850c43db8fc6d5))
- **verify:** add resume run-state module and tooling doc sync ([#158](https://github.com/jscraik/coding-harness/issues/158)) ([98d3774](https://github.com/jscraik/coding-harness/commit/98d3774547707b76410a5076764952c41e82fa83))

# [0.12.0](https://github.com/jscraik/coding-harness/compare/v0.11.12...v0.12.0) (2026-04-04)

### Bug Fixes

- align CircleCI workflow name with branch protection ([75a8bde](https://github.com/jscraik/coding-harness/commit/75a8bdef3f5a887f45d74cd019cac4f73d934968))
- align JSC-95 rollout with code-style gates ([5a9427c](https://github.com/jscraik/coding-harness/commit/5a9427c623a5c0c5e009731c27bd58810cbf38b5))
- align security and scaffold contract checks ([55b43b8](https://github.com/jscraik/coding-harness/commit/55b43b8181a99300bdd8939d5117bee340b9812b))
- allow gitleaks PR comments ([3a477fc](https://github.com/jscraik/coding-harness/commit/3a477fcf5094b19c8923729c777d0cf3e907e8b1))
- apply CodeRabbit auto-fixes ([095a5f6](https://github.com/jscraik/coding-harness/commit/095a5f675b4df50e015ce0e0cffc099e6917fb18))
- apply CodeRabbit auto-fixes ([f760f29](https://github.com/jscraik/coding-harness/commit/f760f29a30579cdec2875a02ad59b8fa44d09bb5))
- apply CodeRabbit auto-fixes ([05b0294](https://github.com/jscraik/coding-harness/commit/05b0294f5412ff8b87c5e808d6310e96745c5532))
- apply CodeRabbit auto-fixes ([7579d87](https://github.com/jscraik/coding-harness/commit/7579d87796909c43a0f1c8a6047be6faaa55384a))
- bootstrap pnpm via corepack in CircleCI ([2642ab5](https://github.com/jscraik/coding-harness/commit/2642ab5129f39bb5c845cb27d92be4eb010c9931))
- **lint:** resolve all Biome lint errors to restore CI signal ([#118](https://github.com/jscraik/coding-harness/issues/118)) ([bd1c5b1](https://github.com/jscraik/coding-harness/commit/bd1c5b1d55a8665184ca69f7fa6b29dc7b76420d))
- persist pnpm path across CircleCI steps ([69c1e4c](https://github.com/jscraik/coding-harness/commit/69c1e4c8040bcf36e045deb5bb63e24beb07ca3a))
- prefer repo-local harness for environment checks ([9c0f0ae](https://github.com/jscraik/coding-harness/commit/9c0f0ae009fc6557e272136ebf0e2761cde949a9))
- remove legacy Greptile scaffolding and align skill docs ([a595462](https://github.com/jscraik/coding-harness/commit/a5954622c90ce9ff54a878905b9e5938b8a307d0))
- restore CircleCI pr-pipeline status ([6e1ded0](https://github.com/jscraik/coding-harness/commit/6e1ded0b03dfcb601107433cefa105a75e5d2007))
- restore tag-driven GitHub Actions OIDC private npm publish flow ([#144](https://github.com/jscraik/coding-harness/pull/144))
- restore codestyle contract and CI portability ([1a1146a](https://github.com/jscraik/coding-harness/commit/1a1146a49978890a2f2176df9a9293de0fec70d1))
- unblock PR security checks ([cc4a663](https://github.com/jscraik/coding-harness/commit/cc4a663df910cd9ae089aeb5d21c5c086fbfbbaa))
- unblock push by repairing docs-gate checks ([61ad340](https://github.com/jscraik/coding-harness/commit/61ad3407c7095721b429a00c7db05f18852e9cbe))
- use object scope for CodeRabbit knowledge base ([8e2f359](https://github.com/jscraik/coding-harness/commit/8e2f359814114c81cf444fa0160a42a78010cbd0))

### Features

- bootstrap worktree hook setup helper ([#134](https://github.com/jscraik/coding-harness/issues/134)) ([e4906fc](https://github.com/jscraik/coding-harness/commit/e4906fc3da294eea9e076e98a996aa029c200a31))
- roll up harness governance and scaffold updates ([094521e](https://github.com/jscraik/coding-harness/commit/094521ef988fb6761903bf7080fa0c575e83df2e))
- **scaffold:** harden init flags and wire eject command ([#130](https://github.com/jscraik/coding-harness/issues/130)) ([deb3683](https://github.com/jscraik/coding-harness/commit/deb36839aba139e3d332d269a22e9ec5a11708a6))
- switch required-check contract to CodeRabbit ([336b6ad](https://github.com/jscraik/coding-harness/commit/336b6adac0b546b7397b55bb3f850c43db8fc6d5))

## [0.11.12](https://github.com/jscraik/coding-harness/compare/v0.11.11...v0.11.12) (2026-03-25)

## [0.11.11](https://github.com/jscraik/coding-harness/compare/v0.11.10...v0.11.11) (2026-03-25)

## [0.11.10](https://github.com/jscraik/coding-harness/compare/v0.11.9...v0.11.10) (2026-03-25)

## [0.11.9](https://github.com/jscraik/coding-harness/compare/v0.11.8...v0.11.9) (2026-03-25)

## [0.11.8](https://github.com/jscraik/coding-harness/compare/v0.11.7...v0.11.8) (2026-03-25)

## [0.11.7](https://github.com/jscraik/coding-harness/compare/v0.11.6...v0.11.7) (2026-03-25)

## [0.11.6](https://github.com/jscraik/coding-harness/compare/v0.11.5...v0.11.6) (2026-03-25)

## [0.11.5](https://github.com/jscraik/coding-harness/compare/v0.11.4...v0.11.5) (2026-03-25)

## [0.11.4](https://github.com/jscraik/coding-harness/compare/v0.11.3...v0.11.4) (2026-03-25)

## [0.11.3](https://github.com/jscraik/coding-harness/compare/v0.11.2...v0.11.3) (2026-03-25)

## [0.11.2](https://github.com/jscraik/coding-harness/compare/v0.11.1...v0.11.2) (2026-03-25)

## [0.11.1](https://github.com/jscraik/coding-harness/compare/v0.11.0...v0.11.1) (2026-03-25)

# [0.11.0](https://github.com/jscraik/coding-harness/compare/v0.10.0...v0.11.0) (2026-03-25)

### Bug Fixes

- harden CLI constants, atomic writes, and unfinished code paths ([1dc34fd](https://github.com/jscraik/coding-harness/commit/1dc34fdfe8f14297861fee6588b556a03a01571f))
- **verify-greptile:** clarify .npmrc advisory message (JSC-55) ([58aec42](https://github.com/jscraik/coding-harness/commit/58aec42d1410570deea634864109797b9d5ef255))

### Features

- **ci-migrate:** add bootstrap subcommand + improve verify error messaging (JSC-54) ([#122](https://github.com/jscraik/coding-harness/issues/122)) ([dbaa62e](https://github.com/jscraik/coding-harness/commit/dbaa62e180165ec46b4980c9e554b6ca012109dd))

# [0.10.0](https://github.com/jscraik/coding-harness/compare/v0.9.70...v0.10.0) (2026-03-25)

### Bug Fixes

- **branch-protect:** enforce solo-dev posture and policy-authoritative approval count (JSC-50) ([86e3eee](https://github.com/jscraik/coding-harness/commit/86e3eee406c29bbebff25ce277ca62893b8cc10c))

### Features

- **ci-checks:** clarify ci-required-checks.json vs GitHub branch protection (JSC-70) ([784514c](https://github.com/jscraik/coding-harness/commit/784514ca6af8cd77030c7c134c5a45121d71d259))

## [0.9.70](https://github.com/jscraik/coding-harness/compare/v0.9.69...v0.9.70) (2026-03-25)

## [0.9.69](https://github.com/jscraik/coding-harness/compare/v0.9.68...v0.9.69) (2026-03-25)

## [0.9.68](https://github.com/jscraik/coding-harness/compare/v0.9.67...v0.9.68) (2026-03-25)

## [0.9.67](https://github.com/jscraik/coding-harness/compare/v0.9.66...v0.9.67) (2026-03-25)

## [0.9.66](https://github.com/jscraik/coding-harness/compare/v0.9.65...v0.9.66) (2026-03-25)

## [0.9.65](https://github.com/jscraik/coding-harness/compare/v0.9.64...v0.9.65) (2026-03-25)

## [0.9.64](https://github.com/jscraik/coding-harness/compare/v0.9.63...v0.9.64) (2026-03-25)

## [0.9.63](https://github.com/jscraik/coding-harness/compare/v0.9.62...v0.9.63) (2026-03-25)

## [0.9.62](https://github.com/jscraik/coding-harness/compare/v0.9.61...v0.9.62) (2026-03-25)

## [0.9.61](https://github.com/jscraik/coding-harness/compare/v0.9.60...v0.9.61) (2026-03-25)

## [0.9.60](https://github.com/jscraik/coding-harness/compare/v0.9.59...v0.9.60) (2026-03-25)

## [0.9.59](https://github.com/jscraik/coding-harness/compare/v0.9.58...v0.9.59) (2026-03-25)

## [0.9.58](https://github.com/jscraik/coding-harness/compare/v0.9.57...v0.9.58) (2026-03-25)

## [0.9.57](https://github.com/jscraik/coding-harness/compare/v0.9.56...v0.9.57) (2026-03-25)

## [0.9.56](https://github.com/jscraik/coding-harness/compare/v0.9.55...v0.9.56) (2026-03-25)

## [0.9.55](https://github.com/jscraik/coding-harness/compare/v0.9.54...v0.9.55) (2026-03-25)

## [0.9.54](https://github.com/jscraik/coding-harness/compare/v0.9.53...v0.9.54) (2026-03-25)

## [0.9.53](https://github.com/jscraik/coding-harness/compare/v0.9.52...v0.9.53) (2026-03-25)

## [0.9.52](https://github.com/jscraik/coding-harness/compare/v0.9.51...v0.9.52) (2026-03-25)

## [0.9.51](https://github.com/jscraik/coding-harness/compare/v0.9.50...v0.9.51) (2026-03-25)

## [0.9.50](https://github.com/jscraik/coding-harness/compare/v0.9.49...v0.9.50) (2026-03-25)

## [0.9.49](https://github.com/jscraik/coding-harness/compare/v0.9.48...v0.9.49) (2026-03-25)

## [0.9.48](https://github.com/jscraik/coding-harness/compare/v0.9.47...v0.9.48) (2026-03-25)

## [0.9.47](https://github.com/jscraik/coding-harness/compare/v0.9.46...v0.9.47) (2026-03-25)

## [0.9.46](https://github.com/jscraik/coding-harness/compare/v0.9.45...v0.9.46) (2026-03-25)

## [0.9.45](https://github.com/jscraik/coding-harness/compare/v0.9.44...v0.9.45) (2026-03-25)

## [0.9.44](https://github.com/jscraik/coding-harness/compare/v0.9.43...v0.9.44) (2026-03-25)

## [0.9.43](https://github.com/jscraik/coding-harness/compare/v0.9.42...v0.9.43) (2026-03-25)

## [0.9.42](https://github.com/jscraik/coding-harness/compare/v0.9.41...v0.9.42) (2026-03-25)

## [0.9.41](https://github.com/jscraik/coding-harness/compare/v0.9.40...v0.9.41) (2026-03-25)

## [0.9.40](https://github.com/jscraik/coding-harness/compare/v0.9.39...v0.9.40) (2026-03-25)

## [0.9.39](https://github.com/jscraik/coding-harness/compare/v0.9.38...v0.9.39) (2026-03-25)

## [0.9.38](https://github.com/jscraik/coding-harness/compare/v0.9.37...v0.9.38) (2026-03-25)

## [0.9.37](https://github.com/jscraik/coding-harness/compare/v0.9.36...v0.9.37) (2026-03-25)

## [0.9.36](https://github.com/jscraik/coding-harness/compare/v0.9.35...v0.9.36) (2026-03-25)

## [0.9.35](https://github.com/jscraik/coding-harness/compare/v0.9.34...v0.9.35) (2026-03-25)

## [0.9.34](https://github.com/jscraik/coding-harness/compare/v0.9.33...v0.9.34) (2026-03-25)

## [0.9.33](https://github.com/jscraik/coding-harness/compare/v0.9.32...v0.9.33) (2026-03-25)

## [0.9.32](https://github.com/jscraik/coding-harness/compare/v0.9.31...v0.9.32) (2026-03-25)

## [0.9.31](https://github.com/jscraik/coding-harness/compare/v0.9.30...v0.9.31) (2026-03-25)

## [0.9.30](https://github.com/jscraik/coding-harness/compare/v0.9.29...v0.9.30) (2026-03-25)

## [0.9.29](https://github.com/jscraik/coding-harness/compare/v0.9.28...v0.9.29) (2026-03-25)

## [0.9.28](https://github.com/jscraik/coding-harness/compare/v0.9.27...v0.9.28) (2026-03-25)

## [0.9.27](https://github.com/jscraik/coding-harness/compare/v0.9.26...v0.9.27) (2026-03-25)

## [0.9.26](https://github.com/jscraik/coding-harness/compare/v0.9.25...v0.9.26) (2026-03-25)

## [0.9.25](https://github.com/jscraik/coding-harness/compare/v0.9.24...v0.9.25) (2026-03-25)

## [0.9.24](https://github.com/jscraik/coding-harness/compare/v0.9.23...v0.9.24) (2026-03-25)

## [0.9.23](https://github.com/jscraik/coding-harness/compare/v0.9.22...v0.9.23) (2026-03-25)

## [0.9.22](https://github.com/jscraik/coding-harness/compare/v0.9.21...v0.9.22) (2026-03-25)

## [0.9.21](https://github.com/jscraik/coding-harness/compare/v0.9.20...v0.9.21) (2026-03-25)

## [0.9.20](https://github.com/jscraik/coding-harness/compare/v0.9.19...v0.9.20) (2026-03-25)

## [0.9.19](https://github.com/jscraik/coding-harness/compare/v0.9.18...v0.9.19) (2026-03-25)

## [0.9.18](https://github.com/jscraik/coding-harness/compare/v0.9.17...v0.9.18) (2026-03-25)

## [0.9.17](https://github.com/jscraik/coding-harness/compare/v0.9.16...v0.9.17) (2026-03-25)

## [0.9.16](https://github.com/jscraik/coding-harness/compare/v0.9.15...v0.9.16) (2026-03-25)

## [0.9.15](https://github.com/jscraik/coding-harness/compare/v0.9.14...v0.9.15) (2026-03-25)

## [0.9.14](https://github.com/jscraik/coding-harness/compare/v0.9.13...v0.9.14) (2026-03-25)

## [0.9.13](https://github.com/jscraik/coding-harness/compare/v0.9.12...v0.9.13) (2026-03-25)

## [0.9.12](https://github.com/jscraik/coding-harness/compare/v0.9.11...v0.9.12) (2026-03-25)

## [0.9.11](https://github.com/jscraik/coding-harness/compare/v0.9.10...v0.9.11) (2026-03-25)

## [0.9.10](https://github.com/jscraik/coding-harness/compare/v0.9.9...v0.9.10) (2026-03-25)

## [0.9.9](https://github.com/jscraik/coding-harness/compare/v0.9.8...v0.9.9) (2026-03-25)

## [0.9.8](https://github.com/jscraik/coding-harness/compare/v0.9.7...v0.9.8) (2026-03-25)

## [0.9.7](https://github.com/jscraik/coding-harness/compare/v0.9.6...v0.9.7) (2026-03-25)

## [0.9.6](https://github.com/jscraik/coding-harness/compare/v0.9.5...v0.9.6) (2026-03-25)

## [0.9.5](https://github.com/jscraik/coding-harness/compare/v0.9.4...v0.9.5) (2026-03-25)

## [0.9.4](https://github.com/jscraik/coding-harness/compare/v0.9.3...v0.9.4) (2026-03-25)

## [0.9.3](https://github.com/jscraik/coding-harness/compare/v0.9.2...v0.9.3) (2026-03-25)

## [0.9.2](https://github.com/jscraik/coding-harness/compare/v0.9.1...v0.9.2) (2026-03-25)

## [0.9.1](https://github.com/jscraik/coding-harness/compare/v0.9.0...v0.9.1) (2026-03-25)

# [0.9.0](https://github.com/jscraik/coding-harness/compare/v0.8.1...v0.9.0) (2026-03-25)

### Bug Fixes

- address PR review findings for preset and search flows ([6eaba99](https://github.com/jscraik/coding-harness/commit/6eaba99b146e2428fd5b468c7f8240f94854144f))
- address review comments on ecosystem and preset JSON ([626aad4](https://github.com/jscraik/coding-harness/commit/626aad4ce85b764654a56f9bfef4bbdf3a65c72a))
- align CI defaults to CircleCI and fix all test assertions ([a7533fb](https://github.com/jscraik/coding-harness/commit/a7533fb95a6ff02df7ebd7270c3ab0ab466d0dcc))
- CI/security hardening batch ([#100](https://github.com/jscraik/coding-harness/issues/100)) ([a5ea4e1](https://github.com/jscraik/coding-harness/commit/a5ea4e12c9479dbdfc77d0509b16f4bb03bd2a7b))
- **ci:** avoid stuck queued Greptile check runs ([b259e5f](https://github.com/jscraik/coding-harness/commit/b259e5fba8764fd0442d548bc77d1b377f302927))
- **ci:** break diagram-refresh loop and fix post-merge test command ([d50f09c](https://github.com/jscraik/coding-harness/commit/d50f09c270d336cfaea31ebba79eb9b5318e13c0))
- **ci:** close CircleCI gap analysis findings ([d003030](https://github.com/jscraik/coding-harness/commit/d00303001639d8458289d230c9b10ae5143528b1))
- **ci:** replace broken diagram test with native architecture rule checker ([c81a20e](https://github.com/jscraik/coding-harness/commit/c81a20ea3ff48565378bf446d27cd36dc7d0a7a3))
- **ci:** unblock pr-template and review-thread gating ([33a0025](https://github.com/jscraik/coding-harness/commit/33a00258a7e18fac4f122389df7a88dcf86006e6))
- **ci:** update Greptile check runs instead of creating duplicates ([#86](https://github.com/jscraik/coding-harness/issues/86)) ([7109d4c](https://github.com/jscraik/coding-harness/commit/7109d4c3b02a55f8ba432a0c54caf9e201f0ccc4)), closes [#84](https://github.com/jscraik/coding-harness/issues/84)
- enforce global harness preflight install path ([#90](https://github.com/jscraik/coding-harness/issues/90)) ([362c519](https://github.com/jscraik/coding-harness/commit/362c51974b908942277ac4e94f37eb1c888fd11a))
- **greptile:** prevent github-actions[bot] from consuming a developer seat ([24ad443](https://github.com/jscraik/coding-harness/commit/24ad4438b7a84e4d7e6129ee7157bea8290ef3d8))
- harden downstream harness recovery ([c207fc0](https://github.com/jscraik/coding-harness/commit/c207fc09d1526a399dc361e73df725a8ff8b0a00))
- **harness:** remove Greptile Review from required checks (billing issue) ([dfc99c1](https://github.com/jscraik/coding-harness/commit/dfc99c198c2a191d244c68f8725b6cdfaecc5487))
- **JSC-51:** restore greptile-review.yml scaffold for github-actions provider ([d1d201f](https://github.com/jscraik/coding-harness/commit/d1d201fb5e815a58789bd33bf6a9dec203fb5aa0))
- **pilot-eval:** restore governance trust for CircleCI repos ([d9b612b](https://github.com/jscraik/coding-harness/commit/d9b612bbd694ee8e4f979231cc317c8f46279455))
- remove trailing newlines for ci-migrate ([a43795b](https://github.com/jscraik/coding-harness/commit/a43795b352630a8a6d7a1fa6a44af0e4f75feef9))
- repair tests failing after CircleCI migration ([37b54e6](https://github.com/jscraik/coding-harness/commit/37b54e6f50ce658eee7637492fa0a6c8e02a6666))
- resolve 7 open issues across CI, preflight, and Greptile config ([8dcfe5b](https://github.com/jscraik/coding-harness/commit/8dcfe5bacd13e080156df2a78858c1e3985b781e)), closes [#65](https://github.com/jscraik/coding-harness/issues/65) [#70](https://github.com/jscraik/coding-harness/issues/70) [#68](https://github.com/jscraik/coding-harness/issues/68) [#60](https://github.com/jscraik/coding-harness/issues/60) [#67](https://github.com/jscraik/coding-harness/issues/67) [#58](https://github.com/jscraik/coding-harness/issues/58) [#59](https://github.com/jscraik/coding-harness/issues/59) [#61](https://github.com/jscraik/coding-harness/issues/61)
- resolve CircleCI config validation errors (heredoc + cron syntax) ([#105](https://github.com/jscraik/coding-harness/issues/105)) ([dce8af4](https://github.com/jscraik/coding-harness/commit/dce8af44c2e93f82b2382b9e0b20e78a8814cd54))
- resolve lint errors and align CircleCI with current codebase ([d230d9c](https://github.com/jscraik/coding-harness/commit/d230d9cbd7259009c6c355319de46bc88a69d89f)), closes [#107](https://github.com/jscraik/coding-harness/issues/107)
- resolve TypeScript errors blocking diagram commit ([e843707](https://github.com/jscraik/coding-harness/commit/e843707c8d375efcf92e738dea57e95ea446ac1e))
- **security:** batch security fixes from Codex scan 2026-03-14 ([#99](https://github.com/jscraik/coding-harness/issues/99)) ([a5cef18](https://github.com/jscraik/coding-harness/commit/a5cef189d5c22a0dccaac6cf6ad19090778d75b8))
- **security:** harden interactive init and review-gate ([f7fcf5c](https://github.com/jscraik/coding-harness/commit/f7fcf5cc8debe2aa193f340af85bc356838e6141))
- **security:** pin policy-gate contract to base branch in PR workflows ([20ba1aa](https://github.com/jscraik/coding-harness/commit/20ba1aaff35cd7fd4f6b9570a8feeb013dd9d3c2))
- **test:** restore 15-check list in CONTRIBUTING.md branch protection section ([030a3a6](https://github.com/jscraik/coding-harness/commit/030a3a6200f2ee06974af5727c105f91ccc50d43))
- **types:** add CIProvider type and ciProvider fields (JSC-52) ([2b3816b](https://github.com/jscraik/coding-harness/commit/2b3816bf578101bb9ac8a6547d2ab89d9d807cb5))
- unblock org-audit base paths and greptile freshness ([8b5c57d](https://github.com/jscraik/coding-harness/commit/8b5c57d416595f76ab9e2994368db881b09d2bc3))
- wire GITHUB_PERSONAL_ACCESS_TOKEN to GH_TOKEN for gh CLI in CircleCI ([#106](https://github.com/jscraik/coding-harness/issues/106)) ([bf0d89f](https://github.com/jscraik/coding-harness/commit/bf0d89ff86dba5559ca87e96d8e5dadbefa4a314))

### Features

- add agent-native test harness utilities (Slice 5) ([d0aee9c](https://github.com/jscraik/coding-harness/commit/d0aee9cb2581ac71c7806175198c289f2a6f1ce1))
- add canonical run record substrate foundations ([9fa5151](https://github.com/jscraik/coding-harness/commit/9fa5151f231c83c79012dcc176bb3246680f0178))
- add CI provider policy adapter (Slice 2) ([81c8641](https://github.com/jscraik/coding-harness/commit/81c8641b838320d42fb960bb93f3e60b3ff3742d))
- add ecosystem profiles in branch-protect ([f7fd9ba](https://github.com/jscraik/coding-harness/commit/f7fd9ba3d9eae2bd141cab8a688e010ed42fbc0e))
- add ecosystem profiles in branch-protect ([3331524](https://github.com/jscraik/coding-harness/commit/33315243111d86d852c455ef573209f7ada4f4a3))
- add gate bundle consolidation (Slice 4) ([f8ab1ce](https://github.com/jscraik/coding-harness/commit/f8ab1ce90a08b7eb30540ebd2346aa9af192038c))
- add linear enforcement and docs-gate design ([15ed8f9](https://github.com/jscraik/coding-harness/commit/15ed8f9960540fbf543a3720772d7c59a5d761f4))
- add local PR template gate command ([#92](https://github.com/jscraik/coding-harness/issues/92)) ([a83288f](https://github.com/jscraik/coding-harness/commit/a83288f30eb0d81f1786dfc57e9d6e3159a6732c))
- add operator feedback dashboard scorecard (Slice 4a) ([9503d5b](https://github.com/jscraik/coding-harness/commit/9503d5befdb93446d7b5cf1b938a60649aaaf862))
- add request-greptile-review command and fix CI ([265748f](https://github.com/jscraik/coding-harness/commit/265748f2345975d991e26c85885bc64370c8d541))
- add scale-out pilot tracker (Slice 6) ([66371ba](https://github.com/jscraik/coding-harness/commit/66371bafe686b86195e24c3f1d00c17b780b1d5c))
- add workflow contract markdown parser (Slice 1) ([497bc49](https://github.com/jscraik/coding-harness/commit/497bc49b2f64ffd60abab2b1d83e20f1bdb9dd88))
- add workflow contract preset templates (Slice 1) ([c9ea766](https://github.com/jscraik/coding-harness/commit/c9ea766ffc451f2ab20aaae9866629a91bf16fec))
- add workflow state normalization (Slice 3) ([dd33e35](https://github.com/jscraik/coding-harness/commit/dd33e3523288c4bead6ac9506700489f93c73c30))
- add workflow-contract checker and artifact registry (Slice 1) ([dfa5e59](https://github.com/jscraik/coding-harness/commit/dfa5e594c6cd7c36dba46baa15ae8e5b19c4c7ea))
- branded types for PresetSource and I/O separation foundation ([f5b34eb](https://github.com/jscraik/coding-harness/commit/f5b34eb72c6474b6e1802328804da7b4d91e848d))
- **ci-migrate:** orphan check detection + sync-branch-protection (JSC-60) ([#114](https://github.com/jscraik/coding-harness/issues/114)) ([26d00f6](https://github.com/jscraik/coding-harness/commit/26d00f6723a914b36b4fc116127a1d86275ca3f3))
- **ci-migrate:** shadow → required mode promotion (JSC-61) ([9f2c4ce](https://github.com/jscraik/coding-harness/commit/9f2c4ce1d480956a95e76be7ede1c97412a9616f))
- **ci-migrate:** solo/lightweight commit mode (JSC-58) ([#115](https://github.com/jscraik/coding-harness/issues/115)) ([0116877](https://github.com/jscraik/coding-harness/commit/011687706f72a9c6db3dd504e77c4fdb4395e437))
- **ci-migrate:** tighten verify and add transition templates ([#96](https://github.com/jscraik/coding-harness/issues/96)) ([c319d97](https://github.com/jscraik/coding-harness/commit/c319d97aafe9da6ba7e9327394d6965a8845875e))
- **ci-migrate:** validate CI config syntax in verify; add shell quality tests (JSC-59, JSC-62) ([#110](https://github.com/jscraik/coding-harness/issues/110)) ([f91d32d](https://github.com/jscraik/coding-harness/commit/f91d32d6df3d42e025a63d43b23c33e72c716b1e)), closes [#57](https://github.com/jscraik/coding-harness/issues/57) [#58](https://github.com/jscraik/coding-harness/issues/58) [#60](https://github.com/jscraik/coding-harness/issues/60)
- **ci:** add architecture drift gate to PR pipeline ([ddedfaf](https://github.com/jscraik/coding-harness/commit/ddedfafbf27b4603acb58650b12fbebe1b5d491a))
- **ci:** add CircleCI release pipeline (JSC-43) ([4b8de13](https://github.com/jscraik/coding-harness/commit/4b8de13b0b5950b4c33bd2a347d68c07a8f3d10f))
- **contract:** version-aware upgrade path + JSON schema + validate command (JSC-66, JSC-69) ([#116](https://github.com/jscraik/coding-harness/issues/116)) ([4628584](https://github.com/jscraik/coding-harness/commit/4628584eaefc01858c9ecb4c3ce149a17f7fc45d))
- control-plane required check parity + agent-optimized docs ([#87](https://github.com/jscraik/coding-harness/issues/87)) ([745cf0d](https://github.com/jscraik/coding-harness/commit/745cf0df1ede1f03e0821127c77f966ddd04a087))
- cross-project governance platform with security hardening ([a495f1e](https://github.com/jscraik/coding-harness/commit/a495f1e265c1fc5238097e85436333b35afff488))
- **docs:** add compact operational specs for core workflows ([bc79d99](https://github.com/jscraik/coding-harness/commit/bc79d99524e1b4da3724e44d52157694d6c97b47))
- **doctor:** add harness doctor prerequisite checker (JSC-65) ([#112](https://github.com/jscraik/coding-harness/issues/112)) ([0d81ad1](https://github.com/jscraik/coding-harness/commit/0d81ad18e37b231fcb2b0db57367505bb99a194a))
- **drift-gate:** auto-seed baseline, suppressions, fix guidance (JSC-63, JSC-64, JSC-68) ([1483161](https://github.com/jscraik/coding-harness/commit/1483161fc4583ea7e79f0488a24134ef04cc8e89))
- extend workflow-contract, symphony-check, and scaffold ([f3e0800](https://github.com/jscraik/coding-harness/commit/f3e0800314eef57e4481312853b2c46b8b6759a9))
- **health:** unified gate status scorecard (JSC-67) ([09a74af](https://github.com/jscraik/coding-harness/commit/09a74af650d16d47b74ae102a165ebd13c6f2688))
- implement docs-gate governance parity (Phases 0-6) ([6f8d096](https://github.com/jscraik/coding-harness/commit/6f8d09688d88add53497337796965634ed4a74b2))
- implement license-gate command for open-source license validation ([9dbe5de](https://github.com/jscraik/coding-harness/commit/9dbe5de6ef9b924c5bf3e413c5282473d2da4e56))
- **init:** tooling version detection prevents biome.json downgrade (JSC-57) ([#109](https://github.com/jscraik/coding-harness/issues/109)) ([3ba5bd5](https://github.com/jscraik/coding-harness/commit/3ba5bd5b4aa0c58889e7ceba703631fc9aa45a71))
- **JSC-44:** implement harness linear sync command ([7802633](https://github.com/jscraik/coding-harness/commit/780263387edc3ca3a890b4a46447a6fa40c30f37))
- **JSC-71:** structured output, auto-fix health, and project-type auto-detection ([#121](https://github.com/jscraik/coding-harness/issues/121)) ([61c6615](https://github.com/jscraik/coding-harness/commit/61c6615bda4ba979c4d9b25c7e797d43647e1099))
- migrate linear PR sync from GitHub Actions to CircleCI ([#104](https://github.com/jscraik/coding-harness/issues/104)) ([aacb8d9](https://github.com/jscraik/coding-harness/commit/aacb8d966b38eaf7ccc7757fd73032b7b980781a))
- Phase 4 - input validation, Result types, scan caching, ADRs ([bf9ac92](https://github.com/jscraik/coding-harness/commit/bf9ac92c1bf1cab4d385ba3367f2047732d068fa))
- **review-gate:** block merge on unresolved non-bot review threads ([0d289b4](https://github.com/jscraik/coding-harness/commit/0d289b4cf1189386e220bda480994632e41fbf7b))
- **simulate:** implement Phase 2/3/4 — real artifact ingestion, metrics, deltas, and recommendations ([ed7b0ca](https://github.com/jscraik/coding-harness/commit/ed7b0cad1f952ba0d1e9ad564212f1364d1b4a4a))
- **workflow:** add workflow:generate command with --watch flag ([f1da97a](https://github.com/jscraik/coding-harness/commit/f1da97a73e3229f55b5d9d5b0989a3710dbb5d4a))

### Performance Improvements

- **test:** pre-seed git fixture in beforeAll to fix 128s timeout ([ad06c0c](https://github.com/jscraik/coding-harness/commit/ad06c0ccfdb9e269c9819bc6bfb0298ec12520d3))

## [0.8.1](https://github.com/jscraik/coding-harness/compare/v0.8.0...v0.8.1) (2026-03-08)

# [0.8.0](https://github.com/jscraik/coding-harness/compare/v0.7.2...v0.8.0) (2026-03-07)

### Bug Fixes

- **ci:** make OIDC attestation non-blocking ([#80](https://github.com/jscraik/coding-harness/issues/80)) ([98cef2e](https://github.com/jscraik/coding-harness/commit/98cef2e1368c6b9e9b2b28eab23c9f202eeee6c4))

### Features

- add linear workflow commands and governance updates ([#81](https://github.com/jscraik/coding-harness/issues/81)) ([dca2376](https://github.com/jscraik/coding-harness/commit/dca23763936cd1577f5d9f814623fb7545d8e470))

## [0.7.2](https://github.com/jscraik/coding-harness/compare/v0.7.1...v0.7.2) (2026-03-07)

### Bug Fixes

- **ci:** harden private npm release automation ([#77](https://github.com/jscraik/coding-harness/issues/77)) ([673bee5](https://github.com/jscraik/coding-harness/commit/673bee5dfc8a48fc6425ba0e15966ec30d218813))

## [0.7.1](https://github.com/jscraik/coding-harness/compare/v0.7.0...v0.7.1) (2026-03-06)

### Bug Fixes

- **ci:** allow release token fallback in auto-release ([#74](https://github.com/jscraik/coding-harness/issues/74)) ([0bf524d](https://github.com/jscraik/coding-harness/commit/0bf524dde516b7aa19a0d3c9fc29e8f7d2a2b54e))
- **ci:** make PR-based release path the built-in flow ([#73](https://github.com/jscraik/coding-harness/issues/73)) ([5285757](https://github.com/jscraik/coding-harness/commit/52857575549a9d5b847d7468561b74f0d701ee82))

# [0.7.0](https://github.com/jscraik/coding-harness/compare/v0.6.0...v0.7.0) (2026-03-06)

### Bug Fixes

- **ci:** build package before auto-release smoke test ([#71](https://github.com/jscraik/coding-harness/issues/71)) ([fe124e3](https://github.com/jscraik/coding-harness/commit/fe124e3e94f285e1653b374f3bde2c0c74bd1a26))
- **ci:** distinguish review-gate follow-up exits ([d8c1467](https://github.com/jscraik/coding-harness/commit/d8c14679e7a26add34baefea2593656e601b3acd))
- **ci:** keep review-gate system failures blocking ([c3a4a91](https://github.com/jscraik/coding-harness/commit/c3a4a91f5a94a1ad6fcfc8caea6ca74016507a8c))
- **ci:** unblock auto-release after merged PR audit ([0e8816d](https://github.com/jscraik/coding-harness/commit/0e8816dad6526783f8a71e8c042c393a7f24ec20))
- **ci:** unblock release smoke test on GitHub runners ([#69](https://github.com/jscraik/coding-harness/issues/69)) ([215c1f2](https://github.com/jscraik/coding-harness/commit/215c1f2cb24322fe5251bcce5655b6fd5611e39d))
- **cli:** address greptile thread follow-ups ([a317fcb](https://github.com/jscraik/coding-harness/commit/a317fcb3b0624c49270446b987bc39895e97948f))
- **cli:** address PR [#63](https://github.com/jscraik/coding-harness/issues/63) review blockers ([79cdaa3](https://github.com/jscraik/coding-harness/commit/79cdaa38f67e5ed45bfe1373bf263bf8e3cedf94))
- **deps:** bump tar override to patched release ([0324bf5](https://github.com/jscraik/coding-harness/commit/0324bf5ead4b051ad4d3c85bc9bf5180c5538150))
- **init:** enforce internal governance templates ([3c30ece](https://github.com/jscraik/coding-harness/commit/3c30ece95991c0c73305cc36d3e94bddaff9a132))
- **review-gate:** preserve --auto-resolve-bot-threads parsing ([b78f245](https://github.com/jscraik/coding-harness/commit/b78f2455b3c48e4dccc2ec9bc78f6e94a6817541))

### Features

- add advisory consistency drift gate and branch updates ([#64](https://github.com/jscraik/coding-harness/issues/64)) ([98ac487](https://github.com/jscraik/coding-harness/commit/98ac4872cbe1d5b08cad74085884901deb1e9d92)), closes [#62](https://github.com/jscraik/coding-harness/issues/62) [#62](https://github.com/jscraik/coding-harness/issues/62)
- **cli:** add core command metadata registry ([6e11ed0](https://github.com/jscraik/coding-harness/commit/6e11ed06d68add4ca9ba99f05247542a72250bb7))
- harden CI gates and reconcile init workflow drift ([#62](https://github.com/jscraik/coding-harness/issues/62)) ([550736b](https://github.com/jscraik/coding-harness/commit/550736b90623428284bc5b8c13f43324d559c321))
- **init:** scaffold `.mise.toml` and update generated environment checks to enable `uv` pinning with `CLAUDE_APPROVAL_POSTURE` defaults, while adding fallback installation paths (`uv`/`pipx`/`python`) for ralph to better support mixed Node/Python projects. ([15baf82](https://github.com/jscraik/coding-harness/commit/15baf825ab1e55f4b19c35e73c510cb9de93c0b2))
- support app JWT in verify-greptile ([290f22c](https://github.com/jscraik/coding-harness/commit/290f22cfd7307a3321071a92d6f878855ce06a3f))

# [0.6.0](https://github.com/jscraik/coding-harness/compare/v0.5.8...v0.6.0) (2026-03-03)

### Features

- add packaged coding-harness skill bundle ([bbe37e2](https://github.com/jscraik/coding-harness/commit/bbe37e20b727b4e7cc969ef518ea2097cc38b91a))
- **init:** add Codex environment action template ([c5d24ba](https://github.com/jscraik/coding-harness/commit/c5d24ba090233f514a451671abfc2e87f2ee5ec6))
- **init:** generate codex actions from project scripts ([781463b](https://github.com/jscraik/coding-harness/commit/781463beff271ca6113b28ce2bb574de1efb32ce))

## [0.5.7](https://github.com/jscraik/coding-harness/compare/v0.5.6...v0.5.7) (2026-03-03)

### Bug Fixes

- **ci:** use correct SBOM package name ([#49](https://github.com/jscraik/coding-harness/issues/49))
  - Switch from non-existent `@cyclonedx/cyclonedx-pnpm` to `@cyclonedx/cyclonedx-npm`
  - Add `--ignore-npm-errors` flag for pnpm compatibility with overrides

## [0.5.6](https://github.com/jscraik/coding-harness/compare/v0.5.5...v0.5.6) (2026-03-03)

### Bug Fixes

- **ci:** proper release hardening fixes ([#46](https://github.com/jscraik/coding-harness/issues/46)) ([06fc66b](https://github.com/jscraik/coding-harness/commit/06fc66b))
  - Remove dependency-review workflow (requires GitHub Advanced Security)
  - Switch SBOM generation to @cyclonedx/cyclonedx-npm with `--ignore-npm-errors` flag for pnpm compatibility
  - Fix postinstall script to work with git worktrees

## [0.5.5](https://github.com/jscraik/coding-harness/compare/v0.5.4...v0.5.5) (2026-03-03)

### Bug Fixes

- **ci:** proper release hardening fixes ([#46](https://github.com/jscraik/coding-harness/issues/46)) ([06fc66b](https://github.com/jscraik/coding-harness/commit/06fc66b))
  - Remove dependency-review workflow (requires GitHub Advanced Security)
  - Switch SBOM generation to @cyclonedx/cyclonedx-pnpm for pnpm compatibility
  - Fix postinstall script to work with git worktrees

## [0.5.4](https://github.com/jscraik/coding-harness/compare/v0.5.3...v0.5.4) (2026-03-02)

### Bug Fixes

- **ci:** address Codex review issues in workflow files ([#38](https://github.com/jscraik/coding-harness/issues/38)) ([c5b3249](https://github.com/jscraik/coding-harness/commit/c5b324958259e9de0d03e54d8f1cb617a4efe77b))
- **ci:** skip preview publish for fork PRs ([6b166aa](https://github.com/jscraik/coding-harness/commit/6b166aa6e6b1b31b9a4e88bfe9e60abaf53a64f8))
- **security:** add CODEOWNERS security contact for private vulnerability reporting ([#39](https://github.com/jscraik/coding-harness/issues/39)) ([52fac71](https://github.com/jscraik/coding-harness/commit/52fac7154af3d5a7965b93cb832cf6b51071d307))
- **init:** remove hardcoded URL from issue template config ([52fac71](https://github.com/jscraik/coding-harness/commit/52fac7154af3d5a7965b93cb832cf6b51071d307))

### Features

- **ci:** add release workflow upgrades (dependency review, branch cleanup, preview releases) ([#37](https://github.com/jscraik/coding-harness/issues/37)) ([c69ee8c](https://github.com/jscraik/coding-harness/commit/c69ee8c8e7a6a4b5b4d5e6f7a8b9c0d1e2f3a4b5))

## [0.5.3](https://github.com/jscraik/coding-harness/compare/v0.5.1...v0.5.3) (2026-02-28)

### Bug Fixes

- **ci:** keep release tag after formatting amend ([2b3a865](https://github.com/jscraik/coding-harness/commit/2b3a86521c6595e24407cdcb2a1bc6c9755caaee))
- **ci:** normalize npm release commit formatting ([bdf17eb](https://github.com/jscraik/coding-harness/commit/bdf17eb617a47221b7b27c11c80c52565f12eeb9))

## [0.5.2](https://github.com/jscraik/coding-harness/compare/v0.5.1...v0.5.2) (2026-02-28)

### Bug Fixes

- **ci:** normalize npm release commit formatting ([bdf17eb](https://github.com/jscraik/coding-harness/commit/bdf17eb617a47221b7b27c11c80c52565f12eeb9))

## [0.5.1](https://github.com/jscraik/coding-harness/compare/v0.4.0...v0.5.1) (2026-02-28)

### Bug Fixes

- use default contract for preflight risk-tier ([#18](https://github.com/jscraik/coding-harness/issues/18)) ([803b9f4](https://github.com/jscraik/coding-harness/commit/803b9f4df023ae876c82db856ade7c98f52dcef0))

# [0.5.0](https://github.com/jscraik/coding-harness/compare/v0.4.0...v0.5.0) (2026-02-28)

### Bug Fixes

- use default contract for preflight risk-tier ([81d2609](https://github.com/jscraik/coding-harness/commit/81d26094aa57f2c613d4186b13b97b50a93efa6f))

### Features

- align governance rules and contract defaults ([76cd5f0](https://github.com/jscraik/coding-harness/commit/76cd5f023c78e7b4ea5464b5f3d2536bcb231845))

# [0.4.0](https://github.com/jscraik/coding-harness/compare/v0.3.8...v0.4.0) (2026-02-28)

### Bug Fixes

- **cli:** restore command dispatch compatibility ([4633600](https://github.com/jscraik/coding-harness/commit/46336000d1ee8a18637dffefa843ff5d46db02b7))
- harden CLI argument parsing and validation ([aeb9c1a](https://github.com/jscraik/coding-harness/commit/aeb9c1ae3bd646fd9109b5879dbfe11b6a0e6d70))
- harden context path validation and option parsing ([7f3c6c2](https://github.com/jscraik/coding-harness/commit/7f3c6c2aa32af45e8955ecfba44212196c725a5a))
- resolve contract and indexer policy parsing ([fc89f52](https://github.com/jscraik/coding-harness/commit/fc89f52548be5e5be2db2b982f00f38bb4b5bccc))
- wire up gap-case and pilot-evaluate commands in CLI ([151a8d2](https://github.com/jscraik/coding-harness/commit/151a8d2b0cb1f18229ccc845b795f8a2de5774b9))

### Features

- **contract:** add pilot policy types and preflight commands for agent-first throughput v1 ([5f6bb37](https://github.com/jscraik/coding-harness/commit/5f6bb3727138071bc7361ccbc131567e2f5a9fcd))
- **gap-case:** implement minimal incident tracking workflow for v1 pilot ([a645f03](https://github.com/jscraik/coding-harness/commit/a645f03e5ea80cbbf2e4d345d4b7a6e9781da6bb))
- **pilot:** implement pilot scorecard and promotion gate ([7ff7340](https://github.com/jscraik/coding-harness/commit/7ff734084eb639f6d6fe5d02b0b44b91da162376))
- **remediation:** implement Phase 2 deterministic throughput hardening ([14f5fd5](https://github.com/jscraik/coding-harness/commit/14f5fd51a3128583a23087998d9b5463599cfc1e))

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

- add pilot policy keys to validator and tests ([664525c](https://github.com/jscraik/coding-harness/commit/664525cc180fc5e2de0abec9e0a8fe508dfcf7fc))
- address cubic-dev-ai review feedback for PR [#12](https://github.com/jscraik/coding-harness/issues/12) ([ed04c9a](https://github.com/jscraik/coding-harness/commit/ed04c9a7d70f3b7cbd041cadd8b36e07a73dc379))
- **brainstorm:** resolve TypeScript errors, close todo 010 ([6891e8e](https://github.com/jscraik/coding-harness/commit/6891e8e9a07e14cfb439b3fac43dc47bf6f127e7))
- **ci:** add GITHUB_TOKEN for gitleaks PR scanning ([d3aee23](https://github.com/jscraik/coding-harness/commit/d3aee23cc4d53db22b9c0fac35f322f923038888))
- **ci:** add GITHUB_TOKEN for gitleaks PR scanning ([b8a2553](https://github.com/jscraik/coding-harness/commit/b8a25533cd6e6f6be80195393e6ee08b0b34b0ff))
- **ci:** add pull_requests permission for gitleaks ([52e9e45](https://github.com/jscraik/coding-harness/commit/52e9e45e9d701d750546e37a130956bab4e1cc3b))
- **ci:** add pull_requests permission for gitleaks ([7db6498](https://github.com/jscraik/coding-harness/commit/7db64986e4f2c428992e0b5e68c2b52548838e2b))
- **ci:** exclude npmjs.com from lychee link checks ([5094ea8](https://github.com/jscraik/coding-harness/commit/5094ea838988d03a8a008f8ca0732dd273fcb679))
- **ci:** remove deprecated gitleaks inputs ([2131e21](https://github.com/jscraik/coding-harness/commit/2131e21ce493a8a8c0c5be914a587a623daba31d))
- **ci:** remove TruffleHog base/head params causing same-commit error ([7541b82](https://github.com/jscraik/coding-harness/commit/7541b8283f0a4294fcecb303c475efb8039db4b8))
- **ci:** use correct permission name (pull-requests not pull_requests) ([a2cf995](https://github.com/jscraik/coding-harness/commit/a2cf9953958bf10f8ba2830ca5c3c7fc20ec6514))
- correct critical bugs found during comprehensive code review ([47db928](https://github.com/jscraik/coding-harness/commit/47db9287727ce4d7f0c36c2f522054779ad8752e))
- **evidence:** prevent path-traversal bypass via sibling-prefix attack ([dffe657](https://github.com/jscraik/coding-harness/commit/dffe6576dd20447d2e4301ec6e104570a9ee2afc))
- **gardener:** capture JSON output and use needsPR field ([9ffe8c0](https://github.com/jscraik/coding-harness/commit/9ffe8c0dc0943425a8a22024505aaf63520db113))
- **gardener:** prevent mixed JSON and human-readable output ([d17ffc2](https://github.com/jscraik/coding-harness/commit/d17ffc2228d606aeb35d2a450f0d50dce0904d92))
- guard missing flag values in CLI parsing ([a8e1434](https://github.com/jscraik/coding-harness/commit/a8e1434f0560c717f96ccb0edf54a3d4a3631e5b))
- harden path traversal detection in validator ([0732c3c](https://github.com/jscraik/coding-harness/commit/0732c3ca7669fd79e90014a7e5cfab7c47546981))
- refresh diagram context generation paths ([24dbbca](https://github.com/jscraik/coding-harness/commit/24dbbca78792a4e283e5e85de9b13eb59279b3a2))
- resolve multiple test failures across CLI and lib modules ([ab031b8](https://github.com/jscraik/coding-harness/commit/ab031b8fda55eed424efa4145331782ccbfc34b5))
- satisfy markdownlint and strict optional typing ([0815cd5](https://github.com/jscraik/coding-harness/commit/0815cd5c1f1ed09463a8ed62582fdd0f1e206436))
- **security:** harden path and input validation surfaces ([9cf5cc8](https://github.com/jscraik/coding-harness/commit/9cf5cc838f8a7b86a21518e7116de4ebd6d7222e))
- **security:** harden rollback event logging with atomic writes and crypto IDs ([a0e8d78](https://github.com/jscraik/coding-harness/commit/a0e8d7805eae8f59513d990c875468a253d7ebff))

### Features

- add agent-first hybrid search command ([74ab19b](https://github.com/jscraik/coding-harness/commit/74ab19bf51fe27df94c2adf441e5f705f4f0f7ef))
- Add Deterministic Remediation Loop ([#13](https://github.com/jscraik/coding-harness/issues/13)) ([7fd6c17](https://github.com/jscraik/coding-harness/commit/7fd6c177dc4c76035636a66c38f5e7272b781b46))
- add docs, plans, and regression tests ([3fc8d07](https://github.com/jscraik/coding-harness/commit/3fc8d0786d1160f7dcbe01b8f5a25233415b73f8))
- add evidence verification and structured logging ([0156bdd](https://github.com/jscraik/coding-harness/commit/0156bdd8717a50b3ba91a350503e123198dd0396))
- add remediation and gap-case control-plane commands ([9d64045](https://github.com/jscraik/coding-harness/commit/9d640459aac144856f7e83f4a8a7ea57eb90349b))
- add scripts/check for local CI parity ([a247b38](https://github.com/jscraik/coding-harness/commit/a247b38720d2103d6f86fadaebbaac04d006e4af)), closes [#1](https://github.com/jscraik/coding-harness/issues/1)
- Agent-First Throughput v1 Pilot ([#16](https://github.com/jscraik/coding-harness/issues/16)) ([ab4d870](https://github.com/jscraik/coding-harness/commit/ab4d8707c434583d94ffc2fc7fde9611af2d752f))
- **cli:** wire up context and index-context commands ([4bea0db](https://github.com/jscraik/coding-harness/commit/4bea0dbe1eee4f48ec9982fd86b099a8c2f91ec0))
- **context-compound:** implement Phase 1 and Phase 2 ([90b4418](https://github.com/jscraik/coding-harness/commit/90b4418c021a949c99abd4791b926e61746d2403))
- enhance commands with additional test coverage and refinements ([95f02c5](https://github.com/jscraik/coding-harness/commit/95f02c5be1ff8ff1e1b1438f0c8a695bf880908c))
- **gap-case:** add automatic rollback trigger for high-risk incidents ([e132d5e](https://github.com/jscraik/coding-harness/commit/e132d5ee6b7449151b3262ee3b560076ddd84a25))
- **gap-case:** wire contract policy for SLA, evidence, and causality ([973a78d](https://github.com/jscraik/coding-harness/commit/973a78d8e3e11da678d6458f54a2df4cb1868db3))
- **gardener:** add nightly docs maintenance workflow ([#10](https://github.com/jscraik/coding-harness/issues/10)) ([216e579](https://github.com/jscraik/coding-harness/commit/216e5796830c7e5c7452c19dfbeff73a50008d2c))
- GitHub API integration (Phase 4) ([#3](https://github.com/jscraik/coding-harness/issues/3)) ([5a9c650](https://github.com/jscraik/coding-harness/commit/5a9c650b5b9473b7819359bda3c9f0ef4a43d42f))
- implement all Section 27 deferred items ([5bcf631](https://github.com/jscraik/coding-harness/commit/5bcf6316b339512fd766ce8f968a6abdaf1ef29e))
- implement remaining optional items from harness plan ([fdef969](https://github.com/jscraik/coding-harness/commit/fdef969fa6a6e63ebe2327a03b578e975dfe4969))
- implement Section 27 deferred acceptance criteria ([2773e47](https://github.com/jscraik/coding-harness/commit/2773e471e6709d4827f54eca5bb5d066ce6588cf))
- implement silent error detection command ([a50784f](https://github.com/jscraik/coding-harness/commit/a50784fec5563bc10856ca770130da456f4495b6))
- **init:** add harness init command with package manager detection ([068601e](https://github.com/jscraik/coding-harness/commit/068601e01a9cd8f99dd709a1c208444137104dce))
- **init:** add interactive mode with --interactive flag ([52f5b7a](https://github.com/jscraik/coding-harness/commit/52f5b7a955bf1e71d67146b5d4d814e46c918c61))
- **init:** add rollback system with --track and --rollback flags ([032e162](https://github.com/jscraik/coding-harness/commit/032e1628c375927715a598391694ac3a7e07d45b))
- **init:** add schema migration with --migrate flag ([#8](https://github.com/jscraik/coding-harness/issues/8)) ([9ab8c8e](https://github.com/jscraik/coding-harness/commit/9ab8c8ec72b15425bb359ec81e4c1ccbb45d5d6e))
- **init:** add update detection with --check-updates and --update flags ([47f5337](https://github.com/jscraik/coding-harness/commit/47f5337b073d8917fbd32a44648c3bc7818a6fbf))
- **init:** enhance contract template with full policy configuration ([a46db41](https://github.com/jscraik/coding-harness/commit/a46db41de3f6cc08d7e9c9c20251cfd68b6da7c6))
- **memory:** add codex branch enforcement and reliability metrics ([6347453](https://github.com/jscraik/coding-harness/commit/63474537a3b567c4fa77fb7f591596417c5c47bf))
- **memory:** add memory policy gate for workflow compliance ([f1bf0c2](https://github.com/jscraik/coding-harness/commit/f1bf0c21673f9fafde8697b03471b75e8d4f202b))
- Phase 2 - Contract and Policy Core ([#1](https://github.com/jscraik/coding-harness/issues/1)) ([21ed895](https://github.com/jscraik/coding-harness/commit/21ed895ab300921ee1a48a28a612b2dc18f668b6))
- **pilot-rollback:** add machine-proof rollback interface ([29c1134](https://github.com/jscraik/coding-harness/commit/29c113448894546316fd8d60c869e12dd57207bf))
- **policy-gate:** Phase 3 GitHub workflow orchestration ([#2](https://github.com/jscraik/coding-harness/issues/2)) ([e4c4bd0](https://github.com/jscraik/coding-harness/commit/e4c4bd05aeb8cd592fb60577f6a0613e0e794144))
- **preflight:** add preflight policy gate for fast pre-build checks ([c17c26a](https://github.com/jscraik/coding-harness/commit/c17c26ac10e84e73994661a0b8f44d42ba568b08))
- **remediate:** wire contract policy to remediation orchestrator ([e3c3add](https://github.com/jscraik/coding-harness/commit/e3c3add247bfb3673f5cac30fce3d29fc9163eec))
- Roadmap/CLI Gap Closure (P0/P1/P2) ([#17](https://github.com/jscraik/coding-harness/issues/17)) ([b06fb1e](https://github.com/jscraik/coding-harness/commit/b06fb1e007d746958178ccd0d62986b97e233903))
- serialize github mutations and add review authz gate ([92169a8](https://github.com/jscraik/coding-harness/commit/92169a8cc3451f267aa12f94e62ca9fbbfb3f35a))
