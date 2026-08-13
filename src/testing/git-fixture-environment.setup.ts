import { withGitFixtureSigningDisabled } from "./git-fixture-environment.js";

/** Keep raw disposable Git fixtures independent of the host signing policy. */
Object.assign(process.env, withGitFixtureSigningDisabled(process.env));
