import { installGitFixtureEnvironment } from "../lib/git/fixture-environment.js";

/** Keep raw disposable Git fixtures independent of the host signing policy. */
installGitFixtureEnvironment(process.env);
