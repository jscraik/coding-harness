# Rust and Tauri Standards

## Table of Contents
- [9. Rust & Tauri Standards](#9-rust--tauri-standards)

## 9. Rust & Tauri Standards

### Formatting (Required)

* **rustfmt** is the formatter of record.
* Formatting MUST be enforced in CI (`cargo fmt --check`).
* Formatting config is shared repo-wide.

### Linting (Required)

* **Clippy** is required.
* Allow-lists MUST include reason + ticket (+ expiry if temporary) per waiver model.

### Concurrency (Required)

* Prefer structured concurrency (async/await + explicit cancellation).
* Shared mutable state MUST be isolated (channels, actors, or controlled ownership).
* `unsafe` is forbidden unless:

  * ADR exists,
  * mitigation is documented,
  * concurrency test exists.

### Tauri

* Commands MUST validate inputs and return typed errors.
* UI-facing state MUST be deterministic and testable.
* Avoid blocking the main thread; spawn heavy work to worker tasks.

### Testing

* Unit tests MUST run in CI (`cargo test`).
* UI/desktop end-to-end tests SHOULD be separated from unit tests in CI.

---

